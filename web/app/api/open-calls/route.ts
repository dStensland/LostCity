import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  errorResponse,
  isValidString,
  parseIntParam,
  escapeSQLPattern,
} from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/open-calls?type=submission&status=open
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);

  const limit = Math.min(parseIntParam(searchParams.get("limit")) ?? 20, 100);
  const offset = Math.max(parseIntParam(searchParams.get("offset")) ?? 0, 0);
  const typeFilter = searchParams.get("type");
  const statusFilter = searchParams.get("status") ?? "open";
  const venueId = parseIntParam(searchParams.get("venue_id"));
  const qFilter = searchParams.get("q");

  try {
    const supabase = await createClient();

    let query = supabase
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
        is_active,
        created_at,
        updated_at,
        organization:organizations(id, name, slug, website),
        venue:venues(id, name, slug, neighborhood)
      `
      )
      .eq("is_active", true);

    if (statusFilter && isValidString(statusFilter, 1, 50)) {
      query = query.eq("status", statusFilter);
    }

    if (typeFilter && isValidString(typeFilter, 1, 50)) {
      query = query.eq("call_type", typeFilter);
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

    const { data, error } = await query;

    if (error) {
      return errorResponse(error, "GET /api/open-calls");
    }

    return NextResponse.json(
      {
        open_calls: data ?? [],
        total: (data ?? []).length,
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
