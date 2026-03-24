/**
 * Pipeline stage 2: Event pool queries.
 *
 * Fetches all event pools needed by the City Pulse feed. Exports the shared
 * EVENT_SELECT constant and query-builder helpers so they can be reused for
 * tab mode and per-interest supplemental fetches.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedEventData } from "@/components/EventCard";
import type { PipelineContext } from "./resolve-portal";
import { applyFeedGate } from "@/lib/feed-gate";
import { getInterestQueryConfig } from "@/lib/city-pulse/interests";
import {
  dedupeEventsById,
  filterOutInactiveVenueEvents,
} from "@/lib/event-feed-health";
import { suppressEventImagesIfVenueFlagged } from "@/lib/image-quality-suppression";
import { getOrSetSharedCacheJson } from "@/lib/shared-cache";

// ---------------------------------------------------------------------------
// Shared event SELECT (mirrors the route constant — single source of truth)
// ---------------------------------------------------------------------------

export const EVENT_SELECT = `
  id, title, start_date, start_time, end_date, end_time,
  is_all_day, is_free, price_min, price_max,
  category:category_id, genres, image_url, featured_blurb,
  tags, festival_id, is_tentpole, is_featured, series_id, is_recurring, source_id, organization_id,
  importance, on_sale_date, presale_date, early_bird_deadline, sellout_risk,
  ticket_status, ticket_status_checked_at, ticket_url, source_url,
  series:series_id(id, frequency, day_of_week, series_type),
  venue:venues(id, name, neighborhood, slug, venue_type, location_designator, city, image_url, active)
`;

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export type EventPools = {
  /** Today's events (merged with evening supplemental), post-processed */
  todayEvents: FeedEventData[];
  /** Trending events (2-week window, high social proof / featured), post-processed */
  trendingEvents: FeedEventData[];
  /** Planning horizon events (flagship/major, 7–180 days out) */
  horizonEvents: FeedEventData[];
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Filter out registration-code events (USTA/ALTA tennis league entries).
 *
 * These events have titles like "USTA Adult5 Lines (BFP26103)" — league
 * registration entries that sneak through category filters because they're
 * tagged as "sports". They're not public events worth surfacing in discovery.
 */
const REGISTRATION_TITLE_PATTERNS = [
  /\([A-Z0-9]{5,}\)/, // Parenthetical codes like (BFP26103)
  /^USTA\s/,          // USTA league entries
  /^ALTA\s/,          // ALTA league entries
];

function filterRegistrationEvents(events: FeedEventData[]): FeedEventData[] {
  return events.filter(
    (e) => !REGISTRATION_TITLE_PATTERNS.some((p) => p.test(e.title)),
  );
}

/** Standard post-processing: dedupe → filter inactive venues → suppress bad images → filter registration noise */
export function postProcessEvents(raw: FeedEventData[]): FeedEventData[] {
  return filterRegistrationEvents(
    dedupeEventsById(
      filterOutInactiveVenueEvents(
        suppressEventImagesIfVenueFlagged(raw) as FeedEventData[],
      ),
    ),
  );
}

/**
 * Apply source diversity to an event pool.
 *
 * When a single source_id dominates (e.g., HOA's 467 shifts drowning out
 * government meetings in HelpATL), this reorders the pool so no single source
 * accounts for more than `maxSourceFraction` of the total items.
 *
 * Excess items from over-represented sources are moved to the END of the list
 * rather than removed — comprehensive coverage is preserved, just not at the
 * top. Ordering within each source group is unchanged.
 *
 * Only applies when the pool has at least `minItems` entries — small sections
 * are not artificially reordered.
 *
 * @param events  Ordered event array to rebalance
 * @param maxSourceFraction  Max share any single source may hold (default 0.4)
 * @param minItems  Minimum pool size to trigger rebalancing (default 10)
 */
