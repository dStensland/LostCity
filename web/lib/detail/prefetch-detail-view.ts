"use client";

/**
 * Prefetch overlay-detail-view chunks on card hover/focus so the dynamic
 * chunk is ready by the time the user clicks. Measured overlay-open on a
 * cold chunk is ~600ms in dev (neighborhood baseline) — prefetching moves
 * that cost out of the critical open-click path.
 *
 * Uses the same import specifier as DetailOverlayRouter's `dynamic()` so
 * the bundler dedupes: one fetch, used by both paths.
 */

const importers: Record<string, () => Promise<unknown>> = {
  event: () => import("@/components/views/EventDetailView"),
  spot: () => import("@/components/views/PlaceDetailView"),
  series: () => import("@/components/views/SeriesDetailView"),
  festival: () => import("@/components/views/FestivalDetailView"),
  org: () => import("@/components/views/OrgDetailView"),
  neighborhood: () => import("@/components/views/NeighborhoodDetailView"),
};

const prefetched = new Set<string>();

/**
 * Fire-and-forget prefetch of a detail-view chunk. Idempotent per kind per
 * session — the first call triggers the dynamic import; subsequent calls
 * no-op so repeated hovers don't spam work.
 */
export function prefetchDetailView(kind: string): void {
  if (typeof window === "undefined") return;
  if (prefetched.has(kind)) return;
  const importer = importers[kind];
  if (!importer) return;
  prefetched.add(kind);
  // Swallow failures — prefetch is best-effort. If the chunk fails here, the
  // real dynamic() call will surface the error at click time.
  importer().catch(() => {
    // Allow retry on next hover if the network blipped.
    prefetched.delete(kind);
  });
}
