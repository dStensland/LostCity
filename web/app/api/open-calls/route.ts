import { NextRequest, NextResponse } from "next/server";
import { createClient, createPortalScopedClient } from "@/lib/supabase/server";
import {
  errorResponse,
  isValidString,
  parseIntParam,
  escapeSQLPattern,
} from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { resolvePortalQueryContext, getVerticalFromRequest } from "@/lib/portal-query-context";
import { getPortalSourceAccess } from "@/lib/federation";
import { applyFederatedPortalScopeToQuery, filterByPortalCity } from "@/lib/portal-scope";

export const dynamic = "force-dynamic";

// Source slug lists for scope-based filtering
const LOCAL_SOURCE_SLUGS = [
  "open-calls-burnaway",
  "open-calls-cafe",
  "open-calls-south-arts",
  "open-calls-ga-arts",
  "open-calls-fulton-arts",
  "open-calls-bakery-atl",
  "open-calls-hambidge",
];

const NATIONAL_SOURCE_SLUGS = [
  "open-calls-nyfa",
  "open-calls-pw",
  "open-calls-craft-council",
  "open-calls-nea",
  "open-calls-fca",
  "open-calls-art-deadlines",
  "open-calls-artconnect",
  "open-calls-entrythingy",
  "open-calls-artrabbit",
  "open-calls-artist-communities",
  "open-calls-artwork-archive",
  "open-calls-hyperallergic",
  "open-calls-creative-capital",
  "open-calls-creative-capital-dir",
  "open-calls-macdowell",
  "open-calls-yaddo",
  "open-calls-usa-fellowships",
  "open-calls-submittable",
  "open-calls-eflux",
  "open-calls-transartists",
  "open-calls-forecast",
  "open-calls-colossal",
  "open-calls-curatorspace",
  "open-calls-wooloo",
  "open-calls-resartis",
  "open-calls-culture360",
  "open-calls-artquest",
  "open-calls-codaworx",
  "open-calls-retitle",
  "open-calls-springboard",
  "open-calls-photocontestinsider",
  "open-calls-artshow",
  "open-calls-artjobs",
  "open-calls-zapp",
  "open-calls-graphic-competitions",
  "open-calls-artcallentry",
  "open-calls-competitions-archi",
  "open-calls-play-submissions",
  "open-calls-artinfoland",
  "open-calls-musical-chairs",
  "open-calls-cafe-national",
  "open-calls-showsubmit",
  "open-calls-artcall",
  "open-calls-submission-grinder",
  "open-calls-festhome",
  "open-calls-dancing-opportunities",
  "open-calls-rhizome",
  "open-calls-artenda",
];

const SCOPE_SLUG_MAP: Record<string, string[]> = {
  local: LOCAL_SOURCE_SLUGS,
  national: NATIONAL_SOURCE_SLUGS,
};

