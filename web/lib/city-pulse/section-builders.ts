/**
 * Section builder functions for City Pulse.
 *
 * Each builder takes raw query results + context + optional user signals
 * and returns a typed section or null (when insufficient data).
 * The null-return pattern ensures graceful degradation: sections with
 * too few items simply don't appear in the feed.
 */

import type {
  FeedContext,
  CityPulseSection,
  CityPulseItem,
  CityPulseEventItem,
  CityPulseDestinationItem,
  CityPulseSpecialItem,
  FriendGoingInfo,
  UserSignals,
  TimeSlot,
  EditorialMention,
} from "./types";
import { getCardTier } from "./tier-assignment";

/** Venue-keyed map of editorial press mentions. Passed from fetch-enrichments Phase B. */
export type EditorialMap = Record<number, EditorialMention[]>;
import type { FeedEventData } from "@/components/EventCard";
import type { Spot } from "@/lib/spots-constants";
import { getTimeSlotLabel, isNightlifeTime } from "./time-slots";
import { scoreEvent, scoreDestination, applyWildCardSorting } from "./scoring";
import { getWeatherContextLabel } from "./weather-mapping";
import { getEffectiveEventImageUrl, isFestivalLikeEvent } from "./event-signals";
import {
  isSceneEvent,
  matchActivityType,
} from "@/lib/scene-event-routing";
import type { WeatherData } from "@/lib/weather-utils";
import type { RecommendationReason } from "@/components/ReasonBadge";
import { isOpenAt, type HoursData } from "@/lib/hours";
import { getPlanningUrgency, ticketStatusFreshness } from "@/lib/types/planning-horizon";

export {
  SCENE_ACTIVITY_TYPES,
  isSceneEvent,
  matchActivityType,
  type SceneActivityType,
} from "@/lib/scene-event-routing";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEventItem(
  event: FeedEventData,
  opts?: {
    contextual_label?: string;
    friends_going?: FriendGoingInfo[];
    score?: number;
    reasons?: RecommendationReason[];
    featured?: boolean;
    is_recurring?: boolean;
    recurrence_label?: string;
  },
  editorialMap?: EditorialMap,
): CityPulseEventItem {
  const effectiveImageUrl = getEffectiveEventImageUrl(event);
  const venueId = event.venue?.id;
  const editorialMentions = (venueId != null && editorialMap)
    ? editorialMap[venueId]
    : undefined;
  const venueHasEditorial = editorialMentions != null && editorialMentions.length > 0;

  const cardTier = getCardTier(
    {
      is_tentpole: event.is_tentpole,
      is_featured: (event as Record<string, unknown>).is_featured as boolean | undefined,
      festival_id: event.festival_id,
      image_url: effectiveImageUrl,
      featured_blurb: event.featured_blurb,
      importance: (event as Record<string, unknown>).importance as
        | "flagship"
        | "major"
        | "standard"
        | null
        | undefined,
      venue_has_editorial: venueHasEditorial,
    },
    opts?.friends_going?.length ?? 0,
  );

  // Compute scene activity type for recurring events (e.g. "trivia", "karaoke")
  const rawEvent = event as Record<string, unknown>;
  const activityType = (event.series_id || rawEvent.is_recurring)
    ? (matchActivityType(event as Parameters<typeof matchActivityType>[0]) ?? null)
    : null;

  return {
    item_type: "event",
    event: {
      ...event,
      image_url: effectiveImageUrl,
      contextual_label: opts?.contextual_label,
      friends_going: opts?.friends_going,
      score: opts?.score,
      reasons: opts?.reasons,
      featured: opts?.featured,
      is_recurring: opts?.is_recurring,
      recurrence_label: opts?.recurrence_label,
      activity_type: activityType ?? undefined,
      card_tier: cardTier,
      editorial_mentions: editorialMentions,
    },
  };
}

function makeDestinationItem(
  venue: Spot,
  opts?: {
    contextual_label?: string;
    is_open?: boolean;
    top_special?: CityPulseDestinationItem["destination"]["top_special"];
  },
): CityPulseDestinationItem {
  return {
    item_type: "destination",
    destination: {
      venue,
      contextual_label: opts?.contextual_label,
      is_open: opts?.is_open,
      top_special: opts?.top_special,
    },
  };
}

function makeSpecialItem(
  special: CityPulseSpecialItem["special"],
): CityPulseSpecialItem {
  return { item_type: "special", special };
}

type EventWithScore = FeedEventData & {
  score?: number;
  reasons?: RecommendationReason[];
  friends_going?: FriendGoingInfo[];
  featured?: boolean;
  is_recurring?: boolean;
  recurrence_label?: string;
};

/**
 * Build a human-readable recurrence label from series data.
 * E.g., "Every Monday", "Weekly", "Monthly"
 *
 * Derives the day name from the event's own start_date rather than
 * trusting series.day_of_week, which can be stale when a series
 * spans multiple days (e.g. Improv Night on both Fri and Sat).
 */
export function buildRecurrenceLabel(event: FeedEventData): string | undefined {
  const series = (event as Record<string, unknown>).series as {
    frequency?: string | null;
    day_of_week?: string | null;
  } | null;
  if (!series) return undefined;

  // Prefer deriving the day from the event's actual date — always accurate.
  if (event.start_date) {
    try {
      const dayName = new Date(event.start_date + "T00:00:00")
        .toLocaleDateString("en-US", { weekday: "long" });
      return `Every ${dayName}`;
    } catch {
      // Fall through to series metadata
    }
  }

  // Fallback to series metadata when start_date is unavailable
  if (series.day_of_week) {
    const day = series.day_of_week.charAt(0).toUpperCase() + series.day_of_week.slice(1);
    return `Every ${day}`;
  }
  if (series.frequency) {
    return series.frequency.charAt(0).toUpperCase() + series.frequency.slice(1);
  }
  return "Recurring";
}

/**
 * Deduplicate events sharing the same series_id.
 * Keeps only the next occurrence (earliest start_date).
 * Marks kept events with is_recurring + recurrence_label.
 */
