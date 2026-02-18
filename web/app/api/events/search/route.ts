import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, isValidString, escapeSQLPattern } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";
import { applyPortalScopeToQuery, filterByPortalCity } from "@/lib/portal-scope";

// GET /api/events/search?q= - Search events for autocomplete
export async function GET(request: NextRequest) {
  // Apply rate limit (use search limit)
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.search,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 20);
  const portalExclusive = searchParams.get("portal_exclusive") === "true";
  const excludeClasses = searchParams.get("exclude_classes") === "true";
  const classesOnly = searchParams.get("classes_only") === "true";

  if (!query || !isValidString(query, 1, 100)) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const portalContext = await resolvePortalQueryContext(supabase, searchParams);
  if (portalContext.hasPortalParamMismatch) {
    return NextResponse.json(
      { error: "portal and portal_id parameters must reference the same portal" },
      { status: 400 }
    );
  }
  const portalCity = !portalExclusive ? portalContext.filters.city : undefined;

  // Normalize search query
  const normalizedQuery = query.toLowerCase().trim();

  // Search events by title
  let searchQuery = supabase
    .from("events")
    .select(
      `
      id,
      title,
      slug,
      start_date,
      end_date,
      is_all_day,
      venue:venues(id, name, neighborhood, city, location_designator),
      organization:organizations(id, name)
    `
    )
    .ilike("title", `%${escapeSQLPattern(normalizedQuery)}%`)
    .or(`start_date.gte.${new Date().toISOString().split("T")[0]},end_date.gte.${new Date().toISOString().split("T")[0]}`)
    .order("start_date", { ascending: true })
    .limit(limit);

  // Filter by class status
  if (excludeClasses) {
    searchQuery = searchQuery.or("is_class.eq.false,is_class.is.null");
  } else if (classesOnly) {
    searchQuery = searchQuery.eq("is_class", true);
  }

  // Always exclude sensitive content from public search
  searchQuery = searchQuery.or("is_sensitive.eq.false,is_sensitive.is.null");

  searchQuery = applyPortalScopeToQuery(searchQuery, {
    portalId: portalContext.portalId,
    portalExclusive,
    publicOnlyWhenNoPortal: true,
  });

  const { data: eventsData, error } = await searchQuery;

  if (error) {
    return errorResponse(error, "event search");
  }

  type EventResult = {
    id: number;
    title: string;
    slug: string;
    start_date: string;
    end_date: string | null;
    is_all_day: boolean;
    venue: {
      id: number;
      name: string;
      neighborhood: string | null;
      city?: string | null;
      location_designator?:
        | "standard"
        | "private_after_signup"
        | "virtual"
        | "recovery_meeting"
        | null;
    } | null;
    organization: {
      id: string;
      name: string;
    } | null;
  };

  const events = filterByPortalCity((eventsData as EventResult[] | null) || [], portalCity, {
    allowMissingCity: true,
  });

  // Sort results: exact matches first, then prefix matches, then by date
  const sortedEvents = events.sort((a, b) => {
    const aTitle = a.title.toLowerCase();
    const bTitle = b.title.toLowerCase();

    // Exact match gets highest priority
    if (aTitle === normalizedQuery && bTitle !== normalizedQuery) return -1;
    if (bTitle === normalizedQuery && aTitle !== normalizedQuery) return 1;

    // Prefix match gets second priority
    const aPrefix = aTitle.startsWith(normalizedQuery);
    const bPrefix = bTitle.startsWith(normalizedQuery);
    if (aPrefix && !bPrefix) return -1;
    if (bPrefix && !aPrefix) return 1;

    // Then by start date
    return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
  });

  // Format results for autocomplete
  const results = sortedEvents.map((event) => ({
    id: event.id,
    title: event.title,
    slug: event.slug,
    start_date: event.start_date,
    end_date: event.end_date,
    is_all_day: event.is_all_day,
    venue: event.venue,
    organization: event.organization,
    displayLabel: formatEventLabel(event),
  }));

  return NextResponse.json(
    {
      events: results,
      query: query,
      count: results.length,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    }
  );
}

// Format event label for display in autocomplete
function formatEventLabel(event: {
  title: string;
  start_date: string;
  venue: { name: string } | null;
}): string {
  const parts = [event.title];

  // Add date
  const startDate = new Date(event.start_date);
  const formattedDate = startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  parts.push(formattedDate);

  // Add venue name if available
  if (event.venue) {
    parts.push(`@ ${event.venue.name}`);
  }

  return parts.join(" - ");
}
