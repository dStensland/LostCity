/**
 * Pipeline stage 2 (fast path): Read event pools from feed_events_ready.
 *
 * Replaces the 4+ complex parallel Supabase queries in fetch-events.ts with a
 * single SELECT on the pre-computed denormalized table. The table is refreshed
 * after every crawl run via refresh_feed_events_ready().
 *
 * Activated when USE_FEED_READY_TABLE=true. All downstream pipeline stages
 * (section building, enrichments, social proof) are unchanged — only the
 * fetch layer is swapped.
 */

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { FeedEventData } from "@/components/EventCard";
import type { PipelineContext } from "./resolve-portal";
import type { EventPools } from "./fetch-events";
import { postProcessEvents } from "./fetch-events";
import { dedupeEventsById, filterOutInactiveVenueEvents } from "@/lib/event-feed-health";
import {
  annotateCanonicalHorizonEvent,
  buildHorizonPoolFilter,
  buildSyntheticFestivalHorizonEvent,
  getPortalHorizonSourceSlugHints,
  type HorizonFestivalRow,
} from "@/lib/city-pulse/horizon-registry";

// ---------------------------------------------------------------------------
// Flat row type from feed_events_ready
// ---------------------------------------------------------------------------

/** Row from feed_events_ready (Deploy 10: venue_* columns renamed to place_*). */
type FeedReadyRow = {
  event_id: number;
  portal_id: string;
  title: string | null;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  is_all_day: boolean | null;
  is_free: boolean | null;
  price_min: number | null;
  price_max: number | null;
  category: string | null;
  genres: string[] | null;
  image_url: string | null;
  featured_blurb: string | null;
  tags: string[] | null;
  festival_id: string | null;
  is_tentpole: boolean | null;
  is_featured: boolean | null;
  series_id: string | null;
  is_recurring: boolean | null;
  source_id: number | null;
  organization_id: string | null;
  importance: string | null;
  data_quality: number | null;
  on_sale_date: string | null;
  presale_date: string | null;
  early_bird_deadline: string | null;
  sellout_risk: string | null;
  attendee_count: number | null;

  // Place fields (renamed from venue_* in Deploy 10)
  place_id: number | null;
  place_name: string | null;
  place_slug: string | null;
  place_neighborhood: string | null;
  place_city: string | null;
  place_type: string | null;
  place_image_url: string | null;
  place_active: boolean | null;

  series_name: string | null;
  series_type: string | null;
  series_slug: string | null;
  cost_tier: string | null;
  duration: string | null;
  significance: string | null;
};

type SeriesAssetRow = {
  id: string;
  image_url: string | null;
  blurhash: string | null;
};

type SourceSlugRow = {
  id: number;
  slug: string;
};

function isMissingSeriesBlurhashError(error: PostgrestError | null | undefined): boolean {
  if (!error || error.code !== "42703") return false;
  return typeof error.message === "string" && error.message.includes("blurhash");
}

// ---------------------------------------------------------------------------
// Reshape flat row → FeedEventData nested structure
// ---------------------------------------------------------------------------

function reshapeToFeedEvent(row: FeedReadyRow): FeedEventData {
  return {
    id: row.event_id,
    title: row.title ?? "",
    start_date: row.start_date,
    start_time: row.start_time,
    end_date: row.end_date,
    end_time: row.end_time,
    is_all_day: row.is_all_day ?? false,
    is_free: row.is_free ?? false,
    price_min: row.price_min,
    price_max: row.price_max,
    category: row.category,
    tags: row.tags,
    genres: row.genres,
    image_url: row.image_url,
    featured_blurb: row.featured_blurb,
    festival_id: row.festival_id,
    is_tentpole: row.is_tentpole ?? false,
    is_featured: row.is_featured ?? false,
    series_id: row.series_id,
    is_recurring: row.is_recurring ?? false,
    importance: row.importance as FeedEventData["importance"],
    venue: row.place_id != null
      ? {
          id: row.place_id,
          name: row.place_name ?? "",
          slug: row.place_slug,
          neighborhood: row.place_neighborhood,
          image_url: row.place_image_url,
          // place_type and place_city are not part of FeedEventData's venue
          // shape but downstream consumers cast via `as unknown as` — the
          // extra properties are harmless and help section builders that do
          // access them via casts (e.g. place_type filtering in build-sections).
          // We spread them in via the cast below.
        }
      : null,
    series: row.series_id
      ? {
          id: row.series_id,
          title: row.series_name ?? "",
          series_type: row.series_type ?? "",
          slug: row.series_slug ?? undefined,
        }
      : null,
  } as FeedEventData;
}

