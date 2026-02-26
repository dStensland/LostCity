import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPortalBySlug } from "@/lib/portal";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

type RouteContext = {
  params: Promise<{ slug: string }>;
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

    // Build query: network_posts joined with network_sources
    // NOTE: categories lives on network_sources (post-level categories column
    // exists but PostgREST schema cache may be stale after migration 265)
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
        source:network_sources!inner(
          name,
          slug,
          website_url,
          categories
        )
      `)
      .eq("portal_id", portal.id)
      .eq("network_sources.is_active", true)
      .order("published_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    // Filter on source-level categories via the inner join
    if (category) {
      query = query.contains("network_sources.categories", [category]);
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
        .eq("portal_id", portal.id)
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
