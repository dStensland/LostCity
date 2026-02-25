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
      thirsty_thursday: ["nightlife", "food_drink"],
      friday_night: ["nightlife", "music", "comedy"],
      saturday_night: ["nightlife", "music", "comedy"],
      brunch_weekend: ["food_drink", "food"],
      sunday_funday: ["food_drink", "nightlife", "community"],
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

/**
 * Score an event based on user signals. Returns score + reasons.
 * If no user signals are provided, returns score 0 with no reasons.
 * Optionally accepts feed context for editorial boosting.
 */
export function scoreEvent(
  event: ScorableEvent,
  signals: UserSignals | null,
  friendsGoingMap: Record<number, FriendGoingInfo[]> = {},
  context?: FeedContext | null,
): ScoredResult {
  const ctxBoost = contextBoost(event, context ?? null);
  if (!signals) return { score: ctxBoost, reasons: [] };

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
    score: score + ctxBoost,
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
    venue_type: string | null;
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
