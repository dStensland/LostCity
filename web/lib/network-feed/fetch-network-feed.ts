/**
 * Shared query for the portal network feed (external press + blog posts).
 *
 * Both `/api/portals/[slug]/network-feed` and the `TodayInAtlanta` section's
 * manifest loader call this helper directly, so RSC paths don't HTTP-round-
 * trip back into the route.
 */
import { createClient } from "@/lib/supabase/server";
import { getPortalBySlug } from "@/lib/portal";
import { logger } from "@/lib/logger";
import { getOrSetSharedCacheJson } from "@/lib/shared-cache";
import {
  resolveNetworkFeedAccess,
  type NetworkFeedAccessSummary,
} from "@/lib/network-feed-access";

// ── Civic keyword filtering ──────────────────────────────────────────────────

const CIVIC_INCLUDE_KEYWORDS = [
  "government", "council", "vote", "voting", "housing",
  "school", "zoning", "ordinance", "community", "volunteer", "nonprofit",
  "election", "policy", "legislation", "budget", "public safety",
  "neighborhood", "development", "rezoning", "aps", "commission",
  "mayor", "alderman", "city hall", "county", "board", "hearing", "meeting",
  "public comment", "grant", "affordable", "homeless", "shelter",
  "civic", "municipal", "accountability", "transparency",
  "transit", "park", "library", "displacement", "gentrification",
  "immigration", "refugee", "marta", "beltline", "equity",
  "justice", "police", "fire", "ems", "infrastructure",
  "water", "sewer", "education", "affordable", "planning",
];

const CIVIC_EXCLUDE_TITLE_KEYWORDS = [
  "restaurant", "dining", "bar", "cocktail", "hawks", "falcons",
  "braves", "united", "concert", "festival", "nightlife", "recipe",
  "wine", "beer", "chef",
  "draft", "rookie", "quarterback", "playoff", "roster", "mock draft",
  "touchdown", "home run", "nba", "nfl", "mlb", "wnba",
];

function filterCivicPosts(
  posts: Record<string, unknown>[],
): Record<string, unknown>[] {
  return posts.filter((post) => {
    const title = ((post.title as string) || "").toLowerCase();
    const summary = ((post.summary as string) || "").toLowerCase();
    const text = `${title} ${summary}`;
    if (CIVIC_EXCLUDE_TITLE_KEYWORDS.some((kw) => title.includes(kw))) return false;
    return CIVIC_INCLUDE_KEYWORDS.some((kw) => text.includes(kw));
  });
}

export type NetworkSourceRow = {
  id: number;
  name: string;
  slug: string;
  website_url: string | null;
  description: string | null;
  categories: string[] | null;
  portal_id: string | null;
};

export type SourceScope = "all" | "local" | "parent";

export interface FetchNetworkFeedParams {
  portalSlug: string;
  limit?: number;
  offset?: number;
  category?: string | null;
  categories?: string[] | null;
  civicFilter?: boolean;
  sourceScope?: SourceScope;
  includeSources?: boolean;
}

export interface NetworkFeedResult {
  posts: Record<string, unknown>[];
  has_more: boolean;
  sources?: NetworkSourceRow[];
}

export type FetchNetworkFeedOutcome =
  | { ok: true; result: NetworkFeedResult }
  | { ok: false; status: 404 | 500; error: string };

