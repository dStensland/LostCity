import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPortalBySlug } from "@/lib/portal";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { getOrSetSharedCacheJson } from "@/lib/shared-cache";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

type PortalRow = {
  id: string;
  slug: string;
  parent_portal_id?: string | null;
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

  try {
    const portal = await getPortalBySlug(slug);
    if (!portal) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    const supabase = await createClient();

    // Resolve feedPortalId: inherit from parent when this portal has no active sources.
    // This runs 2-3 sequential queries; cache the result for 5 minutes.
    const feedPortalId = await getOrSetSharedCacheJson<string>(
      "network-feed:portal-id",
      slug,
      5 * 60 * 1000,
      async () => {
        const { count: activeSourceCount, error: activeSourceCountError } = await supabase
          .from("network_sources")
          .select("id", { count: "exact", head: true })
          .eq("portal_id", portal.id)
          .eq("is_active", true);

        if (!activeSourceCountError && (activeSourceCount || 0) === 0 && portal.parent_portal_id) {
          const { data: parentPortal } = await supabase
            .from("portals")
            .select("id, slug")
            .eq("id", portal.parent_portal_id)
            .eq("status", "active")
            .maybeSingle();

          if (parentPortal) {
            const typedParent = parentPortal as PortalRow;
            const { count: parentActiveSourceCount, error: parentSourceCountError } = await supabase
              .from("network_sources")
              .select("id", { count: "exact", head: true })
              .eq("portal_id", typedParent.id)
              .eq("is_active", true);

            if (!parentSourceCountError && (parentActiveSourceCount || 0) > 0) {
              return typedParent.id;
            }
          }
        }

        return portal.id;
      },
      { maxEntries: 50 },
    );

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
      .eq("portal_id", feedPortalId)
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
      const { data: sources, error: srcError } = await supabase
        .from("network_sources")
        .select("name, slug, website_url, description, categories")
        .eq("portal_id", feedPortalId)
        .eq("is_active", true)
        .order("name");

      if (srcError) {
        logger.error("Error fetching network sources:", srcError);
      } else {
        responseBody.sources = sources || [];
      }
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