export function applySourceDiversity(
  events: FeedEventData[],
  maxSourceFraction = 0.4,
  minItems = 10,
): FeedEventData[] {
  if (events.length < minItems) return events;

  // Count events per source_id (null source_id treated as its own group)
  const sourceCounts = new Map<string, number>();
  for (const event of events) {
    const sid = String(
      (event as unknown as { source_id?: number | null }).source_id ?? "null",
    );
    sourceCounts.set(sid, (sourceCounts.get(sid) ?? 0) + 1);
  }

  const cap = Math.floor(events.length * maxSourceFraction);

  // Identify which sources are over-represented
  const overRepresented = new Set<string>();
  for (const [sid, count] of sourceCounts) {
    if (count > cap) overRepresented.add(sid);
  }

  // If no source is over-represented, nothing to do
  if (overRepresented.size === 0) return events;

  // Partition: primary (within cap) + overflow (excess from over-represented sources)
  const sourceSeen = new Map<string, number>();
  const primary: FeedEventData[] = [];
  const overflow: FeedEventData[] = [];

  for (const event of events) {
    const sid = String(
      (event as unknown as { source_id?: number | null }).source_id ?? "null",
    );
    const seen = sourceSeen.get(sid) ?? 0;
    if (overRepresented.has(sid) && seen >= cap) {
      overflow.push(event);
    } else {
      primary.push(event);
      sourceSeen.set(sid, seen + 1);
    }
  }

  return [...primary, ...overflow];
}

// ---------------------------------------------------------------------------
// Civic intent filter (HelpATL / community vertical)
// ---------------------------------------------------------------------------

/**
 * Tags that indicate an event has genuine civic intent.
 * Any one of these causes the event to pass the filter.
 */
const CIVIC_SIGNAL_TAGS = new Set([
  "volunteer",
  "government",
  "public-meeting",
  "civic-engagement",
  "advocacy",
  "school-board",
  "npu",
  "zoning",
  "volunteer-outdoors",
  "education",
  "public-comment",
  "civic",
  "election",
  "voter-registration",
  "transit",
  "food-security",
  "housing",
  "environment",
  "health",
  "marta-army",
  "mutual-aid",
  "town-hall",
  "activism",
  "mobilize",
  "land-use",
  "urban-planning",
  "design-review",
  "trees",
  "planning",
]);

/**
 * Tags that signal the event is entertainment rather than civic activity.
 * Any one of these causes a community-category event to be rejected
 * (unless it also has a civic signal tag, which takes precedence).
 */
const ENTERTAINMENT_SIGNAL_TAGS = new Set([
  "viewing-party",
  "happy-hour",
  "bar-games",
  "karaoke",
  "brunch",
  "nightlife",
  "trivia",
  "dj",
  "drag",
  "bar-poker",
  "freeroll",
]);

/**
 * Filter community-category events for civic intent.
 *
 * Applied only on community-vertical portals (HelpATL). Non-community
 * category events always pass. Community-category events are scored:
 * - Has a civic signal tag → pass
 * - Has an entertainment signal tag (and no civic override) → reject
 * - No signal either way → pass (benefit of the doubt)
 *
 * This removes watch parties and bar events mislabeled as "community"
 * while preserving actual volunteer shifts, government meetings, and
 * civic engagement events.
 */
export function filterCivicIntent(events: FeedEventData[]): FeedEventData[] {
  return events.filter((event) => {
    // Non-community categories always pass (portal scope already handles them)
    if (event.category !== "community") return true;

    const tags = event.tags as string[] | null;

    // Has a civic signal tag → always pass
    if (tags?.some((t) => CIVIC_SIGNAL_TAGS.has(t))) return true;

    // Has an entertainment signal tag → reject
    if (tags?.some((t) => ENTERTAINMENT_SIGNAL_TAGS.has(t))) return false;

    // No signal either way → benefit of the doubt
    return true;
  });
}

/** Merge a base event array with per-interest supplemental results, deduplicating by ID */
export function mergeEventPools(
  base: FeedEventData[],
  interestResults: Array<{ data: FeedEventData[] | null }>,
): FeedEventData[] {
  const seenIds = new Set(base.map((e) => e.id));
  const extras: FeedEventData[] = [];
  for (const r of interestResults) {
    for (const e of (r.data || []) as FeedEventData[]) {
      if (!seenIds.has(e.id)) {
        seenIds.add(e.id);
        extras.push(e);
      }
    }
  }
  return [...base, ...extras];
}

