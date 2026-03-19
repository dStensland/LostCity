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

/** Standard post-processing: dedupe → filter inactive venues → suppress bad images */
export function postProcessEvents(raw: FeedEventData[]): FeedEventData[] {
  return dedupeEventsById(
    filterOutInactiveVenueEvents(
      suppressEventImagesIfVenueFlagged(raw) as FeedEventData[],
    ),
  );
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
 */
export function buildEventQuery(
  portalClient: SupabaseClient,
  ctx: PipelineContext,
  start: string,
  end: string,
  limit: number,
) {
  let q = portalClient
    .from("events")
    .select(EVENT_SELECT)
    .gte("start_date", start)
    .lte("start_date", end)
    .is("canonical_event_id", null)
    .or("is_class.eq.false,is_class.is.null")
    .or("is_sensitive.eq.false,is_sensitive.is.null")
    .neq("category_id", "film");
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
 */
export function buildInterestQueries(
  portalClient: SupabaseClient,
  ctx: PipelineContext,
  start: string,
  end: string,
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
      .or("is_sensitive.eq.false,is_sensitive.is.null");

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
  const [todayResult, eveningResult, trendingResult, horizonResult] =
    await Promise.all([
      // Main today pool (up to 300 events covering all categories)
      buildEventQuery(portalClient, ctx, ctx.today, ctx.today, 300),

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
          .or("is_sensitive.eq.false,is_sensitive.is.null");
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
          .or("is_sensitive.eq.false,is_sensitive.is.null");
        q = ctx.applyPortalScope(q);
        return q
          .order("is_featured", { ascending: false, nullsFirst: false })
          .order("attendee_count", { ascending: false, nullsFirst: false })
          .order("start_date", { ascending: true })
          .order("data_quality", { ascending: false, nullsFirst: false })
          .limit(20);
      })(),

      // Planning horizon: flagship/major events, 7–180 days ahead
      (() => {
        let q = portalClient
          .from("events")
          .select(EVENT_SELECT)
          .in("importance", ["flagship", "major"])
          .gte("start_date", ctx.horizonStart)
          .lte("start_date", ctx.horizonEnd)
          .eq("is_active", true)
          .is("canonical_event_id", null)
          .neq("category_id", "tours")
          .not("category_id", "in", "(sports,recreation)")
          .neq("category_id", "unknown")
          .neq("is_class", true);
        q = ctx.applyPortalScope(q);
        return q
          .order("importance", { ascending: true })
          .order("start_date", { ascending: true })
          .limit(100);
      })(),
    ]);

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

  return {
    todayEvents: postProcessEvents(todayRaw),
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
  const [baseResult, interestResults] = await Promise.all([
    buildEventQuery(portalClient, ctx, tabStart, tabEnd, 500),
    Promise.all(buildInterestQueries(portalClient, ctx, tabStart, tabEnd)),
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
    .order("start_date", { ascending: true })
    .order("data_quality", { ascending: false, nullsFirst: false })
    .limit(10);

  return postProcessEvents((followedEvents || []) as unknown as FeedEventData[]);
}