/**
 * Reshape with extra place fields attached (place_type, city, active) so that
 * downstream pipeline stages that cast to extended types still work.
 */
function reshapeWithExtras(row: FeedReadyRow): FeedEventData {
  const base = reshapeToFeedEvent(row);
  if (base.venue && row.place_id != null) {
    (base.venue as Record<string, unknown>).place_type = row.place_type;
    (base.venue as Record<string, unknown>).city = row.place_city;
    (base.venue as Record<string, unknown>).active = row.place_active ?? true;
  }
  // Attach source_id at the event level (used by applySourceDiversity)
  (base as Record<string, unknown>).source_id = row.source_id;
  // Attach taxonomy v2 derived attributes
  (base as Record<string, unknown>).cost_tier = row.cost_tier;
  (base as Record<string, unknown>).duration = row.duration;
  (base as Record<string, unknown>).significance = row.significance;
  return base;
}

function attachSeriesAssets(
  events: FeedEventData[],
  seriesAssetMap: Map<string, SeriesAssetRow>,
): FeedEventData[] {
  for (const event of events) {
    if (!event.series) continue;
    const asset = seriesAssetMap.get(event.series.id);
    if (!asset) continue;
    event.series.image_url = asset.image_url;
    event.series.blurhash = asset.blurhash;
  }
  return events;
}

