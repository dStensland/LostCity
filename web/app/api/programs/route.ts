import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  errorResponse,
  isValidString,
  parseIntParam,
  escapeSQLPattern,
} from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";
import { getPortalSourceAccess } from "@/lib/federation";

export const dynamic = "force-dynamic";

// GET /api/programs?portal=hooky
// Returns programs for a portal with optional filtering.
// Falls back to recurring events if the programs table is empty.
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);

  // Require portal param
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
  const seasonFilter = searchParams.get("season");
  const ageFilter = parseIntParam(searchParams.get("age"));
  const registrationFilter = searchParams.get("registration");
  const costMaxFilter = searchParams.get("cost_max");
  const dayFilter = parseIntParam(searchParams.get("day"));
  const qFilter = searchParams.get("q");
  const sortParam = searchParams.get("sort") ?? "session_start";

  try {
    const supabase = await createClient();
    const portalContext = await resolvePortalQueryContext(supabase, searchParams);

    if (!portalContext.portalId) {
      return NextResponse.json(
        { error: "Portal not found" },
        { status: 404 }
      );
    }

    if (portalContext.hasPortalParamMismatch) {
      return NextResponse.json(
        { error: "portal and portal_id parameters must reference the same portal" },
        { status: 400 }
      );
    }

    const portalId = portalContext.portalId;

    // Query programs table first
    let programsQuery = supabase
      .from("programs")
      .select(
        `
        id,
        portal_id,
        source_id,
        venue_id,
        name,
        slug,
        description,
        program_type,
        provider_name,
        age_min,
        age_max,
        season,
        session_start,
        session_end,
        schedule_days,
        schedule_start_time,
        schedule_end_time,
        cost_amount,
        cost_period,
        cost_notes,
        registration_status,
        registration_opens,
        registration_closes,
        registration_url,
        before_after_care,
        lunch_included,
        tags,
        status,
        venue:venues(id, name, neighborhood, address, city, lat, lng, image_url)
      `
      )
      .eq("portal_id", portalId)
      .eq("status", "active");

    if (typeFilter && isValidString(typeFilter, 1, 50)) {
      programsQuery = programsQuery.eq("program_type", typeFilter);
    }

    if (seasonFilter && isValidString(seasonFilter, 1, 50)) {
      programsQuery = programsQuery.eq("season", seasonFilter);
    }

    if (ageFilter !== null) {
      programsQuery = programsQuery
        .or(`age_min.is.null,age_min.lte.${ageFilter}`)
        .or(`age_max.is.null,age_max.gte.${ageFilter}`);
    }

    if (registrationFilter && isValidString(registrationFilter, 1, 100)) {
      const statuses = registrationFilter
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (statuses.length > 0) {
        programsQuery = programsQuery.in("registration_status", statuses);
      }
    }

    if (costMaxFilter !== null) {
      const costMax = parseFloat(costMaxFilter);
      if (!isNaN(costMax)) {
        programsQuery = programsQuery.or(
          `cost_amount.is.null,cost_amount.lte.${costMax}`
        );
      }
    }

    if (dayFilter !== null && dayFilter >= 1 && dayFilter <= 7) {
      programsQuery = programsQuery.contains("schedule_days", [dayFilter]);
    }

    if (qFilter && isValidString(qFilter, 1, 200)) {
      const escaped = escapeSQLPattern(qFilter);
      programsQuery = programsQuery.or(
        `name.ilike.%${escaped}%,description.ilike.%${escaped}%`
      );
    }

    // Apply sort
    switch (sortParam) {
      case "session_start":
        programsQuery = programsQuery.order("session_start", {
          ascending: true,
          nullsFirst: false,
        });
        break;
      case "cost":
        programsQuery = programsQuery.order("cost_amount", {
          ascending: true,
          nullsFirst: true,
        });
        break;
      case "registration_urgency":
        // open first, then waitlist, then upcoming — DB will sort by inserted value
        programsQuery = programsQuery.order("registration_status", {
          ascending: true,
        });
        break;
      default:
        programsQuery = programsQuery.order("session_start", {
          ascending: true,
          nullsFirst: false,
        });
    }

    programsQuery = programsQuery.range(offset, offset + limit - 1);

    const { data: programsData, error: programsError } = await programsQuery;

    if (programsError) {
      return errorResponse(programsError, "GET /api/programs");
    }

    type ProgramRow = {
      id: string;
      portal_id: string | null;
      source_id: number | null;
      venue_id: number | null;
      name: string;
      slug: string | null;
      description: string | null;
      program_type: string;
      provider_name: string | null;
      age_min: number | null;
      age_max: number | null;
      season: string | null;
      session_start: string | null;
      session_end: string | null;
      schedule_days: number[] | null;
      schedule_start_time: string | null;
      schedule_end_time: string | null;
      cost_amount: number | null;
      cost_period: string | null;
      cost_notes: string | null;
      registration_status: string;
      registration_opens: string | null;
      registration_closes: string | null;
      registration_url: string | null;
      before_after_care: boolean;
      lunch_included: boolean;
      tags: string[] | null;
      status: string;
      venue: {
        id: number;
        name: string;
        neighborhood: string | null;
        address: string | null;
        city: string | null;
        lat: number | null;
        lng: number | null;
        image_url: string | null;
      } | null;
    };

    const programs = (programsData ?? []) as ProgramRow[];

    // If programs table is empty, fall back to recurring events for this portal
    if (programs.length === 0 && offset === 0) {
      const sourceAccess = await getPortalSourceAccess(portalId);
      const sourceIds = sourceAccess?.sourceIds ?? [];

      if (sourceIds.length === 0) {
        return NextResponse.json(
          {
            programs: [],
            total: 0,
            offset,
            limit,
            source: "programs",
          },
          {
            headers: {
              "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
            },
          }
        );
      }

      const serviceClient = createServiceClient();
      const today = new Date().toISOString().split("T")[0];

      let eventsQuery = serviceClient
        .from("events")
        .select(
          `
          id,
          title,
          start_date,
          end_date,
          start_time,
          end_time,
          is_all_day,
          is_free,
          price_min,
          price_max,
          description,
          tags,
          age_min,
          age_max,
          is_recurring,
          category_id,
          venue:venues(id, name, neighborhood, address, city, lat, lng, image_url)
        `
        )
        .eq("is_recurring", true)
        .gte("start_date", today)
        .is("canonical_event_id", null)
        .in("source_id", sourceIds)
        .order("start_date", { ascending: true })
        .limit(limit);

      if (ageFilter !== null) {
        eventsQuery = eventsQuery
          .or(`age_min.is.null,age_min.lte.${ageFilter}`)
          .or(`age_max.is.null,age_max.gte.${ageFilter}`);
      }

      if (qFilter && isValidString(qFilter, 1, 200)) {
        const escaped = escapeSQLPattern(qFilter);
        eventsQuery = eventsQuery.ilike("title", `%${escaped}%`);
      }

      const { data: eventsData, error: eventsError } = await eventsQuery;

      if (eventsError) {
        return errorResponse(eventsError, "GET /api/programs (events fallback)");
      }

      return NextResponse.json(
        {
          programs: eventsData ?? [],
          total: (eventsData ?? []).length,
          offset,
          limit,
          source: "events_fallback",
        },
        {
          headers: {
            "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
          },
        }
      );
    }

    return NextResponse.json(
      {
        programs,
        total: programs.length,
        offset,
        limit,
        source: "programs",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    return errorResponse(error, "GET /api/programs");
  }
}
