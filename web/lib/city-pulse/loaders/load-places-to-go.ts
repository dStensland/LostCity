/**
 * Server loader for the PlacesToGo feed section.
 *
 * Fetches the category tile payload the client would request on mount and
 * feeds it to the section as initialData, skipping the client fetch.
 */
import { logger } from "@/lib/logger";
import type { PlacesToGoResponse } from "@/lib/places-to-go/types";
import type { FeedSectionContext } from "../feed-section-contract";

export async function loadPlacesToGoForFeed(
  ctx: FeedSectionContext,
): Promise<PlacesToGoResponse | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort("load-places-to-go-timeout"),
    8000,
  );

  try {
    const res = await fetch(
      `${baseUrl}/api/portals/${encodeURIComponent(ctx.portalSlug)}/city-pulse/places-to-go`,
      { signal: controller.signal, next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    return (await res.json()) as PlacesToGoResponse;
  } catch (err) {
    logger.error("load-places-to-go failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
