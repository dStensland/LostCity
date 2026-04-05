import { NextRequest, NextResponse } from "next/server";
import { getCachedPortalBySlug } from "@/lib/portal";
import { unifiedSearch } from "@/lib/unified-search";
import { detectQuickActions } from "@/lib/search-ranking";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import type {
  ExploreLaneId,
  ExploreLaneSuggestion,
  ExploreSearchResponse,
} from "@/lib/explore-platform/types";
import type { SearchResult } from "@/lib/unified-search";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SPORTS_PATTERN =
  /\b(falcons|hawks|braves|atlanta united|dream|bulldogs|yellow jackets|game|match|playoffs|sports?)\b/i;
const SHOWS_PATTERN =
  /\b(movie|film|screening|concert|music|comedy|theater|theatre|show|gig|dj)\b/i;
const REGULARS_PATTERN =
  /\b(trivia|karaoke|open mic|run club|weekly|recurring|bingo|happy hour)\b/i;
const PLACES_PATTERN =
  /\b(brunch|cocktails|coffee|restaurant|bar|park|museum|patio|rooftop|brewery)\b/i;
const CLASSES_PATTERN =
  /\b(class|classes|lesson|lessons|workshop|camp|course|training|studio|pottery|dance|swim|yoga)\b/i;

function buildEntityCounts(
  results: SearchResult[],
  facets: Array<{ type: string; count: number }>,
): ExploreSearchResponse["entityCounts"] {
  const counts: ExploreSearchResponse["entityCounts"] = {};

  for (const facet of facets) {
    counts[facet.type as SearchResult["type"]] = facet.count;
  }

  for (const result of results) {
    const key = result.type;
    if (typeof counts[key] !== "number") {
      counts[key] = 0;
    }
    counts[key] = Math.max(counts[key] ?? 0, 1);
  }

  return counts;
}

function pushSuggestion(
  suggestions: ExploreLaneSuggestion[],
  seen: Set<ExploreLaneId>,
  lane: ExploreLaneId,
  reason: string,
) {
  if (seen.has(lane)) return;
  seen.add(lane);
  suggestions.push({ lane, reason });
}

function buildLaneSuggestions(
  query: string,
  entityCounts: ExploreSearchResponse["entityCounts"],
): ExploreLaneSuggestion[] {
  const suggestions: ExploreLaneSuggestion[] = [];
  const seen = new Set<ExploreLaneId>();
  const trimmedQuery = query.trim();

  if (SPORTS_PATTERN.test(trimmedQuery)) {
    pushSuggestion(suggestions, seen, "game-day", "Sports intent is stronger than a generic event list.");
  }

  if (SHOWS_PATTERN.test(trimmedQuery)) {
    pushSuggestion(suggestions, seen, "shows", "This query looks like film, music, comedy, or theater intent.");
  }

  if (REGULARS_PATTERN.test(trimmedQuery)) {
    pushSuggestion(suggestions, seen, "regulars", "This query reads like a recurring-ritual search.");
  }

  if (PLACES_PATTERN.test(trimmedQuery) || (entityCounts.venue ?? 0) > (entityCounts.event ?? 0)) {
    pushSuggestion(suggestions, seen, "places", "Places and destinations look especially relevant here.");
  }

  if (CLASSES_PATTERN.test(trimmedQuery) || (entityCounts.program ?? 0) > 0) {
    pushSuggestion(suggestions, seen, "classes", "Structured classes and programs match this intent.");
  }

  if ((entityCounts.event ?? 0) > 0) {
    pushSuggestion(suggestions, seen, "events", "Browse upcoming events with filters, map, or calendar.");
  }

  if ((entityCounts.event ?? 0) > 0 && !seen.has("shows")) {
    pushSuggestion(suggestions, seen, "shows", "Shows can be a better discovery mode for entertainment-heavy queries.");
  }

  return suggestions.slice(0, 3);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;
  const portal = await getCachedPortalBySlug(slug);
  if (!portal) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json(
      {
        error: "Query must be at least 2 characters",
        query,
        results: [],
        facets: [],
        total: 0,
        entityCounts: {},
        laneSuggestions: [],
        quickActions: [],
      },
      { status: 400 },
    );
  }

  const payload = await unifiedSearch({
    query,
    portalId: portal.id,
    limit: 18,
    includeFacets: true,
    includeDidYouMean: true,
  });

  const entityCounts = buildEntityCounts(payload.results, payload.facets);
  const laneSuggestions = buildLaneSuggestions(query, entityCounts);
  const quickActions = detectQuickActions(query, slug, {
    viewMode: "find",
    findType: null,
  }).map((action) => ({
    label: action.label,
    description: action.description,
    href: action.url,
  }));

  return NextResponse.json(
    {
      query,
      results: payload.results,
      facets: payload.facets,
      total: payload.total,
      didYouMean: payload.didYouMean,
      entityCounts,
      laneSuggestions,
      quickActions,
    } satisfies ExploreSearchResponse,
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    },
  );
}