// ---------------------------------------------------------------------------
// Query builders
// ---------------------------------------------------------------------------

/**
 * Base event query: date-bounded, feed-gated, portal-scoped.
 * Ordered by start_date → data_quality → start_time.
 *
 * @param excludeSourceIds  Optional list of source IDs to exclude from the
 *   curated feed (e.g. YMCA branches whose events are classes/programming that
 *   haven't been tagged with is_class=true yet). Short-term bridge until the
 *   upstream crawlers set is_class correctly.
 */
export function buildEventQuery(
  portalClient: SupabaseClient,
  ctx: PipelineContext,
  start: string,
  end: string,
  limit: number,
  excludeSourceIds: number[] = [],
) {
  let q = portalClient
    .from("events")
    .select(EVENT_SELECT)
    .gte("start_date", start)
    .lte("start_date", end)
    .is("canonical_event_id", null)
    .or("is_class.eq.false,is_class.is.null")
    .or("is_sensitive.eq.false,is_sensitive.is.null")
    .neq("category_id", "film")
    .not("category_id", "in", "(recreation,unknown,support_group,religious)");
  if (excludeSourceIds.length > 0) {
    q = q.not("source_id", "in", `(${excludeSourceIds.join(",")})`);
  }
  q = applyFeedGate(q);
  q = ctx.applyPortalScope(q);
  return q
    .order("start_date", { ascending: true })
    .order("data_quality", { ascending: false, nullsFirst: false })
    .order("start_time", { ascending: true })
    .limit(limit);
}

/**
 * Per-interest supplemental queries — 6 events per active interest chip.
 * Returns an array of promises (one per active chip with a valid config).
 *
 * @param excludeSourceIds  Source IDs to suppress (mirrors buildEventQuery).
 */
export function buildInterestQueries(
  portalClient: SupabaseClient,
  ctx: PipelineContext,
  start: string,
  end: string,
  excludeSourceIds: number[] = [],
): Array<Promise<{ data: FeedEventData[] | null }>> {
  const PER_INTEREST_LIMIT = 6;
  const queries: Array<Promise<{ data: FeedEventData[] | null }>> = [];
  for (const chipId of ctx.requestedInterests) {
    const config = getInterestQueryConfig(chipId);
    if (!config) continue;

    let q = portalClient
      .from("events")
      .select(EVENT_SELECT)
      .gte("start_date", start)
      .lte("start_date", end)
      .is("canonical_event_id", null)
      .or("is_class.eq.false,is_class.is.null")
      .or("is_sensitive.eq.false,is_sensitive.is.null")
      .not("category_id", "in", "(recreation,unknown,support_group,religious)");
    if (excludeSourceIds.length > 0) {
      q = q.not("source_id", "in", `(${excludeSourceIds.join(",")})`);
    }

    if (config.type === "category") {
      q = q.eq("category_id", config.categoryId);
    } else {
      q = q.or(config.filter);
    }

    q = ctx.applyPortalScope(q);
    queries.push(
      q
        .order("start_date", { ascending: true })
        .order("data_quality", { ascending: false, nullsFirst: false })
        .order("start_time", { ascending: true })
        .limit(PER_INTEREST_LIMIT) as unknown as Promise<{ data: FeedEventData[] | null }>,
    );
  }
  return queries;
}

// ---------------------------------------------------------------------------
// YMCA source ID cache
// ---------------------------------------------------------------------------

/**
 * Returns YMCA source IDs, cached for 1 hour.
 *
 * YMCA source IDs are stable configuration data — they only change when a new
 * YMCA branch source is added (very rare). Caching eliminates a serial DB hop
 * before every cold feed load and every tab fetch.
 */