function deduplicateSeries<T extends FeedEventData>(events: T[]): T[] {
  const seriesSeen = new Map<string, number>(); // series_id (UUID) → index in result
  const result: T[] = [];

  for (const event of events) {
    const seriesId = (event as Record<string, unknown>).series_id as string | null;
    if (!seriesId) {
      result.push(event);
      continue;
    }

    const existingIdx = seriesSeen.get(seriesId);
    if (existingIdx === undefined) {
      seriesSeen.set(seriesId, result.length);
      result.push(event);
    } else {
      // Keep the earlier occurrence
      const existing = result[existingIdx];
      if (event.start_date < existing.start_date) {
        result[existingIdx] = event;
      }
    }
  }

  return result;
}

/**
 * Deduplicate recurring events by series + venue + date.
 * Unlike deduplicateSeries (which keeps 1 per series), this preserves every
 * distinct venue+day occurrence. "Dirty South Trivia" at 6 venues across
 * the week = 6 events, not 1.
 */
function deduplicateByVenueDay<T extends FeedEventData>(events: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const event of events) {
    const seriesId = (event as Record<string, unknown>).series_id as string | null;
    const venueId = event.venue?.id;
    const date = event.start_date;

    // No series? Keep as-is (non-recurring events pass through)
    if (!seriesId) {
      result.push(event);
      continue;
    }

    // Key = series + venue + date. Same trivia night at same bar on same day = dup.
    const key = `${seriesId}:${venueId ?? "no-venue"}:${date}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(event);
    }
  }

  return result;
}

/**
 * Interleave events so no two consecutive rows are from the same venue.
 * Greedy O(n) pass: if current venue === previous venue, swap with next
 * different-venue event. Scores unchanged — this is a presentation concern.
 */
function interleaveByVenue<T extends { venue?: { id: number } | null }>(
  items: T[],
): T[] {
  if (items.length < 3) return items;
  const result = [...items];

  for (let i = 1; i < result.length; i++) {
    const prevVenueId = result[i - 1].venue?.id;
    if (prevVenueId == null) continue;
    if (result[i].venue?.id !== prevVenueId) continue;

    // Find next item with a different venue to swap with
    let swapIdx = -1;
    for (let j = i + 1; j < result.length; j++) {
      if (result[j].venue?.id !== prevVenueId) {
        swapIdx = j;
        break;
      }
    }
    if (swapIdx !== -1) {
      [result[i], result[swapIdx]] = [result[swapIdx], result[i]];
    }
  }

  return result;
}

/**
 * Build an uncapped event pool for tab mode (THIS WEEK / COMING UP).
 *
 * Unlike the scored/capped section builders used for the initial feed,
 * this wraps ALL fetched events into a single section so the frontend
 * can apply its own interest-chip filtering across the full set.
 * Series are deduplicated (next occurrence only) and friend-going info
 * is attached, but no scoring, date-distribution, or slicing is applied.
 */
export function buildTabEventPool(
  tab: "this_week" | "coming_up",
  events: FeedEventData[],
  _signals: UserSignals | null,
  friendsGoingMap: Record<number, FriendGoingInfo[]>,
): CityPulseSection {
  // Scene events now flow through tagged with activity_type — RecurringStrip renders them compactly.
  const deduped = deduplicateSeries(events);

  const items: CityPulseItem[] = deduped.map((event) => {
    const seriesId = (event as Record<string, unknown>).series_id as number | null;
    const isRecurring = !!seriesId;
    return makeEventItem(event, {
      friends_going: friendsGoingMap[event.id] ?? undefined,
      is_recurring: isRecurring || undefined,
      recurrence_label: isRecurring ? buildRecurrenceLabel(event) : undefined,
    });
  });

  const isWeek = tab === "this_week";
  return {
    id: isWeek ? "this-week" : "coming-up",
    type: isWeek ? "this_week" : "coming_up",
    title: isWeek ? "This Week" : "Coming Up",
    subtitle: `${items.length} event${items.length !== 1 ? "s" : ""}`,
    priority: "secondary",
    accent_color: isWeek ? "var(--neon-cyan)" : "var(--soft)",
    items,
    meta: isWeek
      ? { total_this_week: items.length }
      : { total_coming_up: items.length },
  };
}

/**
 * Ensure date diversity: no single day dominates the result set.
 * Groups events by start_date, caps each day at `maxPerDay`, and
 * interleaves days so the list feels spread across the time window.
 */
function distributeByDate(
  events: FeedEventData[],
  maxPerDay: number = 25,
): FeedEventData[] {
  const byDate = new Map<string, FeedEventData[]>();
  for (const e of events) {
    const day = e.start_date;
    if (!byDate.has(day)) byDate.set(day, []);
    byDate.get(day)!.push(e);
  }

  // Sort dates chronologically
  const sortedDates = [...byDate.keys()].sort();

  // Cap each day and round-robin interleave
  const cappedByDate = sortedDates.map((d) => byDate.get(d)!.slice(0, maxPerDay));
  const result: FeedEventData[] = [];
  let remaining = true;
  let idx = 0;
  while (remaining) {
    remaining = false;
    for (const dayEvents of cappedByDate) {
      if (idx < dayEvents.length) {
        result.push(dayEvents[idx]);
        remaining = true;
      }
    }
    idx++;
  }
  return result;
}

function scoreAndSort(
  events: FeedEventData[],
  signals: UserSignals | null,
  friendsGoingMap: Record<number, FriendGoingInfo[]>,
): EventWithScore[] {
  // Deduplicate series first — keep only next occurrence
  const deduped = deduplicateSeries(events);

  const scored = deduped.map((event) => {
    const result = scoreEvent(event as never, signals, friendsGoingMap);
    const seriesId = (event as Record<string, unknown>).series_id as number | null;
    const isRecurring = !!seriesId;
    return {
      ...event,
      score: result.score,
      reasons: result.reasons,
      friends_going: result.friends_going,
      is_recurring: isRecurring || undefined,
      recurrence_label: isRecurring ? buildRecurrenceLabel(event) : undefined,
    };
  });
  return interleaveByVenue(applyWildCardSorting(scored));
}

// ---------------------------------------------------------------------------
// Banner section (always present)
// ---------------------------------------------------------------------------

export function buildBannerSection(
  context: FeedContext,
): CityPulseSection {
  const items: CityPulseItem[] = [];

  // Priority: holidays > festivals > time-of-day
  let title = getTimeSlotLabel(context.time_slot);
  let subtitle: string | undefined;
  let accent_color: string | undefined;

  if (context.active_holidays.length > 0) {
    const topHoliday = context.active_holidays[0];
    title = topHoliday.title;
    accent_color = topHoliday.accent_color;
    if (context.weather) {
      subtitle = `${Math.round(context.weather.temperature_f)}\u00B0 \u00B7 ${context.weather.condition}`;
    }
  } else if (context.active_festivals.length > 0) {
    const topFestival = context.active_festivals[0];
    title = topFestival.name;
    subtitle = getTimeSlotLabel(context.time_slot);
  } else if (context.weather) {
    subtitle = `${Math.round(context.weather.temperature_f)}\u00B0 \u00B7 ${context.weather.condition}`;
  }

  return {
    id: "city-pulse-banner",
    type: "city_pulse_banner",
    title,
    subtitle,
    priority: "primary",
    accent_color,
    items,
    meta: {
      time_slot: context.time_slot,
      day_of_week: context.day_of_week,
      holiday_count: context.active_holidays.length,
      festival_count: context.active_festivals.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Right Now section (minimum 3 items)
// ---------------------------------------------------------------------------

export interface RightNowInput {
  todayEvents: FeedEventData[];
  activeSpecials: CityPulseSpecialItem["special"][];
  openDestinations: Array<Spot & { is_open: boolean }>;
}

export function buildRightNowSection(
  context: FeedContext,
  input: RightNowInput,
  signals: UserSignals | null,
  friendsGoingMap: Record<number, FriendGoingInfo[]>,
  editorialMap?: EditorialMap,
): CityPulseSection | null {
  const items: CityPulseItem[] = [];

  // Exclude Regular Hangs — they belong in The Scene section
  const lineupEvents = input.todayEvents.filter((e) => !isSceneEvent(e));

  // Score and sort events
  const scoredEvents = scoreAndSort(
    lineupEvents,
    signals,
    friendsGoingMap,
  );

  // Select hero event: first tentpole/featured with image, or highest-scored with image, or highest-scored
  const heroIdx = scoredEvents.findIndex(
    (e) =>
      ((e as Record<string, unknown>).is_tentpole || (e as Record<string, unknown>).is_featured) &&
      !!getEffectiveEventImageUrl(e),
  );
  const heroEvent = heroIdx !== -1
    ? scoredEvents[heroIdx]
    : scoredEvents.find((e) => !!getEffectiveEventImageUrl(e)) || scoredEvents[0];

  // Build event items — hero first, then the rest
  const eventItems: CityPulseEventItem[] = [];
  if (heroEvent) {
    eventItems.push(
      makeEventItem(heroEvent, {
        contextual_label: getEventContextLabel(heroEvent, context),
        friends_going: heroEvent.friends_going,
        score: heroEvent.score,
        reasons: heroEvent.reasons,
        featured: true,
        is_recurring: heroEvent.is_recurring,
        recurrence_label: heroEvent.recurrence_label,
      }, editorialMap),
    );
  }

  // Send full pool for chip filtering — the client limits display via
  // INITIAL_ROWS and "See all". High cap prevents edge-case blowup.
  const remaining = scoredEvents
    .filter((e) => e.id !== heroEvent?.id)
    .slice(0, 150);
  for (const e of remaining) {
    eventItems.push(
      makeEventItem(e, {
        contextual_label: getEventContextLabel(e, context),
        friends_going: e.friends_going,
        score: e.score,
        reasons: e.reasons,
        is_recurring: e.is_recurring,
        recurrence_label: e.recurrence_label,
      }, editorialMap),
    );
  }

  // Filter specials by time-slot relevance, then deduplicate by venue — one special per venue
  const contextualSpecials = filterContextualSpecials(
    input.activeSpecials,
    context.time_slot,
  );
  const seenSpecialVenues = new Set<number>();
  const dedupedSpecials = contextualSpecials.filter((s) => {
    if (seenSpecialVenues.has(s.venue.id)) return false;
    seenSpecialVenues.add(s.venue.id);
    return true;
  });
  const specialItems = dedupedSpecials.slice(0, 3).map(makeSpecialItem);
  // Exclude venues already appearing as specials to prevent duplicates
  const venuesWithSpecials = new Set(dedupedSpecials.slice(0, 3).map((s) => s.venue.id));
  const destItems = input.openDestinations
    .filter((d) => !venuesWithSpecials.has(d.id))
    .slice(0, 3)
    .map((d) => makeDestinationItem(d, { is_open: true }));

  // Hero event always first
  if (eventItems.length > 0) items.push(eventItems[0]);

  // Interleave remaining: event, event, special, dest, ...
  let ei = 1, si = 0, di = 0;
  while (ei < eventItems.length || si < specialItems.length || di < destItems.length) {
    if (ei < eventItems.length) items.push(eventItems[ei++]);
    if (ei < eventItems.length) items.push(eventItems[ei++]);
    if (si < specialItems.length) items.push(specialItems[si++]);
    if (di < destItems.length) items.push(destItems[di++]);
  }

  if (items.length < 3) return null;

  const title = getEditorialTitle("right_now", context);

  // Count for subtitle
  const totalToday = input.todayEvents.length;
  const subtitle = totalToday > 0
    ? `${totalToday} event${totalToday !== 1 ? "s" : ""} today`
    : "Events, deals, and open spots";

  return {
    id: "right-now",
    type: "right_now",
    title,
    subtitle,
    priority: "primary",
    accent_color: "var(--coral)",
    items,
    meta: { total_today: totalToday },
  };
}

/**
 * Filter specials to those contextually relevant to the current time slot.
 * Happy hour specials during happy_hour, brunch specials in the morning, etc.
 */
function filterContextualSpecials(
  specials: CityPulseSpecialItem["special"][],
  timeSlot: TimeSlot,
): CityPulseSpecialItem["special"][] {
  // Map time slots to relevant special types
  const relevantTypes: Record<TimeSlot, Set<string>> = {
    morning: new Set(["brunch", "breakfast", "early_bird", "happy_hour", "daily_special", "recurring_deal"]),
    midday: new Set(["lunch", "happy_hour", "daily", "brunch", "daily_special", "recurring_deal"]),
    happy_hour: new Set(["happy_hour", "drink_special", "daily", "dinner", "daily_special", "recurring_deal"]),
    evening: new Set(["happy_hour", "drink_special", "dinner", "daily", "late_night", "daily_special", "recurring_deal", "event_night"]),
    late_night: new Set(["late_night", "drink_special", "daily", "daily_special", "recurring_deal", "event_night"]),
  };

  const relevant = relevantTypes[timeSlot] || new Set<string>();

  // Always include active_now specials; filter starting_soon by type relevance
  return specials.filter((s) => {
    if (s.state === "active_now") return true;
    // For starting_soon, check type relevance
    return relevant.has(s.type);
  });
}

function getEventContextLabel(
  event: FeedEventData,
  context: FeedContext,
): string | undefined {
  if (!event.start_time) return undefined;

  const [hourStr, minStr] = event.start_time.split(":");
  const hour = parseInt(hourStr, 10);
  const min = parseInt(minStr || "0", 10);
  const now = new Date();
  const eventMinutes = hour * 60 + min;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const diff = eventMinutes - currentMinutes;

  if (diff > 0 && diff <= 60) {
    return `Starting in ${diff} min`;
  }
  if (diff <= 0 && diff > -120) {
    return "Happening now";
  }
  if (event.is_free) {
    return `Free ${context.time_slot === "evening" ? "tonight" : "today"}`;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Weather Discovery section (minimum 3 items)
// ---------------------------------------------------------------------------

export function buildWeatherDiscoverySection(
  context: FeedContext,
  venues: Spot[],
  weatherLabel: string,
  weatherSubtitle: string,
  signals: UserSignals | null,
): CityPulseSection | null {
  if (!context.weather || venues.length < 3) return null;

  const scored = venues.map((v) => ({
    venue: v,
    score: scoreDestination(v, signals),
  }));
  scored.sort((a, b) => b.score - a.score);

  const weather = context.weather as WeatherData;
  const now = new Date();
  const items: CityPulseItem[] = scored.slice(0, 12).map(({ venue }) => {
    const hours = (venue as Spot & { hours?: HoursData | null }).hours ?? null;
    const openCheck = isOpenAt(hours, now, false);
    return makeDestinationItem(venue, {
      contextual_label: getWeatherContextLabel(
        weather,
        (venue.vibes as string[] | null) ?? null,
        (venue.place_type as string | null) ?? null,
      ),
      is_open: openCheck.isOpen || undefined,
    });
  });

  return {
    id: "weather-discovery",
    type: "weather_discovery",
    title: weatherLabel,
    subtitle: weatherSubtitle,
    priority: "secondary",
    accent_color: "var(--gold)",
    items,
    meta: {
      temperature_f: context.weather.temperature_f,
      condition: context.weather.condition,
    },
  };
}

// ---------------------------------------------------------------------------
// Tonight section (shown during morning/midday/happy_hour only)
// ---------------------------------------------------------------------------

export interface TonightInput {
  todayEvents: FeedEventData[];
  activeSpecials: CityPulseSpecialItem["special"][];
}

export function buildTonightSection(
  context: FeedContext,
  input: TonightInput,
  signals: UserSignals | null,
  friendsGoingMap: Record<number, FriendGoingInfo[]>,
  editorialMap?: EditorialMap,
): CityPulseSection | null {
  // Only show during planning hours — once evening starts, "tonight" IS "right now"
  const planningSlots: TimeSlot[] = ["morning", "midday", "happy_hour"];
  if (!planningSlots.includes(context.time_slot)) return null;

  // Filter to events starting after 5pm, excluding Regular Hangs
  const tonightEvents = input.todayEvents.filter((e) => {
    if (isSceneEvent(e)) return false;
    if (!e.start_time) return false;
    return e.start_time >= "17:00";
  });

  if (tonightEvents.length < 2) return null;

  const scored = scoreAndSort(tonightEvents, signals, friendsGoingMap);
  const items: CityPulseItem[] = scored.map((e, idx) =>
    makeEventItem(e, {
      contextual_label: getEventContextLabel(e, context),
      friends_going: e.friends_going,
      score: e.score,
      reasons: e.reasons,
      featured: idx === 0 && !!e.image_url,
      is_recurring: e.is_recurring,
      recurrence_label: e.recurrence_label,
    }, editorialMap),
  );

  // Weave in contextually relevant specials (evening-appropriate)
  const eveningSpecials = input.activeSpecials.filter(
    (s) =>
      s.type === "happy_hour" ||
      s.type === "drink_special" ||
      s.type === "dinner" ||
      s.type === "event_night" ||
      s.type === "daily_special" ||
      s.type === "recurring_deal",
  );
  for (const special of eveningSpecials.slice(0, 2)) {
    // Insert after every 3rd event
    const insertIdx = Math.min(3, items.length);
    items.splice(insertIdx, 0, makeSpecialItem(special));
  }

  return {
    id: "tonight",
    type: "tonight",
    title: getEditorialTitle("tonight", context),
    subtitle: `${tonightEvents.length} event${tonightEvents.length !== 1 ? "s" : ""} this evening`,
    priority: "primary",
    accent_color: "var(--neon-magenta)",
    items,
    meta: { total_tonight: tonightEvents.length },
  };
}

// ---------------------------------------------------------------------------
// This Week section (Mon-Tue only, fills the gap when Weekend isn't shown)
// ---------------------------------------------------------------------------

export function buildThisWeekSection(
  context: FeedContext,
  weekEvents: FeedEventData[],
  signals: UserSignals | null,
  friendsGoingMap: Record<number, FriendGoingInfo[]>,
): CityPulseSection | null {
  // Always build — the THIS WEEK tab needs data every day
  // Scene events now flow through tagged with activity_type.
  if (weekEvents.length < 2) return null;

  // Distribute across days so one busy day doesn't dominate, cap total
  const distributed = distributeByDate(weekEvents, 25);
  const scored = scoreAndSort(distributed, signals, friendsGoingMap).slice(0, 30);
  const items: CityPulseItem[] = scored.map((e) =>
    makeEventItem(e, {
      friends_going: e.friends_going,
      score: e.score,
      reasons: e.reasons,
      is_recurring: e.is_recurring,
      recurrence_label: e.recurrence_label,
    }),
  );

  return {
    id: "this-week",
    type: "this_week",
    title: "This Week",
    subtitle: `${weekEvents.length} event${weekEvents.length !== 1 ? "s" : ""} through Friday`,
    priority: "secondary",
    accent_color: "var(--neon-cyan)",
    items,
    meta: { total_this_week: weekEvents.length },
  };
}

// ---------------------------------------------------------------------------
// This Weekend section (Wed-Sun only)
// ---------------------------------------------------------------------------

export function buildThisWeekendSection(
  context: FeedContext,
  weekendEvents: FeedEventData[],
  signals: UserSignals | null,
  friendsGoingMap: Record<number, FriendGoingInfo[]>,
): CityPulseSection | null {
  // Always build — feeds into the THIS WEEK tab alongside this_week
  // Scene events now flow through tagged with activity_type.
  if (weekendEvents.length < 2) return null;

  const distributed = distributeByDate(weekendEvents, 25);
  const scored = scoreAndSort(distributed, signals, friendsGoingMap);
  const items: CityPulseItem[] = scored.map((e) =>
    makeEventItem(e, {
      friends_going: e.friends_going,
      score: e.score,
      reasons: e.reasons,
    }),
  );

  return {
    id: "this-weekend",
    type: "this_weekend",
    title: getEditorialTitle("this_weekend", context),
    subtitle: context.weather
      ? `${Math.round(context.weather.temperature_f)}\u00B0 forecast`
      : undefined,
    priority: "secondary",
    accent_color: "var(--neon-green)",
    items,
    meta: context.weather
      ? { forecast_temp: context.weather.temperature_f }
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Your People section (minimum 2 friends, logged-in only)
// ---------------------------------------------------------------------------

export interface YourPeopleInput {
  friendRsvps: Array<{
    event: FeedEventData;
    friends: FriendGoingInfo[];
  }>;
}

export function buildYourPeopleSection(
  input: YourPeopleInput,
  editorialMap?: EditorialMap,
): CityPulseSection | null {
  if (input.friendRsvps.length < 2) return null;

  const items: CityPulseItem[] = input.friendRsvps
    .slice(0, 8)
    .map(({ event, friends }) =>
      makeEventItem(event, { friends_going: friends }, editorialMap),
    );

  return {
    id: "your-people",
    type: "your_people",
    title: "Your People",
    subtitle: "Where your friends are heading",
    priority: "secondary",
    accent_color: "var(--neon-magenta)",
    items,
  };
}

// ---------------------------------------------------------------------------
// New From Your Spots section (minimum 2, logged-in only)
// ---------------------------------------------------------------------------

export function buildNewFromSpotsSection(
  events: FeedEventData[],
  editorialMap?: EditorialMap,
): CityPulseSection | null {
  if (events.length < 2) return null;

  const items: CityPulseItem[] = events
    .slice(0, 8)
    .map((e) =>
      makeEventItem(e, { contextual_label: "New from a spot you follow" }, editorialMap),
    );

  return {
    id: "new-from-spots",
    type: "new_from_spots",
    title: "New From Your Spots",
    subtitle: "Fresh events at places you follow",
    priority: "secondary",
    accent_color: "var(--neon-green)",
    items,
  };
}

// ---------------------------------------------------------------------------
// Trending section (always has content)
// ---------------------------------------------------------------------------

export function buildTrendingSection(
  events: FeedEventData[],
  trendingDestinations: Spot[],
  signals: UserSignals | null,
  friendsGoingMap: Record<number, FriendGoingInfo[]>,
  editorialMap?: EditorialMap,
): CityPulseSection | null {
  const items: CityPulseItem[] = [];

  const scoredEvents = scoreAndSort(events, signals, friendsGoingMap);
  for (const e of scoredEvents.slice(0, 8)) {
    items.push(
      makeEventItem(e, {
        contextual_label: "Trending",
        friends_going: e.friends_going,
        score: e.score,
        reasons: e.reasons,
      }, editorialMap),
    );
  }

  for (const venue of trendingDestinations.slice(0, 4)) {
    items.push(
      makeDestinationItem(venue, { contextual_label: "Popular spot" }),
    );
  }

  if (items.length === 0) return null;

  return {
    id: "trending",
    type: "trending",
    title: "Trending",
    subtitle: "What's gaining momentum",
    priority: "secondary",
    accent_color: "var(--coral)",
    items,
  };
}

// ---------------------------------------------------------------------------
// Coming Up section (7-14 day horizon, always has content)
// ---------------------------------------------------------------------------

export function buildComingUpSection(
  events: FeedEventData[],
  signals: UserSignals | null,
  friendsGoingMap: Record<number, FriendGoingInfo[]>,
): CityPulseSection | null {
  // Scene events now flow through tagged with activity_type.
  if (events.length === 0) return null;

  // Distribute across days so one busy weekend doesn't dominate, cap total
  const distributed = distributeByDate(events, 15);
  const scored = scoreAndSort(distributed, signals, friendsGoingMap).slice(0, 25);
  const items: CityPulseItem[] = scored.map((e) =>
    makeEventItem(e, {
      friends_going: e.friends_going,
      score: e.score,
      reasons: e.reasons,
    }),
  );

  return {
    id: "coming-up",
    type: "coming_up",
    title: "Coming Up",
    subtitle: "Plan ahead for next week",
    priority: "tertiary",
    accent_color: "var(--soft)",
    items,
  };
}

// ---------------------------------------------------------------------------
// The Scene section (recurring activities — trivia, karaoke, open mic, etc.)
// ---------------------------------------------------------------------------

export function buildTheSceneSection(
  todayEvents: FeedEventData[],
  weekRecurringEvents: FeedEventData[],
  signals: UserSignals | null,
  friendsGoingMap: Record<number, FriendGoingInfo[]>,
): CityPulseSection | null {
  // 1. Combine today + week, dedup by event ID (same event can appear in
  //    both inputs), then filter through deterministic Scene router
  const combined = [...todayEvents, ...weekRecurringEvents];
  const seenIds = new Set<number>();
  const allEvents = combined.filter((e) => {
    if (seenIds.has(e.id)) return false;
    seenIds.add(e.id);
    return true;
  });
  const recurringOnly = allEvents.filter(isSceneEvent);

  // 2. Deduplicate by series + venue + date. A series like "Dirty South Trivia"
  //    runs at 6 different venues across the week — each is a distinct event the
  //    user cares about. Only collapse true duplicates (same series, same venue,
  //    same day). Do NOT use deduplicateSeries here — that collapses to 1 per
  //    series, destroying the weekly schedule.
  const deduped = deduplicateByVenueDay(recurringOnly);

  // 3. Match each event to an activity type
  const allActivityMap: Record<number, string> = {};
  for (const event of deduped) {
    const actId = matchActivityType(event);
    if (actId) {
      allActivityMap[event.id] = actId;
    }
  }

  // 4. Only keep events that matched an activity type
  const matched = deduped.filter((e) => allActivityMap[e.id]);

  if (matched.length < 3) return null;

  // 5. Score individually, then sort. No cap — these are compact text rows and
  //    the client handles chip filtering + expand/collapse. Do NOT call
  //    scoreAndSort() which has series-only dedup baked in.
  const scored = matched.map((event) => {
    const result = scoreEvent(event as never, signals, friendsGoingMap);
    return {
      ...event,
      score: result.score,
      reasons: result.reasons,
      friends_going: result.friends_going,
      is_recurring: true as const,
      recurrence_label: buildRecurrenceLabel(event),
    };
  });
  const sorted = interleaveByVenue(applyWildCardSorting(scored));

  // Build counts + map from the full set (every activity is represented)
  const eventActivityMap: Record<number, string> = {};
  const activityCounts: Record<string, number> = {};
  for (const event of sorted) {
    const actId = allActivityMap[event.id];
    if (actId) {
      eventActivityMap[event.id] = actId;
      activityCounts[actId] = (activityCounts[actId] || 0) + 1;
    }
  }

  const items: CityPulseItem[] = sorted.map((e) =>
    makeEventItem(e, {
      friends_going: e.friends_going,
      score: e.score,
      reasons: e.reasons,
      is_recurring: true,
      recurrence_label: buildRecurrenceLabel(e),
    }),
  );

  return {
    id: "the-scene",
    type: "the_scene",
    title: "Regular Hangs",
    subtitle: "Weekly regulars & recurring events",
    priority: "secondary",
    accent_color: "var(--vibe)",
    items,
    layout: "list",
    meta: {
      activity_counts: activityCounts,
      event_activity_map: eventActivityMap,
    },
  };
}


// ---------------------------------------------------------------------------
// Planning Horizon section (7+ days out, tentpoles / festivals / multi-day events only)
// ---------------------------------------------------------------------------

/**
 * Build a "On the Horizon" section for events more than 7 days away.
 * Quality-gated to genuinely plan-ahead, showcase-worthy events:
 *
 *   Structural requirements (all events):
 *   - Must have image_url — it's a carousel, imageless cards look broken
 *   - Far-future events (90+ days out) must also have a real description
 *
 *   At least one of:
 *   - is_tentpole = true
 *   - festival_id is set (multi-day festival)
 *   - end_date differs from start_date AND no series_id
 *     (multi-day one-off event; recurring series are excluded)
 *   - importance = 'flagship'
 *
 * Single-day recurring events and recurring multi-day series are excluded.
 * Returns null when fewer than 2 qualifying events remain after filtering.
 *
 * This builder reads from the same events pool already fetched for the feed,
 * so no extra DB round-trip is needed. The `importance` field is included in
 * the events table but not currently in the EVENT_LIST_SELECT — if it isn't
 * present, the filter degrades gracefully to an empty result (returns null).
 */
export function buildPlanningHorizonSection(
  events: FeedEventData[],
  editorialMap?: EditorialMap,
): CityPulseSection | null {
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const weekFromNowStr = weekFromNow.toISOString().split("T")[0];

  const horizonEvents = events.filter((e) => {
    const raw = e as Record<string, unknown>;
    const importance = raw.importance as string | undefined;
    const canonicalKey = raw.canonical_key as string | undefined;
    // Accept tentpoles, explicit/heuristic festivals, multi-day events,
    // and flagship/major events.
    const qualifies =
      !!canonicalKey ||
      raw.is_tentpole ||
      raw.festival_id ||
      isFestivalLikeEvent(e) ||
      importance === "flagship" ||
      importance === "major" ||
      (e.end_date && e.end_date !== e.start_date);
    return qualifies && e.start_date >= weekFromNowStr;
  });

  if (horizonEvents.length < 2) return null;

  const horizonTierRank = (tier: string | undefined): number => {
    if (tier === "tier_a") return 0;
    if (tier === "tier_b") return 1;
    return 2;
  };

  const canonicalStrength = (event: FeedEventData): number => {
    const raw = event as Record<string, unknown>;
    let score = 0;
    if (raw.entity_type !== "festival") score += 8;
    if (raw.festival_id) score += 4;
    if (raw.is_tentpole) score += 2;
    if (raw.importance === "flagship") score += 2;
    if (getEffectiveEventImageUrl(event)) score += 1;
    const desc = (event.featured_blurb ?? event.description ?? "").trim();
    if (desc.length >= 20) score += 1;
    return score;
  };

  const pickPreferredCanonicalEvent = (a: FeedEventData, b: FeedEventData): FeedEventData => {
    const scoreDiff = canonicalStrength(b) - canonicalStrength(a);
    if (scoreDiff !== 0) return scoreDiff > 0 ? b : a;

    const entityDiff =
      (((a as Record<string, unknown>).entity_type === "festival") ? 1 : 0) -
      (((b as Record<string, unknown>).entity_type === "festival") ? 1 : 0);
    if (entityDiff !== 0) return entityDiff > 0 ? b : a;

    const dateDiff = a.start_date.localeCompare(b.start_date);
    if (dateDiff !== 0) return dateDiff <= 0 ? a : b;

    return a.id <= b.id ? a : b;
  };

  // Quality gate: only genuinely plan-ahead events.
  // The pool query is already filtered to tentpoles/festivals/flagships, but
  // the section builder also receives events from other pools (e.g. trending).
  // This gate ensures no single-day recurring events slip through either path.
  //
  // Additional tightening:
  //   1. Require image_url — a showcase carousel without images is noise.
  //   2. Exclude series events from the multi-day path — a recurring class that
  //      happens to span multiple days is not "On the Horizon" material. Series
  //      events can still pass via is_tentpole or festival_id.
  //   3. Far-future events (90+ days out) also require a description — thin
  //      placeholder entries 3+ months away with no details get cut.
  const ninetyDaysAhead = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const ninetyDaysAheadStr = ninetyDaysAhead.toISOString().split("T")[0];

  const qualityFiltered = horizonEvents.filter((e) => {
    const raw = e as Record<string, unknown>;
    const effectiveImageUrl = getEffectiveEventImageUrl(e);
    const festivalLike = isFestivalLikeEvent(e);
    const canonicalKey = raw.canonical_key as string | undefined;

    if (!effectiveImageUrl) return false;

    if (!canonicalKey && !raw.is_tentpole && !festivalLike && e.start_date >= ninetyDaysAheadStr) {
      const desc = (e.featured_blurb ?? e.description ?? "").trim();
      if (desc.length < 20) return false;
    }

    if (canonicalKey) return true;
    if (raw.is_tentpole) return true;
    if (festivalLike) return true;
    if (e.importance === "flagship" || e.importance === "major") return true;

    if (e.end_date && e.end_date !== e.start_date) {
      if (e.series_id) return false;
      return true;
    }

    return false;
  });

  const canonicalCollapsed = Array.from(
    qualityFiltered.reduce((groups, event) => {
      const canonicalKey = (event as Record<string, unknown>).canonical_key as string | undefined;
      if (!canonicalKey) {
        groups.set(`__event:${event.id}`, event);
        return groups;
      }

      const current = groups.get(canonicalKey);
      groups.set(
        canonicalKey,
        current ? pickPreferredCanonicalEvent(current, event) : event,
      );
      return groups;
    }, new Map<string, FeedEventData>()).values(),
  );

  const sorted = [...canonicalCollapsed].sort((a, b) => {
    const aRaw = a as Record<string, unknown>;
    const bRaw = b as Record<string, unknown>;
    const aTier = aRaw.canonical_tier as string | undefined;
    const bTier = bRaw.canonical_tier as string | undefined;
    const groupCompare = horizonTierRank(aTier) - horizonTierRank(bTier);
    if (groupCompare !== 0) return groupCompare;

    const dateCompare = a.start_date.localeCompare(b.start_date);
    if (dateCompare !== 0) return dateCompare;

    if (horizonTierRank(aTier) < 2) {
      const entityCompare =
        (((aRaw.entity_type === "festival") ? 1 : 0) -
        ((bRaw.entity_type === "festival") ? 1 : 0));
      if (entityCompare !== 0) return entityCompare;
    }

    const aImportance = aRaw.importance as string | undefined;
    const bImportance = bRaw.importance as string | undefined;
    if (aImportance === "flagship" && bImportance !== "flagship") return -1;
    if (bImportance === "flagship" && aImportance !== "flagship") return 1;
    return 0;
  });

  // Deduplicate by normalized title. Handles:
  // - Ticketmaster dupes: "Cardi B" + "Cardi B - Little Miss Drama Tour"
  // - Multi-week festival themes: "Valkyries & Vikings — Georgia Renaissance Festival"
  //   collapses to "georgia renaissance festival" via the em-dash strip
  const seen = new Set<string>();
  const deduped = sorted.filter((e) => {
    const raw = e as Record<string, unknown>;
    const canonicalKey = raw.canonical_key as string | null;
    if (canonicalKey) {
      const registryKey = `canonical:${canonicalKey}`;
      if (seen.has(registryKey)) return false;
      seen.add(registryKey);
    }
    const key = e.title
      .toLowerCase()
      .replace(/[:,\-–—]\s*.*/g, "")  // Strip subtitles after : or - or —
      .replace(/\s+/g, " ")
      .trim();
    if (seen.has(key)) return false;
    seen.add(key);
    // Also dedup by series_id (different titles, same series)
    const seriesId = raw.series_id as string | null;
    if (seriesId) {
      const seriesKey = `series:${seriesId}`;
      if (seen.has(seriesKey)) return false;
      seen.add(seriesKey);
    }
    // Also dedup by festival_id (sub-events of same festival)
    const festivalId = raw.festival_id as string | null;
    if (festivalId) {
      const festKey = `festival:${festivalId}`;
      if (seen.has(festKey)) return false;
      seen.add(festKey);
    }
    return true;
  });

  // Flagships first, then remainder, chronological within each tier.
  // Dedup + curation keeps the list clean — no artificial per-month caps.
  const flagships = deduped.filter(
    (e) => (e as Record<string, unknown>).importance === "flagship",
  );
  const majors = deduped.filter(
    (e) => (e as Record<string, unknown>).importance !== "flagship",
  );
  const capped = [...flagships, ...majors].slice(0, 40);

  // Compute per-month counts for the month selector
  const monthCounts: Record<string, number> = {};
  for (const e of capped) {
    const monthKey = e.start_date.slice(0, 7);
    monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
  }

  // Enrich with urgency + freshness so the client doesn't need to recompute
  const items: CityPulseItem[] = capped.map((e) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = e as any;
    const enriched = {
      ...e,
      urgency: getPlanningUrgency(raw),
      ticket_freshness: ticketStatusFreshness(raw.ticket_status_checked_at),
    };
    return makeEventItem(enriched as FeedEventData, undefined, editorialMap);
  });

  return {
    id: "planning-horizon",
    type: "planning_horizon",
    title: "On the Horizon",
    subtitle: "Big events worth planning around",
    priority: "secondary",
    accent_color: "var(--gold)",
    items,
    layout: "carousel",
    meta: { month_counts: monthCounts },
  };
}

// ---------------------------------------------------------------------------
// Browse section (static structure)
// ---------------------------------------------------------------------------

export function buildBrowseSection(
  portalSlug: string,
  venueTypeCounts?: Record<string, number>,
  eventCategoryCounts?: Record<string, number>,
  todayEvents?: FeedEventData[],
): CityPulseSection {
  // Pick one representative event per category (first match wins)
  const categoryRepresentatives: Record<string, { title: string; venue_name: string }> = {};
  if (todayEvents) {
    for (const event of todayEvents) {
      const cat = event.category;
      if (cat && !categoryRepresentatives[cat] && event.title) {
        categoryRepresentatives[cat] = {
          title: event.title,
          venue_name: event.venue?.name ?? "",
        };
      }
    }
  }

  return {
    id: "browse",
    type: "browse",
    title: "Browse",
    subtitle: "Explore by category or neighborhood",
    priority: "tertiary",
    accent_color: "var(--neon-cyan)",
    items: [],
    layout: "grid",
    meta: {
      portal_slug: portalSlug,
      ...(venueTypeCounts && { venue_type_counts: venueTypeCounts }),
      ...(eventCategoryCounts && { category_counts: eventCategoryCounts }),
      ...(Object.keys(categoryRepresentatives).length > 0 && {
        category_representatives: categoryRepresentatives,
      }),
    },
  };
}

// ---------------------------------------------------------------------------
// Editorial title helper — context-aware section titles
// ---------------------------------------------------------------------------

type EditorialSectionType = "right_now" | "tonight" | "this_weekend" | "this_week";

function hasHoliday(ctx: FeedContext, slug: string): boolean {
  return ctx.active_holidays.some((h) => h.slug === slug);
}

/**
 * Return a context-aware editorial title for a section.
 * Falls back to sensible defaults when no context matches.
 */
export function getEditorialTitle(
  sectionType: EditorialSectionType,
  context: FeedContext,
): string {
  const isEvening = context.time_slot === "evening" || context.time_slot === "late_night";

  switch (sectionType) {
    case "right_now": {
      if (hasHoliday(context, "valentines-day") && isEvening) return "Valentine's Night";
      if (hasHoliday(context, "super-bowl")) return "Game Day";
      if (hasHoliday(context, "halloween") && isEvening) return "Halloween Night";
      if (hasHoliday(context, "st-patricks-day") && isEvening) return "St. Paddy's Night";
      if (isNightlifeTime(context.time_slot)) return "Happening Right Now";
      return "What's Happening";
    }

    case "tonight": {
      if (hasHoliday(context, "valentines-day")) return "Date Night";
      if (context.day_theme === "thirsty_thursday") return "Thirsty Thursday";
      if (context.day_theme === "friday_night") return "Friday Night";
      return "Tonight";
    }

    case "this_weekend": {
      // If a holiday is active during a weekend, prefix with holiday name
      if (context.active_holidays.length > 0) {
        const topHoliday = context.active_holidays[0];
        return `${topHoliday.title} Weekend`;
      }
      return "This Weekend";
    }

    case "this_week":
      return "This Week";

    default:
      return "What's Happening";
  }
}

// ---------------------------------------------------------------------------
// Themed Specials section (different data source — no event redundancy)
// ---------------------------------------------------------------------------

/**
 * Build a themed specials section based on day theme and time context.
 * Uses venue specials (deals), not events, so it never duplicates event sections.
 */
export function buildThemedSpecialsSection(
  context: FeedContext,
  activeSpecials: CityPulseSpecialItem["special"][],
): CityPulseSection | null {
  let title: string;
  let accentColor: string;
  let filtered = [...activeSpecials];

  // Filter by day theme relevance
  if (context.day_theme === "taco_tuesday") {
    title = "Taco Tuesday Specials";
    accentColor = "var(--gold)";
    filtered = filtered.filter((s) => {
      const type = s.type.toLowerCase();
      const desc = (s.description || "").toLowerCase();
      const name = s.title.toLowerCase();
      return type.includes("food") || type.includes("daily") ||
        name.includes("taco") || desc.includes("taco") ||
        name.includes("margarita") || desc.includes("margarita") ||
        type === "daily_special" || type === "recurring_deal";
    });
  } else if (context.day_theme === "wine_wednesday") {
    title = "Wine Wednesday";
    accentColor = "#722F37";
    filtered = filtered.filter((s) => {
      const type = s.type.toLowerCase();
      const desc = (s.description || "").toLowerCase();
      const name = s.title.toLowerCase();
      return type.includes("wine") || type.includes("drink") ||
        name.includes("wine") || desc.includes("wine") ||
        type === "happy_hour" || type === "daily_special";
    });
  } else if (context.day_theme === "thirsty_thursday") {
    title = "Happy Hour Deals";
    accentColor = "var(--neon-magenta)";
    filtered = filtered.filter((s) =>
      s.type === "happy_hour" || s.type === "drink_special" ||
      s.type === "daily_special" || s.type === "recurring_deal",
    );
  } else if (context.time_slot === "happy_hour") {
    title = "Happy Hour";
    accentColor = "var(--neon-magenta)";
    filtered = filtered.filter((s) =>
      s.type === "happy_hour" || s.type === "drink_special" ||
      s.type === "daily_special",
    );
  } else {
    title = "Today's Specials";
    accentColor = "var(--gold)";
    // Keep all active specials
  }

  // Deduplicate by venue
  const seenVenues = new Set<number>();
  filtered = filtered.filter((s) => {
    if (seenVenues.has(s.venue.id)) return false;
    seenVenues.add(s.venue.id);
    return true;
  });

  // Minimum 2 specials to show
  if (filtered.length < 2) return null;

  const items: CityPulseItem[] = filtered.slice(0, 8).map(makeSpecialItem);

  return {
    id: "todays-specials",
    type: "todays_specials",
    title,
    subtitle: `${filtered.length} deal${filtered.length !== 1 ? "s" : ""} right now`,
    priority: "secondary",
    accent_color: accentColor,
    items,
  };
}
