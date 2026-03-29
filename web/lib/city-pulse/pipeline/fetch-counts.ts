/**
 * Pipeline stage 3: Count queries.
 *
 * Fetches pre-computed category/tab counts from feed_category_counts and
 * venue type counts for the Browse section. All counts are server-side
 * aggregations — no event payload fetching here.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PipelineContext } from "./resolve-portal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PrecomputedCountRow = {
  window: string;
  dimension: string;
  value: string;
  cnt: number;
  updated_at?: string;
};

export type FeedCounts = {
  precomputedRows: PrecomputedCountRow[];
  venueTypeCounts: Record<string, number>;
};

// ---------------------------------------------------------------------------
// Derived helpers (operate on the fetched rows — no DB access needed)
// ---------------------------------------------------------------------------

/**
 * Build per-category/genre/tag counts for a given time window
 * from the pre-computed summary table rows.
 */
export function buildPrecomputedCategoryCounts(
  rows: PrecomputedCountRow[],
  win: string,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (row.window !== win) continue;
    const key =
      row.dimension === "category"
        ? row.value
        : row.dimension === "genre"
          ? `genre:${row.value}`
          : `tag:${row.value}`;
    counts[key] = row.cnt;
  }
  return counts;
}

/**
 * Sum all category-dimension rows for a given window to get the total
 * event count (used for tab badge numbers).
 */
export function countForWindow(rows: PrecomputedCountRow[], win: string): number {
  let total = 0;
  for (const row of rows) {
    if (row.window === win && row.dimension === "category") total += row.cnt;
  }
  return total;
}

/**
 * Sum category counts across ALL windows from the pre-computed table.
 * Used to populate the Browse section "Places to Go" category tiles.
 */
export function buildAllWindowCategoryCounts(
  rows: PrecomputedCountRow[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (row.dimension === "category") {
      counts[row.value] = (counts[row.value] || 0) + row.cnt;
    }
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Lightweight count query builders (for tab mode)
// ---------------------------------------------------------------------------

/**
 * Build the count-category query used in tab mode.
 * Fetches minimal columns (no full event payload) for fast badge computation.
 */
export function buildCountCategoryQuery(
  portalClient: SupabaseClient,
  ctx: PipelineContext,
  start: string,
  end: string,
) {
  let q = portalClient
    .from("events")
    .select("title, category_id, series_id, is_recurring, genres, tags")
    .gte("start_date", start)
    .lte("start_date", end)
    .is("canonical_event_id", null)
    .or("is_class.eq.false,is_class.is.null")
    .or("is_sensitive.eq.false,is_sensitive.is.null")
    .neq("category_id", "film")
    .not("tags", "cs", '{"activism"}');
  // Apply portal scope
  q = ctx.applyPortalScope(q);
  return q;
}

// ---------------------------------------------------------------------------
// Stage function
// ---------------------------------------------------------------------------

/**
 * Fetch all count data for the full (initial) load.
 * Returns pre-computed count rows and venue type counts.
 *
 * Fallback: if the pre-computed table is empty or missing (migration 583
 * not yet applied, or refresh_feed_counts() hasn't been called), compute
 * counts on-the-fly from live event queries.
 */
export async function fetchFeedCounts(
  supabase: SupabaseClient,
  ctx: PipelineContext,
  portalClient?: SupabaseClient,
): Promise<FeedCounts> {
  const scopedClient = portalClient ?? supabase;

  const [precomputedResult, venueTypeResult] = await Promise.all([
    // Pre-computed category/tab counts (refreshed after each crawl run)
    supabase
      .from("feed_category_counts")
      .select("window, dimension, value, cnt, updated_at")
      .eq("portal_id", ctx.portalData.id) as unknown as Promise<{
      data: PrecomputedCountRow[] | null;
      error: unknown;
    }>,

    // Venue type counts for Browse section "Places to Go" tiles
    supabase.rpc("get_venue_type_counts", {
      p_city: ctx.portalCity ?? null,
    } as never) as unknown as Promise<{
      data: { place_type: string; cnt: number }[] | null;
    }>,
  ]);

  let precomputedRows = (precomputedResult.data || []) as PrecomputedCountRow[];

  // Staleness check: fall back if counts are older than 6 hours.
  // The refresh_feed_counts() RPC sets updated_at on all rows after each crawl.
  // If the post-crawl maintenance script failed, counts go stale indefinitely.
  const STALE_THRESHOLD_MS = 6 * 60 * 60 * 1000;
  const isStale =
    precomputedRows.length > 0 &&
    precomputedRows[0].updated_at != null &&
    Date.now() - new Date(precomputedRows[0].updated_at).getTime() > STALE_THRESHOLD_MS;

  // Fallback: if precomputed table is empty/missing or counts are stale, compute from live queries
  if (precomputedRows.length === 0 || isStale) {
    const [todayResult, weekResult, comingResult] = await Promise.all([
      buildCountCategoryQuery(scopedClient, ctx, ctx.today, ctx.today),
      buildCountCategoryQuery(scopedClient, ctx, ctx.tomorrow, ctx.weekAhead),
      buildCountCategoryQuery(scopedClient, ctx, ctx.weekAhead, ctx.fourWeeksAhead),
    ]);

    type CountRow = { category_id: string | null };
    const buildRows = (data: CountRow[] | null, window: string): PrecomputedCountRow[] => {
      const counts: Record<string, number> = {};
      for (const row of data || []) {
        if (row.category_id) counts[row.category_id] = (counts[row.category_id] || 0) + 1;
      }
      return Object.entries(counts).map(([value, cnt]) => ({
        window,
        dimension: "category",
        value,
        cnt,
      }));
    };

    precomputedRows = [
      ...buildRows(todayResult.data as CountRow[] | null, "today"),
      ...buildRows(weekResult.data as CountRow[] | null, "week"),
      ...buildRows(comingResult.data as CountRow[] | null, "coming_up"),
    ];
  }

  const venueTypeCounts: Record<string, number> = {};
  for (const row of (venueTypeResult.data || []) as { place_type: string; cnt: number }[]) {
    if (row.place_type) {
      venueTypeCounts[row.place_type] = row.cnt || 0;
    }
  }

  return { precomputedRows, venueTypeCounts };
}
