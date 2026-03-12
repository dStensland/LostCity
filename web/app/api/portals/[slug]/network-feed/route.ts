import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPortalBySlug } from "@/lib/portal";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { getOrSetSharedCacheJson } from "@/lib/shared-cache";
import { resolveNetworkFeedAccess, type NetworkFeedAccessSummary } from "@/lib/network-feed-access";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

type NetworkSourceRow = {
  id: number;
  name: string;
  slug: string;
  website_url: string | null;
  description: string | null;
  categories: string[] | null;
  portal_id: string | null;
};

// GET /api/portals/[slug]/network-feed
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "15") || 15, 1), 100);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0") || 0, 0);
  const category = searchParams.get("category") || null;
  const includeSources = searchParams.get("include_sources") === "true";
  const sourceScope = searchParams.get("source_scope") || "all";

  try {
    const portal = await getPortalBySlug(slug);
    if (!portal) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    const supabase = await createClient();

    const feedAccess = await getOrSetSharedCacheJson<NetworkFeedAccessSummary>(
      "network-feed:access",
      slug,
      5 * 60 * 1000,
      async () => resolveNetworkFeedAccess(supabase, {
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
      const parentOnlyIds = feedAccess.accessiblePortalIds.filter((id) => id !== portal.id);
      if (parentOnlyIds.length === 0) {
        const emptyBody: Record<string, unknown> = { posts: [], has_more: false };
        if (includeSources) emptyBody.sources = [];
        return NextResponse.json(emptyBody, {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          },
        });
      }
      accessibleSourcesQuery = accessibleSourcesQuery.in("portal_id", parentOnlyIds);
    } else {
      accessibleSourcesQuery = accessibleSourcesQuery.in("portal_id", feedAccess.accessiblePortalIds);
    }

    const { data: accessibleSources, error: accessibleSourcesError } = await accessibleSourcesQuery;

    if (accessibleSourcesError) {
      logger.error("Error fetching accessible network sources:", { error: accessibleSourcesError.message });
      return NextResponse.json({ error: "Failed to fetch network feed" }, { status: 500 });
    }

    const accessibleSourceRows = ((accessibleSources || []) as unknown as NetworkSourceRow[]);
    const accessibleSourceIds = accessibleSourceRows.map((row) => row.id);
    if (accessibleSourceIds.length === 0) {
      const emptyBody: Record<string, unknown> = { posts: [], has_more: false };
      if (includeSources) {
        emptyBody.sources = [];
      }
      return NextResponse.json(emptyBody, {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      });
    }

    // Build query: network_posts joined with network_sources
    // Post-level categories (migration 265) are used for filtering;
    // source-level categories kept on the join for fallback display.
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
      .range(offset, offset + limit - 1);

    // Filter on post-level categories (keyword-classified per article)
    if (category) {
      query = query.contains("categories", [category]);
    }

    const { data, error } = await query;

    if (error) {
      // Table may not exist yet (migration pending) — return empty gracefully
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return NextResponse.json({ posts: [], has_more: false });
      }
      logger.error("Error fetching network feed:", { error: error.message });
      return NextResponse.json({ error: "Failed to fetch network feed" }, { status: 500 });
    }

    const posts = data || [];
    const responseBody: Record<string, unknown> = {
      posts,
      has_more: posts.length === limit,
    };

    // Optionally include the source directory
    if (includeSources) {
        responseBody.sources = accessibleSourceRows;
    }

    return NextResponse.json(
      responseBody,
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (error) {
    logger.error("Error in network-feed GET:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
