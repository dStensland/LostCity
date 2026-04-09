import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  errorResponse,
  isValidString,
  parseIntParam,
  escapeSQLPattern,
  validationError,
} from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { resolvePortalQueryContext, getVerticalFromRequest } from "@/lib/portal-query-context";
import { getPortalSourceAccess } from "@/lib/federation";

export const dynamic = "force-dynamic";

// GET /api/programs?portal=atlanta-families
// Returns programs for a portal with optional filtering.
// Compatibility fallback to recurring events is opt-in via include_events_fallback=true.
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
  // tag=sports|arts|stem|... — filters by activity tag using array containment
  const tagFilter = searchParams.get("tag");
  const includeEventsFallback = searchParams.get("include_events_fallback") === "true";
  // environment=indoor|outdoor|both — filters programs by their venue's indoor_outdoor classification
  const environmentFilter = searchParams.get("environment");
  // active=true: exclude past programs (session_end < today) and adult-only programs (age_min > 17)
  const activeOnly = searchParams.get("active") === "true";

  // Range-validate age and cost_max before use in PostgREST filter strings
  if (ageFilter !== null && (ageFilter < 0 || ageFilter > 18)) {
    return validationError("age must be between 0 and 18");
  }
  if (costMaxFilter !== null) {
    const costMaxParsed = parseFloat(costMaxFilter);
    if (isNaN(costMaxParsed) || costMaxParsed < 0 || costMaxParsed > 10000) {
      return validationError("cost_max must be between 0 and 10000");
    }
  }

  try {
    const supabase = await createClient();
    const portalContext = await resolvePortalQueryContext(supabase, searchParams, getVerticalFromRequest(request));

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

    // Resolve federated source access for programs entity family.
    // This includes sources owned by the portal AND sources the portal subscribes to
    // via the portal_source_entity_access materialized view.
    const sourceAccess = await getPortalSourceAccess(portalId, { entityFamily: "programs" });
    const sourceIds = sourceAccess?.sourceIds ?? [];

    // Use service client for federated reads — programs from subscribed sources have
    // a different portal_id (the owning portal), which would be blocked by RLS on the
    // user-scoped client.
    const serviceClient = createServiceClient();

    // Scope filter: programs directly owned by this portal OR from any accessible source.
    // Mirrors the same OR pattern used in weekend/route.ts for events federation.
    let programsScopeFilter: string;
    if (sourceIds.length > 0) {
      programsScopeFilter = `portal_id.eq.${portalId},source_id.in.(${sourceIds.join(",")})`;
    } else {
      programsScopeFilter = `portal_id.eq.${portalId}`;
    }

    // Query programs table first
    const today = new Date().toISOString().split("T")[0];
    // Guard against stale programs that have null session_end but a session_start
    // from more than 2 years ago (e.g. "N.H Scott 2021-2022 12 & Under Girls Basketball"
    // with session_start from 2021 and no explicit end date).
    const twoYearsAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Helper: apply all shared filters to any query (data or count).
    // Returns the query with all filters applied except .select(), .order(), and .range().
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function applyProgramFilters(q: any) {
      q = q
        .or(programsScopeFilter)
        .eq("status", "active")
        // Temporal gate:
        // - Programs with a future or present session_end → included
        // - Programs with null session_end AND session_start within last 2 years → included (ongoing)
        // - Programs with null session_end AND null session_start → included (no date info)
        // - Programs with null session_end AND session_start older than 2 years → excluded (stale)
        .or(
          `session_end.gte.${today},and(session_end.is.null,or(session_start.is.null,session_start.gte.${twoYearsAgo}))`
        )
        // Exclude programs explicitly tagged as adults-only (AARP, adult leagues, etc.)
        .not("tags", "cs", "{adults-only}");

      if (typeFilter && isValidString(typeFilter, 1, 50)) {
        q = q.eq("program_type", typeFilter);
      }

      if (seasonFilter && isValidString(seasonFilter, 1, 50)) {
        q = q.eq("season", seasonFilter);
      }

      if (ageFilter !== null) {
        q = q
          .or(`age_min.is.null,age_min.lte.${ageFilter}`)
          .or(`age_max.is.null,age_max.gte.${ageFilter}`);
      }

      if (activeOnly) {
        // session_end filter is already applied unconditionally above.
        // Exclude adult-only programs: age_min > 17 means no one under 18 qualifies,
        // age_max > 60 means the program spans well into adult range (not family-focused)
        q = q.or(`age_min.is.null,age_min.lte.17`);
        q = q.or(`age_max.is.null,age_max.lte.60`);
        // Freshness guard: exclude programs whose session_start is more than 1 year
        // in the past AND session_end is NULL (stale data with no explicit end date).
        // Programs with no session_start at all are kept (they have no staleness signal).
        const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        q = q.or(
          `session_start.is.null,session_start.gte.${oneYearAgo},session_end.not.is.null`
        );
      }

      if (registrationFilter && isValidString(registrationFilter, 1, 100)) {
        const statuses = registrationFilter
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (statuses.length > 0) {
          q = q.in("registration_status", statuses);
        }
      }

      if (costMaxFilter !== null) {
        const costMax = parseFloat(costMaxFilter);
        if (!isNaN(costMax)) {
          q = q.or(`cost_amount.is.null,cost_amount.lte.${costMax}`);
        }
      }

      if (dayFilter !== null && dayFilter >= 1 && dayFilter <= 7) {
        q = q.contains("schedule_days", [dayFilter]);
      }

      if (qFilter && isValidString(qFilter, 1, 200)) {
        const escaped = escapeSQLPattern(qFilter);
        q = q.or(`name.ilike.%${escaped}%,description.ilike.%${escaped}%`);
      }

      // tag filter: array containment — programs whose tags include the requested activity tag
      const VALID_ACTIVITY_TAGS = new Set([
        "sports", "arts", "stem", "nature", "swimming", "coding",
        "theater", "dance", "gymnastics", "music", "cooking", "general",
      ]);
      if (tagFilter && isValidString(tagFilter, 1, 30) && VALID_ACTIVITY_TAGS.has(tagFilter)) {
        q = q.contains("tags", [tagFilter]);
      }

      return q;
    }

    // Run data query and count query in parallel.
    // The count query has identical filters but uses head:true to avoid fetching rows.
    // Note: post-query JS filters (ADULT_TITLE_RE, PAST_SCHOOL_YEAR_RE, environmentFilter)
    // cannot be reflected in the DB count, so total is a slight overcount — acceptable and standard.
    let dataQuery = applyProgramFilters(
      serviceClient.from("programs").select(
        `
        id,
        portal_id,
        source_id,
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
        venue:places(id, name, neighborhood, address, city, lat, lng, image_url, indoor_outdoor)
      `
      )
    );

    const countQuery = applyProgramFilters(
      serviceClient.from("programs").select("id", { count: "exact", head: true })
    );

    // environment filter: uses the venue's indoor_outdoor classification
    // We filter post-query (client-side) since Supabase doesn't support filtering
    // on nested joins via query builder. The index on venues.indoor_outdoor still
    // speeds up the DB read; we just do the final filter in JS.

    // Apply sort to data query only
    switch (sortParam) {
      case "session_start":
        dataQuery = dataQuery.order("session_start", {
          ascending: true,
          nullsFirst: false,
        });
        break;
      case "cost":
        dataQuery = dataQuery.order("cost_amount", {
          ascending: true,
          nullsFirst: true,
        });
        break;
      case "registration_urgency":
        // open first, then waitlist, then upcoming — DB will sort by inserted value
        dataQuery = dataQuery.order("registration_status", {
          ascending: true,
        });
        break;
      default:
        dataQuery = dataQuery.order("session_start", {
          ascending: true,
          nullsFirst: false,
        });
    }

    dataQuery = dataQuery.range(offset, offset + limit - 1);

    const [
      { data: programsData, error: programsError },
      { count: totalCount, error: countError },
    ] = await Promise.all([dataQuery, countQuery]);

    if (programsError) {
      return errorResponse(programsError, "GET /api/programs");
    }

    if (countError) {
      return errorResponse(countError, "GET /api/programs (count)");
    }

    type ProgramRow = {
      id: string;
      portal_id: string | null;
      source_id: number | null;
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
        indoor_outdoor: "indoor" | "outdoor" | "both" | null;
      } | null;
    };

    // Post-query: filter out adult-titled programs that slip through DB filters
    const ADULT_TITLE_RE = /\badult/i;
    // Post-query: filter out programs whose title contains a past school-year range
    // (e.g. "N.H Scott 2021-2022 Girls Basketball"). These have stale session_start
    // dates and fabricated far-future session_end values that bypass temporal gates.
    // Matches year ranges where the starting year ends before 2025.
    const PAST_SCHOOL_YEAR_RE = /\b20(1\d|2[0-4])[-\u2013]\d{2,4}\b/;
    let programs = ((programsData ?? []) as ProgramRow[]).filter(
      (p) => !ADULT_TITLE_RE.test(p.name) && !PAST_SCHOOL_YEAR_RE.test(p.name)
    );

    // Post-query: environment filter on venue.indoor_outdoor
    // We filter here rather than in SQL because Supabase query builder doesn't
    // support WHERE conditions on nested join columns.
    if (environmentFilter && isValidString(environmentFilter, 1, 20)) {
      const validEnvValues = new Set(["indoor", "outdoor", "both"]);
      if (validEnvValues.has(environmentFilter)) {
        programs = programs.filter((p) => {
          const env = p.venue?.indoor_outdoor;
          if (!env) return false; // skip unknown-classified venues
          if (environmentFilter === "indoor") return env === "indoor" || env === "both";
          if (environmentFilter === "outdoor") return env === "outdoor" || env === "both";
          return env === environmentFilter;
        });
      }
    }

    // Compatibility mode only: fall back to recurring events when explicitly requested.
    if (programs.length === 0 && offset === 0 && includeEventsFallback) {
      // sourceIds and serviceClient are already resolved above for the main query.
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
          venue:places(id, name, neighborhood, address, city, lat, lng, image_url)
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
          compatibility_mode: "include_events_fallback",
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
        total: totalCount ?? programs.length,
        offset,
        limit,
        source: "programs",
        compatibility_mode: includeEventsFallback ? "include_events_fallback" : null,
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