// GET /api/open-calls?portal=arts&type=submission&status=open&scope=local
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);
  const portalParam = searchParams.get("portal");
  if (!portalParam || !isValidString(portalParam, 1, 50)) {
    return NextResponse.json(
      { error: "portal parameter is required" },
      { status: 400 }
    );
  }

  const limit = Math.min(parseIntParam(searchParams.get("limit")) ?? 20, 500);
  const offset = Math.max(parseIntParam(searchParams.get("offset")) ?? 0, 0);
  const typeFilter = searchParams.get("type");
  const statusFilter = searchParams.get("status") ?? "open";
  const tierFilter = searchParams.get("tier");
  const portalExclusive = searchParams.get("portal_exclusive") === "true";
  const venueId = parseIntParam(searchParams.get("venue_id"));
  const qFilter = searchParams.get("q");
  const scopeFilter = searchParams.get("scope"); // "local" | "national"

  try {
    const supabase = await createClient();
    const portalContext = await resolvePortalQueryContext(supabase, searchParams, getVerticalFromRequest(request));
    if (!portalContext.portalId) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    if (portalContext.hasPortalParamMismatch) {
      return NextResponse.json(
        { error: "portal and portal_id parameters must reference the same portal" },
        { status: 400 }
      );
    }

    const portalId = portalContext.portalId;
    const portalClient = await createPortalScopedClient(portalId);
    const sourceAccess = await getPortalSourceAccess(portalId, { entityFamily: "open_calls" });
    const portalCity = !portalExclusive ? portalContext.filters.city : undefined;

    // Resolve scope to source IDs if provided
    let scopeSourceIds: number[] | null = null;
    if (scopeFilter && SCOPE_SLUG_MAP[scopeFilter]) {
      const { data: scopeSources } = await supabase
        .from("sources")
        .select("id")
        .in("slug", SCOPE_SLUG_MAP[scopeFilter]);
      if (scopeSources && scopeSources.length > 0) {
        scopeSourceIds = scopeSources.map((s: { id: number }) => s.id);
      }
    }

    // Exclude past-deadline calls regardless of status field
    const todayStr = new Date().toISOString().split("T")[0];

    // Count query — same filters as data query, no pagination
    let countQuery = portalClient
      .from("open_calls")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .or(`deadline.gte.${todayStr},deadline.is.null`);

    countQuery = applyFederatedPortalScopeToQuery(countQuery, {
      portalId,
      portalExclusive,
      entityFamily: "open_calls",
      publicOnlyWhenNoPortal: true,
      sourceIds: sourceAccess.sourceIds,
      sourceColumn: "source_id",
    });

    if (scopeSourceIds) {
      countQuery = countQuery.in("source_id", scopeSourceIds);
    }

    if (statusFilter && isValidString(statusFilter, 1, 50)) {
      countQuery = countQuery.eq("status", statusFilter);
    }

    if (typeFilter && isValidString(typeFilter, 1, 50)) {
      countQuery = countQuery.eq("call_type", typeFilter);
    }

    if (tierFilter && isValidString(tierFilter, 1, 20)) {
      countQuery = countQuery.eq("confidence_tier", tierFilter);
    }

    if (venueId !== null) {
      countQuery = countQuery.eq("venue_id", venueId);
    }

    if (qFilter && isValidString(qFilter, 1, 200)) {
      const escaped = escapeSQLPattern(qFilter);
      countQuery = countQuery.or(
        `title.ilike.%${escaped}%,description.ilike.%${escaped}%`
      );
    }

    // Data query
    let query = portalClient
      .from("open_calls")
      .select(
        `
        id,
        slug,
        organization_id,
        venue_id,
        source_id,
        portal_id,
        title,
        description,
        deadline,
        application_url,
        fee,
        eligibility,
        medium_requirements,
        call_type,
        status,
        source_url,
        tags,
        metadata,
        confidence_tier,
        is_active,
        created_at,
        updated_at,
        organization:organizations(id, name, slug, website),
        venue:venues(id, name, slug, neighborhood, city)
      `
      )
      .eq("is_active", true)
      .or(`deadline.gte.${todayStr},deadline.is.null`);

    query = applyFederatedPortalScopeToQuery(query, {
      portalId,
      portalExclusive,
      entityFamily: "open_calls",
      publicOnlyWhenNoPortal: true,
      sourceIds: sourceAccess.sourceIds,
      sourceColumn: "source_id",
    });

    if (scopeSourceIds) {
      query = query.in("source_id", scopeSourceIds);
    }

    if (statusFilter && isValidString(statusFilter, 1, 50)) {
      query = query.eq("status", statusFilter);
    }

    if (typeFilter && isValidString(typeFilter, 1, 50)) {
      query = query.eq("call_type", typeFilter);
    }

    if (tierFilter && isValidString(tierFilter, 1, 20)) {
      query = query.eq("confidence_tier", tierFilter);
    }

    if (venueId !== null) {
      query = query.eq("venue_id", venueId);
    }

    if (qFilter && isValidString(qFilter, 1, 200)) {
      const escaped = escapeSQLPattern(qFilter);
      query = query.or(
        `title.ilike.%${escaped}%,description.ilike.%${escaped}%`
      );
    }

    // Sort open calls by deadline urgency (soonest first), then by creation
    query = query
      .order("deadline", { ascending: true, nullsFirst: false })
      .range(offset, offset + limit - 1);

    const [{ count: totalCount, error: countError }, { data, error }] = await Promise.all([
      countQuery,
      query,
    ]);

    if (countError) {
      return errorResponse(countError, "GET /api/open-calls (count)");
    }

    if (error) {
      return errorResponse(error, "GET /api/open-calls");
    }

    type OpenCallRow = {
      venue?: { city?: string | null } | null;
      [key: string]: unknown;
    };
    const openCalls = filterByPortalCity(
      (data ?? []) as OpenCallRow[],
      portalCity,
      { allowMissingCity: true }
    );

    return NextResponse.json(
      {
        open_calls: openCalls,
        total: totalCount ?? openCalls.length,
        offset,
        limit,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    return errorResponse(error, "GET /api/open-calls");
  }
}
