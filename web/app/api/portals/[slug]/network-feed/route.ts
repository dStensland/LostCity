import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import {
  fetchNetworkFeed,
  type SourceScope,
} from "@/lib/network-feed/fetch-network-feed";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

function parseSourceScope(value: string | null): SourceScope {
  if (value === "local" || value === "parent") return value;
  return "all";
}

// GET /api/portals/[slug]/network-feed
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await context.params;
  const searchParams = request.nextUrl.searchParams;

  const categoriesParam = searchParams.get("categories") || null;
  const categoriesFilter: string[] | null = categoriesParam
    ? categoriesParam.split(",").map((c) => c.trim()).filter(Boolean)
    : null;

  try {
    const outcome = await fetchNetworkFeed({
      portalSlug: slug,
      limit: parseInt(searchParams.get("limit") || "15") || 15,
      offset: parseInt(searchParams.get("offset") || "0") || 0,
      category: searchParams.get("category"),
      categories: categoriesFilter,
      civicFilter: searchParams.get("civic_filter") === "true",
      sourceScope: parseSourceScope(searchParams.get("source_scope")),
      includeSources: searchParams.get("include_sources") === "true",
    });

    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    }

    return NextResponse.json(outcome.result, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    logger.error("Error in network-feed GET:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
