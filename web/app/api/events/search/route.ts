import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, isValidString, escapeSQLPattern } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

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

  if (!query || !isValidString(query, 1, 100)) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
  }

  const supabase = await createClient();

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
      venue:venues(id, name, neighborhood),
      organization:organizations(id, name)
    `
    )
    .ilike("title", `%${escapeSQLPattern(normalizedQuery)}%`)
    .gte("start_date", new Date().toISOString().split("T")[0])
    .order("start_date", { ascending: true })
    .limit(limit);

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
    } | null;
    organization: {
      id: string;
      name: string;
    } | null;
  };

  const events = eventsData as EventResult[] | null;

  // Sort results: exact matches first, then prefix matches, then by date
  const sortedEvents = (events || []).sort((a, b) => {
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
