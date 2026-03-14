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

// GET /api/exhibitions?portal=arts&type=solo&showing=current
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
  const admissionFilter = searchParams.get("admission");
  const showingFilter = searchParams.get("showing"); // current, upcoming, past
  const venueId = parseIntParam(searchParams.get("venue_id"));
  const qFilter = searchParams.get("q");

  try {
    const supabase = await createClient();

    let query = supabase
      .from("exhibitions")
      .select(
        `
        id,
        slug,
        venue_id,
        source_id,
        portal_id,
        title,
        description,
        image_url,
        opening_date,
        closing_date,
        medium,
        exhibition_type,
        admission_type,
        admission_url,
        source_url,
        tags,
        is_active,
        metadata,
        created_at,
        updated_at,
        venue:venues(id, name, slug, neighborhood, address, city, lat, lng, image_url),
        artists:exhibition_artists(exhibition_id, artist_name, artist_url, role)
      `
      )
      .eq("is_active", true);

    const today = new Date().toISOString().split("T")[0];

    if (showingFilter === "current") {
      query = query
        .or(`opening_date.is.null,opening_date.lte.${today}`)
        .or(`closing_date.is.null,closing_date.gte.${today}`);
    } else if (showingFilter === "upcoming") {
      query = query.gt("opening_date", today);
    } else if (showingFilter === "past") {
      query = query.lt("closing_date", today);
    }

    if (typeFilter && isValidString(typeFilter, 1, 50)) {
      query = query.eq("exhibition_type", typeFilter);
    }

    if (admissionFilter && isValidString(admissionFilter, 1, 50)) {
      query = query.eq("admission_type", admissionFilter);
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

    query = query
      .order("opening_date", { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      return errorResponse(error, "GET /api/exhibitions");
    }

    return NextResponse.json(
      {
        exhibitions: data ?? [],
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
    return errorResponse(error, "GET /api/exhibitions");
  }
}
