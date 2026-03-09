/**
 * Feed Quality Gate — shared filter for all event queries that serve UI.
 *
 * Adds `.or('is_feed_ready.eq.true,is_feed_ready.is.null')` to Supabase
 * queries. The `IS NULL` fallback handles events inserted before the
 * is_feed_ready column/trigger was deployed (backward compat).
 *
 * Usage:
 *   import { applyFeedGate } from "@/lib/feed-gate";
 *   query = applyFeedGate(query);
 *
 * NOT applied to: event detail pages, admin views, crawler logs.
 *
 * See PRD 027 for the full quality gate design.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyFeedGate<T extends { or: (...args: any[]) => any }>(query: T): T {
  return query
    .or("is_feed_ready.eq.true,is_feed_ready.is.null");
}

/**
 * Lighter gate for venue detail pages and the Regulars tab.
 *
 * Passes events that are either:
 *   - feed-ready (full quality events), OR
 *   - regular-ready (recurring hangs: has series, time, real source)
 *
 * Regular hangs have lighter criteria than feed events — accuracy and
 * confidence matter more than depth. "Karaoke Night at 9pm" with a
 * venue homepage link is fine. But junk titles, missing times, and
 * aggregator URLs are filtered.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyVenueGate<T extends { or: (...args: any[]) => any }>(query: T): T {
  return query
    .or("is_feed_ready.eq.true,is_feed_ready.is.null,is_regular_ready.eq.true");
}
