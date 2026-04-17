/**
 * Unified scoring function for City Pulse.
 *
 * Extracted from the For You feed (web/app/api/feed/route.ts lines 880-1043).
 * Same weights, now applicable to all content types (events, destinations, specials).
 * Returns a numeric score + array of human-readable reasons.
 */

import type { RecommendationReason } from "@/components/ReasonBadge";
import type { UserSignals, FriendGoingInfo, FeedContext } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeLowercaseList(
  input: string[] | null | undefined,
): string[] {
  if (!input) return [];
  return input
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .map((v) => v.toLowerCase());
}

function formatTasteLabel(raw: string): string {
  return raw
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Event scoring
// ---------------------------------------------------------------------------

export interface ScorableEvent {
  id: number;
  title: string;
  start_date: string;
  category: string | null;
  genres?: string[] | null;
  tags?: string[] | null;
  is_free: boolean;
  is_tentpole?: boolean | null;
  featured_blurb?: string | null;
  // Taxonomy v2 significance
  significance?: string | null;
  significance_signals?: string[] | null;
  price_min: number | null;
  image_url: string | null;
  source_id?: number | null;
  organization_id?: string | null;
  series_id?: number | null;
  series?: {
    id: number;
    frequency?: string | null;
    day_of_week?: string | null;
  } | null;
  venue?: {
    id: number;
    name: string;
    neighborhood: string | null;
  } | null;
}

export interface ScoredResult {
  score: number;
  reasons: RecommendationReason[];
  friends_going?: FriendGoingInfo[];
}

// ---------------------------------------------------------------------------
// Context boost — lightweight reordering based on day/holiday context
// ---------------------------------------------------------------------------

/**
 * Compute a context-aware score boost for an event.
 * This influences ordering within sections, never exclusion.
 */
export function contextBoost(event: ScorableEvent, context: FeedContext | null): number {
  if (!context) return 0;
  let boost = 0;

  // +5 if event tags match an active holiday slug
  if (context.active_holidays.length > 0 && event.tags?.length) {
    const holidaySlugs = new Set(
      context.active_holidays.map((h) => h.slug.replace(/-/g, "")),
    );
    // Also match with dashes removed from tags
    for (const tag of event.tags) {
      if (holidaySlugs.has(tag.replace(/-/g, ""))) {
        boost += 5;
        break;
      }
    }
  }

  // +5 if event category matches day theme
  if (context.day_theme && event.category) {
    const themeCategories: Record<string, string[]> = {
      taco_tuesday: ["food_drink", "food"],
      wine_wednesday: ["food_drink", "food"],
      thirsty_thursday: ["games", "food_drink"],
      friday_night: ["music", "comedy", "games", "dance"],
      saturday_night: ["music", "comedy", "games", "dance"],
      brunch_weekend: ["food_drink", "food"],
      sunday_funday: ["food_drink", "games", "civic"],
    };
    const relevant = themeCategories[context.day_theme];
    if (relevant?.includes(event.category)) {
      boost += 5;
    }
  }

  // +3 if event is free on weekends (exploration time)
  if (
    event.is_free &&
    ["friday", "saturday", "sunday"].includes(context.day_of_week)
  ) {
    boost += 3;
  }

  return boost;
}

// ---------------------------------------------------------------------------
// Anonymous rank boost — time-of-day + intrinsic quality signals
// ---------------------------------------------------------------------------

/**
 * Compute a ranking boost for anonymous (no-signals) feed ordering.
 * Fixes the "library class at 6pm outranks a $35 City Winery show" problem
 * by weighting time-of-day relevance, importance tier, and quality proxies.
 *
 * Individual signals are capped so that personalization signals (friends going,
 * followed venues) always dominate when present.
 */
export function computeAnonymousRankBoost(
  event: ScorableEvent & {
    start_time?: string | null;
    is_all_day?: boolean;
    importance?: string | null;
    cost_tier?: string | null;
    venue_has_editorial?: boolean;
  },
  now: Date,
): number {
  let boost = 0;

  // 1. Time-of-day relevance (core fix for the library-class-at-6pm bug)
  //    Only applies when the event is today; future-day events skip this entirely.
  const todayISO = now.toISOString().slice(0, 10);
  if (event.start_date === todayISO && event.start_time && !event.is_all_day) {
    const parts = event.start_time.split(":").map((s) => parseInt(s, 10));
    const eventMinutes = parts[0] * 60 + parts[1];
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const delta = eventMinutes - nowMinutes;
    //   starts in next 3h (180 min) → +30
    //   starts in 3–6h              → +20
    //   starts in 6–12h             → +5
    //   starts >12h out             → 0
    //   already started (within 2h window) → +10
    if (delta >= 0 && delta <= 180) boost += 30;
    else if (delta > 180 && delta <= 360) boost += 20;
    else if (delta > 360 && delta <= 720) boost += 5;
    else if (delta < 0 && delta > -120) boost += 10;
  }

  // 2. Importance tier (reuses the taxonomy already encoded in tier-assignment.ts)
  if (event.importance === "flagship") boost += 25;
  else if (event.importance === "major") boost += 12;

  // 3. Tentpole / festival-linked
  if (event.is_tentpole) boost += 15;

  // 4. Ticket signal — paid ticketed events are usually curated / higher intent
  if (event.price_min != null && event.price_min > 0) boost += 8;

  // 5. Image signal — card-quality proxy
  if (event.image_url) boost += 6;

  // 6. Venue editorial weight
  if (event.venue_has_editorial) boost += 10;

  return boost;
}

/**
 * Score an event based on user signals. Returns score + reasons.
 * If no user signals are provided, returns score 0 with no reasons.
 * Optionally accepts feed context for editorial boosting.
 *
 * @param now - Reference instant for time-of-day scoring. Defaults to new Date().
 *              Pass the same value for all events in a render to ensure a consistent
 *              snapshot across the full scored pool.
 */
export function scoreEvent(
  event: ScorableEvent,
  signals: UserSignals | null,
  friendsGoingMap: Record<number, FriendGoingInfo[]> = {},
  context?: FeedContext | null,
  now: Date = new Date(),
): ScoredResult {
  const ctxBoost = contextBoost(event, context ?? null);
  const anonBoost = computeAnonymousRankBoost(event, now);
  if (!signals) return { score: ctxBoost + anonBoost, reasons: [] };

  let score = 0;
  const reasons: RecommendationReason[] = [];
  const tasteMatches: string[] = [];

  const prefs = signals.prefs;
  const favoriteGenreSet = new Set(
    Object.values(prefs?.favorite_genres || {})
      .flat()
      .filter((g): g is string => typeof g === "string")
      .map((g) => g.toLowerCase()),
  );
  const eventGenres = normalizeLowercaseList(event.genres);
  const haystack = [event.title, ...(event.tags || []), ...eventGenres]
    .join(" ")
    .toLowerCase();

  // Friends going (highest priority: 60 base + 10/friend)
  const friendsGoing = friendsGoingMap[event.id] || [];
  if (friendsGoing.length > 0) {
    score += 60 + friendsGoing.length * 10;
    const friendNames = friendsGoing
      .slice(0, 2)
      .map((f) => f.display_name || `@${f.username}`);
    const othersCount = friendsGoing.length - 2;
    let detail = friendNames.join(" and ");
    if (othersCount > 0) {
      detail = `${friendNames[0]} and ${friendsGoing.length - 1} others`;
    }
    reasons.push({ type: "friends_going", label: "Friends going", detail });
  }

  // Followed venue (+50)
  if (event.venue?.id && signals.followedVenueIds.includes(event.venue.id)) {
    score += 50;
    reasons.push({
      type: "followed_venue",
      label: "You follow this venue",
      detail: event.venue.name,
    });
  }

  // Followed organization (+45) — check direct org_id and via source mapping
  const eventOrgId =
    event.organization_id ||
    (event.source_id
      ? signals.sourceOrganizationMap[event.source_id]
      : null);
  if (eventOrgId && signals.followedOrganizationIds.includes(eventOrgId)) {
    score += 45;
    reasons.push({
      type: "followed_organization",
      label: "From an organizer you follow",
    });
  }

  // Matching category (+25)
  if (prefs?.favorite_categories && event.category) {
    if (prefs.favorite_categories.includes(event.category)) {
      score += 25;
      tasteMatches.push(event.category);
    }
  }

  // Matching genres (+8 base, +4/match, capped at 24)
  const matchingGenres = eventGenres.filter((genre) =>
    favoriteGenreSet.has(genre),
  );
  if (matchingGenres.length > 0) {
    score += Math.min(24, 8 + matchingGenres.length * 4);
    tasteMatches.push(...matchingGenres.slice(0, 2));
  }

  // Matching neighborhood (+30)
  if (prefs?.favorite_neighborhoods && event.venue?.neighborhood) {
    if (prefs.favorite_neighborhoods.includes(event.venue.neighborhood)) {
      score += 30;
      reasons.push({
        type: "neighborhood",
        label: "In your favorite area",
        detail: event.venue.neighborhood,
      });
    }
  }

  // Accessibility needs (+8)
  const needsAccessibility = normalizeLowercaseList(prefs?.needs_accessibility);
  if (
    needsAccessibility.length > 0 &&
    needsAccessibility.some((need) => haystack.includes(need))
  ) {
    score += 8;
  }

  // Dietary needs (+8)
  const needsDietary = normalizeLowercaseList(prefs?.needs_dietary);
  if (
    needsDietary.length > 0 &&
    ((event.category || "").toLowerCase() === "food_drink" ||
      needsDietary.some((need) => haystack.includes(need)))
  ) {
    score += 8;
  }

  // Family needs (+12)
  const needsFamily = normalizeLowercaseList(prefs?.needs_family);
  if (
    needsFamily.length > 0 &&
    ((event.category || "").toLowerCase() === "family" ||
      needsFamily.some((need) => haystack.includes(need)))
  ) {
    score += 12;
  }

  // Price preference (+15 to +20)
  if (prefs?.price_preference === "free" && event.is_free) {
    score += 20;
    reasons.push({ type: "price", label: "Free event" });
  } else if (prefs?.price_preference === "budget") {
    if (event.is_free || (event.price_min !== null && event.price_min <= 25)) {
      score += 15;
      reasons.push({ type: "price", label: "Budget-friendly" });
    }
  }

  // Tentpole event (+40)
  if (event.is_tentpole) {
    score += 40;
    reasons.push({ type: "trending", label: "Major event" });
  }

  // Significance level (+15 to +30)
  if (event.significance === "high") {
    score += 30;
    // Only add reason if is_tentpole didn't already add "Major event"
    if (!event.is_tentpole) {
      reasons.push({ type: "trending", label: "High-profile event" });
    }
  } else if (event.significance === "medium") {
    score += 15;
  }

  // Significance signal bonuses (+5 each, capped at 20)
  const SIGNAL_SCORES: Record<string, number> = {
    "touring": 5,
    "large_venue": 5,
    "festival": 5,
    "limited_run": 5,
    "opening": 5,
    "championship": 5,
    "high_price": 3,
    // "known_name" intentionally omitted — lowest-confidence signal per spec
  };
  if (event.significance_signals && event.significance_signals.length > 0) {
    const signalBonus = event.significance_signals.reduce(
      (sum, signal) => sum + (SIGNAL_SCORES[signal] ?? 0),
      0,
    );
    score += Math.min(20, signalBonus);
  }

  // Featured editorial blurb (+15)
  if (event.featured_blurb) {
    score += 15;
  }

  // Image present (+5)
  if (event.image_url) {
    score += 5;
  }

  // Temporal decay: sooner events score higher
  const daysAway = Math.max(
    0,
    Math.floor(
      (new Date(event.start_date).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24),
    ),
  );
  if (daysAway <= 7) {
    score += Math.max(0, 14 - daysAway * 2);
  } else if (daysAway <= 14) {
    score += Math.max(0, 7 - (daysAway - 7));
  }

  // Compose taste match reason
  if (tasteMatches.length > 0) {
    reasons.push({
      type: "category",
      label: "Fits your interests",
      detail: formatTasteLabel(tasteMatches[0]),
    });
  }

  return {
    score: score + ctxBoost + Math.round(anonBoost * 0.4),
    reasons: reasons.length > 0 ? reasons : [],
    friends_going: friendsGoing.length > 0 ? friendsGoing : undefined,
  };
}

/**
 * Score a destination (venue) based on user signals.
 * Lighter-weight than event scoring — mainly neighborhood + follow + vibe match.
 */
export function scoreDestination(
  venue: {
    id: number;
    neighborhood: string | null;
    vibes: string[] | null;
    place_type: string | null;
  },
  signals: UserSignals | null,
): number {
  if (!signals) return 0;

  let score = 0;
  const prefs = signals.prefs;

  // Followed venue (+50)
  if (signals.followedVenueIds.includes(venue.id)) {
    score += 50;
  }

  // Matching neighborhood (+30)
  if (prefs?.favorite_neighborhoods && venue.neighborhood) {
    if (prefs.favorite_neighborhoods.includes(venue.neighborhood)) {
      score += 30;
    }
  }

  // Matching vibes (+15, max)
  if (prefs?.favorite_vibes && venue.vibes) {
    const matchCount = venue.vibes.filter(
      (v) => prefs.favorite_vibes!.includes(v),
    ).length;
    if (matchCount > 0) {
      score += Math.min(15, matchCount * 5);
    }
  }

  return score;
}

/**
 * Sort items by score descending, with a "wild card" mechanism:
 * every 8th item is a low-scoring item to prevent filter bubbles.
 */
export function applyWildCardSorting<T extends { score?: number }>(
  items: T[],
  wildCardInterval = 8,
): T[] {
  if (items.length < wildCardInterval) {
    return [...items].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }

  const sorted = [...items].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const midpoint = Math.floor(sorted.length * 0.7);
  const top = sorted.slice(0, midpoint);
  const bottom = sorted.slice(midpoint);

  const result: T[] = [];
  let topIdx = 0;
  let bottomIdx = 0;

  for (let i = 0; topIdx < top.length || bottomIdx < bottom.length; i++) {
    if (
      i > 0 &&
      i % wildCardInterval === 0 &&
      bottomIdx < bottom.length
    ) {
      result.push(bottom[bottomIdx++]);
    } else if (topIdx < top.length) {
      result.push(top[topIdx++]);
    } else if (bottomIdx < bottom.length) {
      result.push(bottom[bottomIdx++]);
    }
  }

  return result;
}
