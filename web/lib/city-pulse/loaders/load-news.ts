/**
 * Server loader for the "Today in Atlanta" network-feed section.
 *
 * Fetches the same no-filter payload the client component requests on mount
 * (`/api/portals/<slug>/network-feed?limit=60`) so the section can render
 * server-side and skip the client fetch. Mirrors the HTTP-fallback pattern in
 * `lib/server-regulars.ts`.
 */
import { logger } from "@/lib/logger";
import type { FeedSectionContext } from "../feed-section-contract";
import type { NetworkPost } from "@/components/feed/sections/NetworkFeedSection";

export interface NewsFeedData {
  posts: NetworkPost[];
}

export async function loadNewsForFeed(
  ctx: FeedSectionContext,
): Promise<NewsFeedData | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("load-news-timeout"), 8000);

  try {
    const res = await fetch(
      `${baseUrl}/api/portals/${encodeURIComponent(ctx.portalSlug)}/network-feed?limit=60`,
      { signal: controller.signal, next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { posts?: NetworkPost[] };
    const seen = new Set<string>();
    const posts = (body.posts ?? []).filter((p) => {
      const norm = p.title.toLowerCase().trim();
      if (!norm || seen.has(norm)) return false;
      seen.add(norm);
      return true;
    });
    return { posts };
  } catch (err) {
    logger.error("load-news failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
