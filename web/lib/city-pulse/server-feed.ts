import type { CityPulseResponse } from "@/lib/city-pulse/types";
import { getSharedCacheJson } from "@/lib/shared-cache";
import { getTimeSlot, getPortalHour, getPortalDateString } from "@/lib/city-pulse/time-slots";
import { normalizePortalSlug, resolvePortalSlugAlias } from "@/lib/portal-aliases";

const CACHE_NAMESPACE = "api:city-pulse";

/**
 * Fetch city-pulse feed data server-side.
 *
 * Strategy: read directly from the shared cache that the API route populates.
 * This avoids an HTTP round-trip back to ourselves during SSR. On a cache hit
 * (the common case — the API route fills the cache on first request), the page
 * renders immediately from in-process memory with zero network overhead.
 *
 * Falls back to the HTTP route on cache miss so the pipeline runs and populates
 * the cache for subsequent requests. Client hydration also refetches, so a miss
 * here is not catastrophic — it just means the first render has no prefetched data.
 *
 * Cache key format mirrors the API route's anonymous key:
 *   `${canonicalSlug}|${timeSlot}|${today}`
 */
export async function getServerFeedData(
  portalSlug: string,
): Promise<CityPulseResponse | null> {
  try {
    // Compute the same cache key the API route uses for anonymous requests.
    const now = new Date();
    const portalH = getPortalHour(now);
    const timeSlot = getTimeSlot(portalH);
    // Late-night before 5 AM counts as the previous day
    const effectiveNow = portalH < 5 ? new Date(now.getTime() - 86_400_000) : now;
    const today = getPortalDateString(effectiveNow);
    const canonicalSlug = resolvePortalSlugAlias(normalizePortalSlug(portalSlug));
    const cacheKey = `${canonicalSlug}|${timeSlot}|${today}`;

    // Try direct cache read first — avoids HTTP round-trip on hit
    const cached = await getSharedCacheJson<CityPulseResponse>(
      CACHE_NAMESPACE,
      cacheKey,
    );
    if (cached) return cached;

    // Cache miss — fall back to HTTP route (which will populate the cache)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("server-feed-timeout"), 8000);

    const res = await fetch(
      `${baseUrl}/api/portals/${portalSlug}/city-pulse`,
      {
        signal: controller.signal,
        next: { revalidate: 300 },
      },
    );
    clearTimeout(timeout);

    if (!res.ok) return null;
    return await res.json() as CityPulseResponse;
  } catch {
    // Graceful fallback — client will fetch on hydration
    return null;
  }
}
