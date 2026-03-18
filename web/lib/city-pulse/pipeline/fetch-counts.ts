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
 */
export async function fetchFeedCounts(
  supabase: SupabaseClient,
  ctx: PipelineContext,
): Promise<FeedCounts> {
  const [precomputedResult, venueTypeResult] = await Promise.all([
    // Pre-computed category/tab counts (refreshed after each crawl run)
    supabase
      .from("feed_category_counts")
      .select("window, dimension, value, cnt")
      .eq("portal_id", ctx.portalData.id) as unknown as Promise<{
      data: PrecomputedCountRow[] | null;
    }>,

    // Venue type counts for Browse section "Places to Go" tiles
    supabase.rpc("get_venue_type_counts", {
      p_city: ctx.portalCity ?? null,
    } as never) as unknown as Promise<{
      data: { venue_type: string; cnt: number }[] | null;
    }>,
  ]);

  const precomputedRows = (precomputedResult.data || []) as PrecomputedCountRow[];

  const venueTypeCounts: Record<string, number> = {};
  for (const row of (venueTypeResult.data || []) as { venue_type: string; cnt: number }[]) {
    if (row.venue_type) {
      venueTypeCounts[row.venue_type] = row.cnt || 0;
    }
  }

  return { precomputedRows, venueTypeCounts };
}
