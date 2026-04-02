import { NextRequest, NextResponse } from "next/server";
import { createClient, createPortalScopedClient } from "@/lib/supabase/server";
import {
  errorResponse,
  parseIntParam,
  isValidString,
  escapeSQLPattern,
} from "@/lib/api-utils";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";
import {
  applyFederatedPortalScopeToQuery,
  filterByPortalCity,
  parsePortalContentFilters,
  applyPortalCategoryFilters,
  filterByPortalContentScope,
} from "@/lib/portal-scope";
import { getSharedCacheJson, setSharedCacheJson } from "@/lib/shared-cache";
import { getPortalSourceAccess } from "@/lib/federation";
import { applyFeedGate } from "@/lib/feed-gate";

const VALID_CLASS_CATEGORIES = [
  "painting",
  "cooking",
  "pottery",
  "dance",
  "fitness",
  "woodworking",
  "floral",
  "photography",
  "candle-making",
  "outdoor-skills",
  "mixed",
] as const;

const VALID_SKILL_LEVELS = [
  "beginner",
  "intermediate",
  "advanced",
  "all-levels",
] as const;

const CACHE_TTL_MS = 90 * 1000;
const CACHE_NAMESPACE = "api:classes-studios";
const CACHE_CONTROL = "public, s-maxage=90, stale-while-revalidate=180";

function escapePostgrestLikeValue(value: string): string {
  return escapeSQLPattern(value)
    .replace(/"/g, '\\"')
    .replace(/'/g, "''")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/,/g, "\\,");
}

type ClassRow = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  class_category: string | null;
  skill_level: string | null;
  place_id: number | null;
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
    city: string | null;
    lat: number | null;
    lng: number | null;
    image_url: string | null;
  } | null;
  tags?: string[] | null;
  price?: number | null;
  category?: string | null;
};

type StudioResult = {
  place_id: number;
  name: string;
  slug: string;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
  class_count: number;
  categories: string[];
  next_class: {
    title: string;
    start_date: string;
    start_time: string | null;
  } | null;
};

