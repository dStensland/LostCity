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

// GET /api/open-calls?portal=arts&type=submission&status=open
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

  const limit = Math.min(parseIntParam(searchParams.get("limit")) ?? 20, 100);
  const offset = Math.max(parseIntParam(searchParams.get("offset")) ?? 0, 0);
  const typeFilter = searchParams.get("type");
  const statusFilter = searchParams.get("status") ?? "open";
  const tierFilter = searchParams.get("tier");
  const portalExclusive = searchParams.get("portal_exclusive") === "true";
  const venueId = parseIntParam(searchParams.get("venue_id"));
  const qFilter = searchParams.get("q");

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

    // Count query — same filters as data query, no pagination
    let countQuery = portalClient
      .from("open_calls")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    countQuery = applyFederatedPortalScopeToQuery(countQuery, {
      portalId,
      portalExclusive,
      entityFamily: "open_calls",
      publicOnlyWhenNoPortal: true,
      sourceIds: sourceAccess.sourceIds,
      sourceColumn: "source_id",
    });

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
      .eq("is_active", true);

    query = applyFederatedPortalScopeToQuery(query, {
      portalId,
      portalExclusive,
      entityFamily: "open_calls",
      publicOnlyWhenNoPortal: true,
      sourceIds: sourceAccess.sourceIds,
      sourceColumn: "source_id",
    });

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
