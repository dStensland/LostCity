import { getSharedCacheJson } from "@/lib/shared-cache";
import { getCachedPortalBySlug } from "@/lib/portal";
import type { FeedEventData } from "@/components/EventCard";

const CACHE_NAMESPACE = "api:regulars";
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 min — must match the API route

/**
 * Fetch regulars data server-side.
 *
 * Strategy: read directly from the shared cache that the API route populates.
 * This avoids an HTTP round-trip back to ourselves during SSR. On a cache hit
 * (the common case — the API route fills the cache on first request), the page
 * renders immediately from in-process memory with zero network overhead.
 *
 * Falls back to the HTTP route on cache miss so the pipeline runs and populates
 * the cache for subsequent requests. Client hydration skips the fetch when
 * initialData is provided, so a miss here is not catastrophic — the client will
 * re-fetch on hydration.
 *
 * Cache key format mirrors the API route's key (no weekday filter, 7-day range):
 *   `${portalId}|${portalCity}|all-days|7|${cacheBucket}`
 */
export async function getServerRegularsData(
  portalSlug: string,
): Promise<{ events: FeedEventData[] } | null> {
  try {
    const portal = await getCachedPortalBySlug(portalSlug);
    if (!portal) return null;

    // For the SSR prefetch we always use the non-exclusive path (portal_exclusive=false
    // is the default), which means portalCity comes from the portal's own filters.
    // This matches the client-side fetch: /api/regulars?portal=<slug> (no portal_exclusive param).
    const portalCity = portal.filters?.city ?? "all-cities";

    // cacheBucket mirrors the API route's computation:
    //   Math.floor(Date.now() / CACHE_TTL_MS)
    const cacheBucket = Math.floor(Date.now() / CACHE_TTL_MS);

    const cacheKey = [
      portal.id,
      portalCity,
      "all-days", // no weekday filter — client handles weekday filtering
      "7",        // default 7-day range
      cacheBucket,
    ].join("|");

    // Try direct cache read first — avoids HTTP round-trip on hit
    const cached = await getSharedCacheJson<{ events: FeedEventData[] }>(
      CACHE_NAMESPACE,
      cacheKey,
    );
    if (cached) return cached;

    // Cache miss — fall back to HTTP route (which will populate the cache)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(
      `${baseUrl}/api/regulars?portal=${encodeURIComponent(portalSlug)}`,
      {
        signal: controller.signal,
        next: { revalidate: 180 },
      },
    );
    clearTimeout(timeout);

    if (!res.ok) return null;
    return (await res.json()) as { events: FeedEventData[] };
  } catch {
    // Graceful fallback — client will fetch on hydration
    return null;
  }
}
