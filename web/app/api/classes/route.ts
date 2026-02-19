import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  errorResponse,
  parseIntParam,
  parseFloatParam,
  isValidString,
} from "@/lib/api-utils";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import { enrichEventsWithSocialProof } from "@/lib/search";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";
import { applyPortalScopeToQuery, filterByPortalCity } from "@/lib/portal-scope";
import { getOrSetSharedCacheJson } from "@/lib/shared-cache";

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

const CLASSES_CACHE_TTL_MS = 90 * 1000;
const CLASSES_CACHE_MAX_ENTRIES = 300;
const CLASSES_CACHE_NAMESPACE = "api:classes";
const CLASSES_CACHE_CONTROL = "public, s-maxage=90, stale-while-revalidate=180";

// GET /api/classes — List class events with filters
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.standard,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);

  // Parse params
  const classCategory = searchParams.get("class_category");
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");
  const priceMin = parseFloatParam(searchParams.get("price_min"));
  const priceMax = parseFloatParam(searchParams.get("price_max"));
  const skillLevel = searchParams.get("skill_level");
  const portalExclusive = searchParams.get("portal_exclusive") === "true";
  const neighborhood = searchParams.get("neighborhood");
  const sort = searchParams.get("sort") || "date";
  const limit = Math.min(parseIntParam(searchParams.get("limit"), 20) ?? 20, 50);
  const offset = parseIntParam(searchParams.get("offset"), 0) ?? 0;

  // Validate params
  if (classCategory && !VALID_CLASS_CATEGORIES.includes(classCategory as typeof VALID_CLASS_CATEGORIES[number])) {
    return NextResponse.json({ error: "Invalid class_category" }, { status: 400 });
  }
  if (skillLevel && !VALID_SKILL_LEVELS.includes(skillLevel as typeof VALID_SKILL_LEVELS[number])) {
    return NextResponse.json({ error: "Invalid skill_level" }, { status: 400 });
  }

  const supabase = await createClient();
  const portalContext = await resolvePortalQueryContext(supabase, searchParams);
  if (portalContext.hasPortalParamMismatch) {
    return NextResponse.json(
      { error: "portal and portal_id parameters must reference the same portal" },
      { status: 400 }
    );
  }
  const portalId = portalContext.portalId;
  const portalCity = !portalExclusive ? portalContext.filters.city : undefined;
  const today = new Date().toISOString().split("T")[0];
  const cacheKey = [
    portalId || "no-portal",
    portalCity || "all-cities",
    portalExclusive ? "exclusive" : "shared",
    searchParams.toString(),
  ].join("|");

  const buildQuery = (includeFestival: boolean) => {
    const seriesSelect = includeFestival
      ? `
        series:series(
          id,
          slug,
          title,
          series_type,
          image_url,
          frequency,
          day_of_week,
          festival:festivals(id, slug, name, image_url, festival_type, location, neighborhood)
        )
      `
      : `
        series:series(
          id,
          slug,
          title,
          series_type,
          image_url,
          frequency,
          day_of_week
        )
      `;

    let query = supabase
      .from("events")
      .select(
        `
        id,
        title,
        description,
        start_date,
        start_time,
        end_date,
        end_time,
        is_all_day,
        category,
        subcategory,
        tags,
        price_min,
        price_max,
        price_note,
        is_free,
        source_url,
        ticket_url,
        image_url,
        is_class,
        class_category,
        skill_level,
        instructor,
        capacity,
        is_recurring,
        recurrence_rule,
        series_id,
        venue:venues(id, name, slug, address, neighborhood, city, state),
        ${seriesSelect}
      `,
        { count: "exact" }
      )
      .eq("is_class", true)
      .gte("start_date", startDate || today)
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

    if (priceMin !== null) {
      query = query.gte("price_min", priceMin);
    }

    if (priceMax !== null) {
      query = query.lte("price_max", priceMax);
    }

    if (neighborhood && isValidString(neighborhood, 1, 100)) {
      query = query.eq("venues.neighborhood", neighborhood);
    }

    query = applyPortalScopeToQuery(query, {
      portalId,
      portalExclusive,
      publicOnlyWhenNoPortal: true,
    });

    // Sorting
    if (sort === "price") {
      query = query
        .order("price_min", { ascending: true, nullsFirst: false })
        .order("start_date", { ascending: true });
    } else {
      query = query
        .order("start_date", { ascending: true })
        .order("start_time", { ascending: true });
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    return query;
  };

  try {
    const payload = await getOrSetSharedCacheJson<{
      classes: unknown[];
      total: number;
      limit: number;
      offset: number;
    }>(
      CLASSES_CACHE_NAMESPACE,
      cacheKey,
      CLASSES_CACHE_TTL_MS,
      async () => {
        let { data, error, count } = await buildQuery(true);
        if (error && error.message?.includes("relationship between 'series' and 'festivals'")) {
          ({ data, error, count } = await buildQuery(false));
        }

        if (error) {
          throw error;
        }

        const enrichedClasses = data
          ? await enrichEventsWithSocialProof(
              data as unknown as Parameters<typeof enrichEventsWithSocialProof>[0]
            )
          : [];
        const cityScopedClasses = filterByPortalCity(
          enrichedClasses as Array<{ venue?: { city?: string | null } | null }>,
          portalCity,
          { allowMissingCity: true }
        );

        return {
          classes: cityScopedClasses,
          total: count ?? cityScopedClasses.length,
          limit,
          offset,
        };
      },
      { maxEntries: CLASSES_CACHE_MAX_ENTRIES }
    );

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": CLASSES_CACHE_CONTROL,
      },
    });
  } catch (error) {
    const maybeError = error as { message?: string; details?: string; hint?: string };
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json(
        {
          error: maybeError?.message ?? "Failed to load classes",
          details: maybeError?.details,
          hint: maybeError?.hint,
        },
        { status: 500 }
      );
    }
    return errorResponse(error, "classes list");
  }
}
