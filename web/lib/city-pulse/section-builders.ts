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
  SectionLayout,
} from "./types";
import type { FeedEventData } from "@/components/EventCard";
import type { Spot } from "@/lib/spots-constants";
import { getTimeSlotLabel, isNightlifeTime } from "./time-slots";
import { scoreEvent, scoreDestination, applyWildCardSorting } from "./scoring";
import { getWeatherContextLabel } from "./weather-mapping";
import type { WeatherData } from "@/lib/weather-utils";
import type { RecommendationReason } from "@/components/ReasonBadge";
import { isOpenAt, type HoursData } from "@/lib/hours";

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
): CityPulseEventItem {
  return {
    item_type: "event",
    event: {
      ...event,
      contextual_label: opts?.contextual_label,
      friends_going: opts?.friends_going,
      score: opts?.score,
      reasons: opts?.reasons,
      featured: opts?.featured,
      is_recurring: opts?.is_recurring,
      recurrence_label: opts?.recurrence_label,
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
 */
function buildRecurrenceLabel(event: FeedEventData): string | undefined {
  const series = (event as Record<string, unknown>).series as {
    frequency?: string | null;
    day_of_week?: string | null;
  } | null;
  if (!series) return undefined;

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
  const seriesSeen = new Map<number, number>(); // series_id → index in result
  const result: T[] = [];

  for (const event of events) {
    const seriesId = (event as Record<string, unknown>).series_id as number | null;
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
): CityPulseSection | null {
  const items: CityPulseItem[] = [];

  // Score and sort events
  const scoredEvents = scoreAndSort(
    input.todayEvents,
    signals,
    friendsGoingMap,
  );

  // Select hero event: first tentpole/featured with image, or highest-scored with image, or highest-scored
  const heroIdx = scoredEvents.findIndex(
    (e) => ((e as Record<string, unknown>).is_tentpole || (e as Record<string, unknown>).is_featured) && e.image_url,
  );
  const heroEvent = heroIdx !== -1
    ? scoredEvents[heroIdx]
    : scoredEvents.find((e) => e.image_url) || scoredEvents[0];

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
      }),
    );
  }

  // Remaining events (skip hero) — capped to keep response payload small
  const MAX_SECTION_EVENTS = 25;
  const remaining = scoredEvents
    .filter((e) => e.id !== heroEvent?.id)
    .slice(0, MAX_SECTION_EVENTS);
  for (const e of remaining) {
    eventItems.push(
      makeEventItem(e, {
        contextual_label: getEventContextLabel(e, context),
        friends_going: e.friends_going,
        score: e.score,
        reasons: e.reasons,
        is_recurring: e.is_recurring,
        recurrence_label: e.recurrence_label,
      }),
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
        (venue.venue_type as string | null) ?? null,
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
): CityPulseSection | null {
  // Only show during planning hours — once evening starts, "tonight" IS "right now"
  const planningSlots: TimeSlot[] = ["morning", "midday", "happy_hour"];
  if (!planningSlots.includes(context.time_slot)) return null;

  // Filter to events starting after 5pm
  const tonightEvents = input.todayEvents.filter((e) => {
    if (!e.start_time) return false;
    return e.start_time >= "17:00";
  });

  if (tonightEvents.length < 2) return null;

  const scored = scoreAndSort(tonightEvents, signals, friendsGoingMap).slice(0, 20);
  const items: CityPulseItem[] = scored.map((e, idx) =>
    makeEventItem(e, {
      contextual_label: getEventContextLabel(e, context),
      friends_going: e.friends_going,
      score: e.score,
      reasons: e.reasons,
      featured: idx === 0 && !!e.image_url,
      is_recurring: e.is_recurring,
      recurrence_label: e.recurrence_label,
    }),
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
): CityPulseSection | null {
  if (input.friendRsvps.length < 2) return null;

  const items: CityPulseItem[] = input.friendRsvps
    .slice(0, 8)
    .map(({ event, friends }) =>
      makeEventItem(event, { friends_going: friends }),
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
): CityPulseSection | null {
  if (events.length < 2) return null;

  const items: CityPulseItem[] = events
    .slice(0, 8)
    .map((e) =>
      makeEventItem(e, { contextual_label: "New from a spot you follow" }),
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
      }),
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
// Browse section (static structure)
// ---------------------------------------------------------------------------

export function buildBrowseSection(
  portalSlug: string,
): CityPulseSection {
  // Browse section is a static category grid + neighborhood links.
  // Items are empty — the frontend renders this from the section type.
  return {
    id: "browse",
    type: "browse",
    title: "Browse",
    subtitle: "Explore by category or neighborhood",
    priority: "tertiary",
    accent_color: "var(--muted)",
    items: [],
    layout: "grid",
    meta: { portal_slug: portalSlug },
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