export async function fetchNetworkFeed(
  params: FetchNetworkFeedParams,
): Promise<FetchNetworkFeedOutcome> {
  const {
    portalSlug,
    limit: rawLimit = 15,
    offset: rawOffset = 0,
    category = null,
    categories = null,
    civicFilter = false,
    sourceScope = "all",
    includeSources = false,
  } = params;

  const limit = Math.min(Math.max(rawLimit, 1), 100);
  const offset = Math.max(rawOffset, 0);
  const fetchLimit =
    civicFilter || (categories && categories.length > 0)
      ? Math.min(limit * 4, 100)
      : limit;

  const portal = await getPortalBySlug(portalSlug);
  if (!portal) {
    return { ok: false, status: 404, error: "Portal not found" };
  }

  const supabase = await createClient();

  const feedAccess = await getOrSetSharedCacheJson<NetworkFeedAccessSummary>(
    "network-feed:access",
    portalSlug,
    5 * 60 * 1000,
    async () =>
      resolveNetworkFeedAccess(supabase, {
        id: portal.id,
        slug: portal.slug,
        parent_portal_id: portal.parent_portal_id ?? null,
      }),
    { maxEntries: 50 },
  );

  let accessibleSourcesQuery = supabase
    .from("network_sources")
    .select("id, name, slug, website_url, description, categories, portal_id")
    .eq("is_active", true)
    .order("name");

  if (sourceScope === "local") {
    accessibleSourcesQuery = accessibleSourcesQuery.eq("portal_id", portal.id);
  } else if (sourceScope === "parent") {
    const parentOnlyIds = feedAccess.accessiblePortalIds.filter(
      (id) => id !== portal.id,
    );
    if (parentOnlyIds.length === 0) {
      return {
        ok: true,
        result: includeSources
          ? { posts: [], has_more: false, sources: [] }
          : { posts: [], has_more: false },
      };
    }
    accessibleSourcesQuery = accessibleSourcesQuery.in("portal_id", parentOnlyIds);
  } else {
    accessibleSourcesQuery = accessibleSourcesQuery.in(
      "portal_id",
      feedAccess.accessiblePortalIds,
    );
  }

  const { data: accessibleSources, error: accessibleSourcesError } =
    await accessibleSourcesQuery;

  if (accessibleSourcesError) {
    logger.error("Error fetching accessible network sources:", {
      error: accessibleSourcesError.message,
    });
    return { ok: false, status: 500, error: "Failed to fetch network feed" };
  }

  const accessibleSourceRows = (accessibleSources ?? []) as unknown as NetworkSourceRow[];
  const accessibleSourceIds = accessibleSourceRows.map((row) => row.id);
  if (accessibleSourceIds.length === 0) {
    return {
      ok: true,
      result: includeSources
        ? { posts: [], has_more: false, sources: [] }
        : { posts: [], has_more: false },
    };
  }

  let query = supabase
    .from("network_posts")
    .select(`
      id,
      title,
      url,
      summary,
      author,
      image_url,
      published_at,
      categories,
      source:network_sources!inner(
        name,
        slug,
        website_url,
        categories
      )
    `)
    .in("source_id", accessibleSourceIds)
    .eq("network_sources.is_active", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + fetchLimit - 1);

  if (category) {
    query = query.contains("categories", [category]);
  }

  const { data, error } = await query;

  if (error) {
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      return { ok: true, result: { posts: [], has_more: false } };
    }
    logger.error("Error fetching network feed:", { error: error.message });
    return { ok: false, status: 500, error: "Failed to fetch network feed" };
  }

  let posts = (data ?? []) as Record<string, unknown>[];

  if (civicFilter) {
    posts = filterCivicPosts(posts).slice(0, limit);
  }

  if (categories && categories.length > 0) {
    posts = posts.filter((post) => {
      const postCats = (post.categories as string[] | null) ?? null;
      const source = post.source as { categories?: string[] | null } | null;
      const sourceCats = source?.categories ?? null;
      const effective = postCats ?? sourceCats ?? [];
      return effective.some((c) => categories.includes(c));
    });
  }

  // Dedup by normalized title.
  const seenTitles = new Set<string>();
  posts = posts.filter((post) => {
    const norm = ((post.title as string) || "").toLowerCase().trim();
    if (!norm || seenTitles.has(norm)) return false;
    seenTitles.add(norm);
    return true;
  });

  posts = posts.slice(0, limit);

  return {
    ok: true,
    result: includeSources
      ? { posts, has_more: posts.length === limit, sources: accessibleSourceRows }
      : { posts, has_more: posts.length === limit },
  };
}