async function getYmcaSourceIds(supabase: SupabaseClient): Promise<number[]> {
  return getOrSetSharedCacheJson<number[]>(
    "feed-config",
    "ymca-source-ids",
    60 * 60 * 1000, // 1 hour TTL
    async () => {
      const { data } = await supabase
        .from("sources")
        .select("id")
        .ilike("slug", "ymca%");
      return (data ?? []).map((r: { id: number }) => r.id);
    },
  );
}

// ---------------------------------------------------------------------------
// Full load stage
// ---------------------------------------------------------------------------

/**
 * Fetch all event pools for the initial (full) load in a single Promise.all.
 * Returns post-processed event arrays ready for section building.
 */
export async function fetchEventPools(
  portalClient: SupabaseClient,
  ctx: PipelineContext,
): Promise<EventPools> {
  // Look up YMCA source IDs to exclude from the curated feed.
  // The YMCA crawler produces fitness/sports events that are really scheduled
  // classes — not public events worth surfacing in discovery. This is a
  // short-term bridge until the crawler sets is_class=true on these events.
  const ymcaSourceIds = await getYmcaSourceIds(portalClient);

  const [todayResult, eveningResult, trendingResult, horizonResult] =
    await Promise.all([
      // Main today pool (up to 300 events covering all categories)
      buildEventQuery(portalClient, ctx, ctx.today, ctx.today, 300, ymcaSourceIds),

      // Evening supplemental: ensures Tonight section has events even when
      // the main today query's LIMIT is filled by morning/afternoon events
      (() => {
        let q = portalClient
          .from("events")
          .select(EVENT_SELECT)
          .eq("start_date", ctx.today)
          .gte("start_time", "17:00:00")
          .is("canonical_event_id", null)
          .or("is_class.eq.false,is_class.is.null")
          .or("is_sensitive.eq.false,is_sensitive.is.null")
          .not("category_id", "in", "(recreation,unknown,support_group,religious)");
        if (ymcaSourceIds.length > 0) {
          q = q.not("source_id", "in", `(${ymcaSourceIds.join(",")})`);
        }
        q = ctx.applyPortalScope(q);
        return q
          .order("start_time", { ascending: true })
          .order("data_quality", { ascending: false, nullsFirst: false })
          .limit(30);
      })(),

      // Trending: high social proof / featured, 2-week window
      (() => {
        let q = portalClient
          .from("events")
          .select(EVENT_SELECT)
          .gte("start_date", ctx.today)
          .lte("start_date", ctx.twoWeeksAhead)
          .is("canonical_event_id", null)
          .or("is_class.eq.false,is_class.is.null")
          .or("is_sensitive.eq.false,is_sensitive.is.null")
          .not("category_id", "in", "(recreation,unknown,support_group,religious)");
        if (ymcaSourceIds.length > 0) {
          q = q.not("source_id", "in", `(${ymcaSourceIds.join(",")})`);
        }
        q = ctx.applyPortalScope(q);
        return q
          .order("is_featured", { ascending: false, nullsFirst: false })
          .order("attendee_count", { ascending: false, nullsFirst: false })
          .order("start_date", { ascending: true })
          .order("data_quality", { ascending: false, nullsFirst: false })
          .limit(20);
      })(),

      // Planning horizon: tentpoles, festivals, and flagship events, 7–180 days ahead
      // NOTE: This pool has its own category exclusions — do not modify them here.
      (() => {
        let q = portalClient
          .from("events")
          .select(EVENT_SELECT)
          .or("is_tentpole.eq.true,festival_id.not.is.null,importance.eq.flagship")
          .gte("start_date", ctx.horizonStart)
          .lte("start_date", ctx.horizonEnd)
          .eq("is_active", true)
          .is("canonical_event_id", null)
          .neq("category_id", "tours")
          .not("category_id", "in", "(sports,recreation,support_group,religious)")
          .neq("category_id", "unknown")
          .neq("is_class", true);
        q = ctx.applyPortalScope(q);
        return q
          .order("importance", { ascending: true })
          .order("start_date", { ascending: true })
          .limit(100);
      })(),
    ]);

  // Log query errors — these were previously silently swallowed, causing
  // the entire lineup to disappear with no indication of what went wrong.
  if (todayResult.error) {
    console.error("[city-pulse] todayEvents query failed:", todayResult.error.message, todayResult.error.code);
  }
  if (eveningResult.error) {
    console.error("[city-pulse] eveningEvents query failed:", eveningResult.error.message, eveningResult.error.code);
  }
  if (trendingResult.error) {
    console.error("[city-pulse] trendingEvents query failed:", trendingResult.error.message, trendingResult.error.code);
  }
  if (horizonResult.error) {
    console.error("[city-pulse] horizonEvents query failed:", horizonResult.error.message, horizonResult.error.code);
  }

  // Merge today + evening, deduplicating by ID
  const todayRaw = (todayResult.data || []) as unknown as FeedEventData[];
  const eveningRaw = (eveningResult.data || []) as unknown as FeedEventData[];
  const seenIds = new Set(todayRaw.map((e) => e.id));
  for (const e of eveningRaw) {
    if (!seenIds.has(e.id)) {
      seenIds.add(e.id);
      todayRaw.push(e);
    }
  }

  // Apply civic intent filter for community-vertical portals (e.g. HelpATL).
  // Removes entertainment events mislabeled as "community" (watch parties, bar events).
  const isCivicPortal = ctx.manifest.vertical === "community";
  let processedTodayRaw = todayRaw;
  if (isCivicPortal) {
    processedTodayRaw = filterCivicIntent(todayRaw);
  }

  return {
    todayEvents: postProcessEvents(applySourceDiversity(processedTodayRaw)),
    trendingEvents: postProcessEvents((trendingResult.data || []) as unknown as FeedEventData[]),
    horizonEvents: dedupeEventsById(
      filterOutInactiveVenueEvents((horizonResult.data || []) as unknown as FeedEventData[]),
    ),
  };
}