function attachSourceSlugs(
  events: FeedEventData[],
  sourceSlugMap: Map<number, string>,
): FeedEventData[] {
  return events.map((event) => {
    const sourceId = (event as FeedEventData & { source_id?: number | null }).source_id;
    if (!sourceId) return event;
    const sourceSlug = sourceSlugMap.get(sourceId);
    if (!sourceSlug) return event;
    return { ...event, source_slug: sourceSlug };
  });
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Fetch all three event pools from feed_events_ready.
 *
 * Queries the service client directly (no RLS — the table is pre-filtered and
 * portal-scoped). Returns the same EventPools shape as fetchEventPools() so
 * the rest of the pipeline is unaffected.
 *
 * Three queries run in parallel:
 *  - todayEvents: today only, ordered by data_quality → start_time
 *  - trendingEvents: 2-week window, ordered by is_featured → attendee_count
 *  - horizonEvents: tentpole/festival/flagship, 7–180 days out
 */
export async function fetchEventPoolsFromReady(
  supabase: SupabaseClient,
  ctx: PipelineContext,
): Promise<EventPools> {
  const portalId = ctx.portalData.id;
  const canonicalSourceHints = getPortalHorizonSourceSlugHints(ctx.canonicalSlug);
  const canonicalSourceRows = canonicalSourceHints.length > 0
    ? (
        await supabase
          .from("sources")
          .select("id, slug")
          .in("slug", canonicalSourceHints)
      ).data ?? []
    : [];
  const canonicalSourceIds = canonicalSourceRows
    .map((row) => row.id)
    .filter((id): id is number => Number.isInteger(id));
  const canonicalSourceSlugMap = new Map<number, string>(
    (canonicalSourceRows as SourceSlugRow[]).map((row) => [row.id, row.slug]),
  );

  const [todayResult, trendingResult, horizonResult, festivalResult] = await Promise.all([
    // Today's events — the primary feed pool
    supabase
      .from("feed_events_ready")
      .select("*")
      .eq("portal_id", portalId)
      .eq("start_date", ctx.today)
      .order("data_quality", { ascending: false, nullsFirst: false })
      .order("start_time", { ascending: true, nullsFirst: false })
      .limit(300),

    // Trending: high social proof / featured, 2-week window
    supabase
      .from("feed_events_ready")
      .select("*")
      .eq("portal_id", portalId)
      .gte("start_date", ctx.today)
      .lte("start_date", ctx.twoWeeksAhead)
      .order("is_featured", { ascending: false, nullsFirst: false })
      .order("attendee_count", { ascending: false, nullsFirst: false })
      .order("start_date", { ascending: true })
      .order("data_quality", { ascending: false, nullsFirst: false })
      .limit(20),

    // Planning horizon: tentpoles, festivals, flagship events, 7–180 days ahead
    supabase
      .from("feed_events_ready")
      .select("*")
      .eq("portal_id", portalId)
      .gte("start_date", ctx.horizonStart)
      .lte("start_date", ctx.horizonEnd)
      .or(buildHorizonPoolFilter(canonicalSourceIds))
      .order("importance", { ascending: true })
      .order("start_date", { ascending: true })
      .limit(100),

    supabase
      .from("festivals")
      .select(
        "id, name, slug, description, image_url, website, announced_start, announced_end, pending_start, pending_end, free, primary_type, categories, genres, neighborhood, location",
      )
      .eq("portal_id", portalId)
      .limit(300),
  ]);

  if (todayResult.error) {
    console.error("[feed-ready] todayEvents query failed:", todayResult.error.message, todayResult.error.code);
  }
  if (trendingResult.error) {
    console.error("[feed-ready] trendingEvents query failed:", trendingResult.error.message, trendingResult.error.code);
  }
  if (horizonResult.error) {
    console.error("[feed-ready] horizonEvents query failed:", horizonResult.error.message, horizonResult.error.code);
  }
  if (festivalResult.error) {
    console.error("[feed-ready] horizon festivals query failed:", festivalResult.error.message, festivalResult.error.code);
  }

  const todayRaw = (todayResult.data ?? []) as unknown as FeedReadyRow[];
  const trendingRaw = (trendingResult.data ?? []) as unknown as FeedReadyRow[];
  const horizonRaw = (horizonResult.data ?? []) as unknown as FeedReadyRow[];

  const seriesIds = Array.from(
    new Set(
      [...todayRaw, ...trendingRaw, ...horizonRaw]
        .map((row) => row.series_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );

  const seriesAssetMap = new Map<string, SeriesAssetRow>();
  if (seriesIds.length > 0) {
    let { data: seriesRows, error: seriesError } = await supabase
      .from("series")
      .select("id, image_url, blurhash")
      .in("id", seriesIds);
    if (isMissingSeriesBlurhashError(seriesError)) {
      console.warn(
        "[feed-ready] series.blurhash column missing; using legacy series asset select",
      );
      const fallback = await supabase
        .from("series")
        .select("id, image_url")
        .in("id", seriesIds);
      seriesRows = fallback.data as SeriesAssetRow[] | null;
      seriesError = fallback.error;
    }
    if (seriesError) {
      console.error("[feed-ready] series asset query failed:", seriesError.message, seriesError.code);
    } else {
      for (const row of (seriesRows ?? []) as SeriesAssetRow[]) {
        seriesAssetMap.set(row.id, row);
      }
    }
  }

  const todayEvents = attachSeriesAssets(
    postProcessEvents(todayRaw.map(reshapeWithExtras)),
    seriesAssetMap,
  );
  const trendingEvents = attachSeriesAssets(
    postProcessEvents(trendingRaw.map(reshapeWithExtras)),
    seriesAssetMap,
  );
  const readyHorizonEvents = attachSeriesAssets(
    dedupeEventsById(
      filterOutInactiveVenueEvents(horizonRaw.map(reshapeWithExtras)),
    ),
    seriesAssetMap,
  );
  const annotatedHorizonEvents = attachSourceSlugs(readyHorizonEvents, canonicalSourceSlugMap)
    .map((event) => annotateCanonicalHorizonEvent(event, ctx.canonicalSlug));
  const syntheticFestivalEvents = ((festivalResult.data ?? []) as HorizonFestivalRow[])
    .map((row) => buildSyntheticFestivalHorizonEvent(row, ctx.canonicalSlug))
    .filter((event): event is FeedEventData => {
      if (!event) return false;
      const startDate = event.start_date;
      return startDate >= ctx.horizonStart && startDate <= ctx.horizonEnd;
    });
  const horizonEvents = dedupeEventsById(
    filterOutInactiveVenueEvents([
      ...annotatedHorizonEvents,
      ...syntheticFestivalEvents,
    ]),
  );

  return { todayEvents, trendingEvents, horizonEvents };
}
