import type { CityPulseResponse } from "@/lib/city-pulse/types";

/**
 * Fetch city-pulse feed data server-side.
 * Called from the RSC (page.tsx) to embed feed data in the HTML.
 * Falls back gracefully — returns null on error (client will fetch instead).
 *
 * Next.js dedups this fetch against any in-flight requests for the same URL
 * within the same render pass. The `next: { revalidate: 300 }` option caches
 * the result for 5 minutes (ISR), matching the page-level `revalidate = 300`.
 */
export async function getServerFeedData(
  portalSlug: string,
): Promise<CityPulseResponse | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

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