// ---------------------------------------------------------------------------
// Tab mode: events for a single tab window
// ---------------------------------------------------------------------------

/**
 * Fetch events for a single tab (this_week or coming_up).
 * Merges per-interest results to guarantee category representation.
 */
export async function fetchTabEventPool(
  portalClient: SupabaseClient,
  ctx: PipelineContext,
  tabStart: string,
  tabEnd: string,
): Promise<FeedEventData[]> {
  // Mirror the YMCA exclusion from fetchEventPools so tab views are consistent.
  const ymcaSourceIds = await getYmcaSourceIds(portalClient);

  const [baseResult, interestResults] = await Promise.all([
    buildEventQuery(portalClient, ctx, tabStart, tabEnd, 500, ymcaSourceIds),
    Promise.all(buildInterestQueries(portalClient, ctx, tabStart, tabEnd, ymcaSourceIds)),
  ]);

  const base = (baseResult.data || []) as unknown as FeedEventData[];
  const merged = mergeEventPools(base, interestResults);
  return postProcessEvents(merged);
}

// ---------------------------------------------------------------------------
// Followed-spots events (authenticated only, secondary query)
// ---------------------------------------------------------------------------

/**
 * Fetch events from venues the user follows.
 * Fires after userSignals are available — pass followedVenueIds directly.
 */
export async function fetchNewFromSpots(
  portalClient: SupabaseClient,
  ctx: PipelineContext,
  followedVenueIds: number[],
): Promise<FeedEventData[]> {
  if (!ctx.userId || followedVenueIds.length === 0) return [];

  const { data: followedEvents } = await portalClient
    .from("events")
    .select(EVENT_SELECT)
    .gte("start_date", ctx.today)
    .lte("start_date", ctx.twoWeeksAhead)
    .in("venue_id", followedVenueIds.slice(0, 50))
    .is("canonical_event_id", null)
    .or("is_class.eq.false,is_class.is.null")
    .or("is_sensitive.eq.false,is_sensitive.is.null")
    .not("category_id", "in", "(recreation,unknown,support_group,religious)")
    .order("start_date", { ascending: true })
    .order("data_quality", { ascending: false, nullsFirst: false })
    .limit(10);

  return postProcessEvents((followedEvents || []) as unknown as FeedEventData[]);
}