// GET /api/classes/studios — Studios grouped with class counts
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);

  // Parse params
  const classCategory = searchParams.get("class_category");
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");
  const skillLevel = searchParams.get("skill_level");
  const search = (searchParams.get("search") || searchParams.get("q") || "").trim();
  const limit = Math.min(parseIntParam(searchParams.get("limit"), 500) ?? 500, 500);

  // Validate params
  if (classCategory && !VALID_CLASS_CATEGORIES.includes(classCategory as typeof VALID_CLASS_CATEGORIES[number])) {
    return NextResponse.json({ error: "Invalid class_category" }, { status: 400 });
  }
  if (skillLevel && !VALID_SKILL_LEVELS.includes(skillLevel as typeof VALID_SKILL_LEVELS[number])) {
    return NextResponse.json({ error: "Invalid skill_level" }, { status: 400 });
  }

  // --- Portal scoping (replicated from /api/classes) ---
  const supabase = await createClient();
  const portalContext = await resolvePortalQueryContext(supabase, searchParams);
  if (portalContext.hasPortalParamMismatch) {
    return NextResponse.json(
      { error: "portal and portal_id parameters must reference the same portal" },
      { status: 400 }
    );
  }
  const portalId = portalContext.portalId;
  const portalClient = await createPortalScopedClient(portalId);
  const sourceAccess = portalId ? await getPortalSourceAccess(portalId) : null;
  const portalCity = portalContext.filters.city;
  const portalContentFilters = parsePortalContentFilters(portalContext.filters as Record<string, unknown> | null);
  const today = new Date().toISOString().split("T")[0];

  // Venue name search for search-by-venue matching
  let matchingVenueIds: number[] = [];
  if (search.length >= 2) {
    let venueSearchQuery = supabase
      .from("places")
      .select("id")
      .ilike("name", `%${escapePostgrestLikeValue(search)}%`)
      .limit(40);

    if (portalCity) {
      venueSearchQuery = venueSearchQuery.eq("city", portalCity);
    }

    const { data: matchingVenues } = await venueSearchQuery;
    matchingVenueIds = (
      (matchingVenues as Array<{ id: number }> | null) || []
    ).map((venue) => venue.id);
  }

  // --- Caching ---
  const cacheBucket = Math.floor(Date.now() / CACHE_TTL_MS);
  const cacheKey = [
    portalId || "no-portal",
    portalCity || "all-cities",
    searchParams.toString(),
    cacheBucket,
  ].join("|");

  const cachedPayload = await getSharedCacheJson<{
    studios: StudioResult[];
    category_counts: Record<string, number>;
    total_count: number;
  }>(CACHE_NAMESPACE, cacheKey);
  if (cachedPayload) {
    return NextResponse.json(cachedPayload, {
      headers: { "Cache-Control": CACHE_CONTROL },
    });
  }

  // --- Build query ---
  let query = portalClient
    .from("events")
    .select(
      `
      id,
      title,
      start_date,
      start_time,
      class_category,
      skill_level,
      place_id,
      tags,
      price_min,
      category_id,
      venue:places!inner(id, name, slug, neighborhood, city, lat, lng, image_url)
    `
    )
    .eq("is_class", true)
    .gte("start_date", startDate || today)
    .is("canonical_event_id", null)
    .or("is_sensitive.eq.false,is_sensitive.is.null");

  // Apply filters
  if (endDate) {
    query = query.lte("start_date", endDate);
  }

  if (classCategory) {
    query = query.eq("class_category", classCategory);
  }

  if (skillLevel) {
    query = query.eq("skill_level", skillLevel);
  }

  if (search.length >= 2) {
    const escapedSearch = escapePostgrestLikeValue(search);
    const searchClauses = [
      `title.ilike.%${escapedSearch}%`,
      `description.ilike.%${escapedSearch}%`,
      `instructor.ilike.%${escapedSearch}%`,
    ];
    if (matchingVenueIds.length > 0) {
      searchClauses.push(`place_id.in.(${matchingVenueIds.join(",")})`);
    }
    query = query.or(searchClauses.join(","));
  }

  // Portal scope
  query = applyFederatedPortalScopeToQuery(query, {
    portalId,
    portalExclusive: false,
    publicOnlyWhenNoPortal: true,
    sourceIds: sourceAccess?.sourceIds || [],
    sourceColumn: "source_id",
  });

  // Category filters (exclude only, same as /api/classes)
  query = applyPortalCategoryFilters(query, portalContentFilters, {
    userCategoriesActive: true,
  });
  query = applyFeedGate(query);

  // Sort by start_date ASC so first item per venue = next class
  query = query
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(limit);

  const { data, error } = await query;

  if (error) {
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json(
        { error: error.message, details: error.details, hint: error.hint },
        { status: 500 }
      );
    }
    return errorResponse(error, "classes/studios list");
  }

  const rows = (data || []) as unknown as ClassRow[];

  // --- Post-query portal filters ---
  const cityScopedRows = filterByPortalCity(
    rows as Array<{ venue?: { city?: string | null } | null }>,
    portalCity,
    { allowMissingCity: true }
  ) as ClassRow[];

  const contentScopedRows = filterByPortalContentScope(
    cityScopedRows,
    portalContentFilters
  ) as ClassRow[];

  // --- Group by venue ---
  const studioMap = new Map<number, {
    venue: NonNullable<ClassRow["venue"]>;
    classes: ClassRow[];
    categories: Set<string>;
  }>();

  for (const row of contentScopedRows) {
    if (!row.venue || !row.place_id) continue;

    let entry = studioMap.get(row.place_id);
    if (!entry) {
      entry = {
        venue: row.venue,
        classes: [],
        categories: new Set(),
      };
      studioMap.set(row.place_id, entry);
    }

    entry.classes.push(row);
    if (row.class_category) {
      entry.categories.add(row.class_category);
    }
  }

  // --- Build response ---
  const studios: StudioResult[] = [];
  const categoryCounts: Record<string, number> = {};

  for (const [placeId, entry] of studioMap) {
    const nextClass = entry.classes[0]; // Already sorted by start_date ASC
    studios.push({
      place_id: placeId,
      name: entry.venue.name,
      slug: entry.venue.slug,
      neighborhood: entry.venue.neighborhood,
      lat: entry.venue.lat,
      lng: entry.venue.lng,
      image_url: entry.venue.image_url,
      class_count: entry.classes.length,
      categories: Array.from(entry.categories).sort(),
      next_class: nextClass
        ? {
            title: nextClass.title,
            start_date: nextClass.start_date,
            start_time: nextClass.start_time,
          }
        : null,
    });
  }

  // Sort studios by class_count descending
  studios.sort((a, b) => b.class_count - a.class_count);

  // Compute category counts across all rows
  for (const row of contentScopedRows) {
    if (row.class_category) {
      categoryCounts[row.class_category] = (categoryCounts[row.class_category] || 0) + 1;
    }
  }

  const payload = {
    studios,
    category_counts: categoryCounts,
    total_count: contentScopedRows.length,
  };

  await setSharedCacheJson(CACHE_NAMESPACE, cacheKey, payload, CACHE_TTL_MS, {
    maxEntries: 300,
  });

  return NextResponse.json(payload, {
    headers: { "Cache-Control": CACHE_CONTROL },
  });
}
