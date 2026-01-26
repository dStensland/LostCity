import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, isValidString } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

// GET /api/venues/search?q= - Search venues for autocomplete
export async function GET(request: NextRequest) {
  // Apply rate limit (use search limit)
  const rateLimitResult = applyRateLimit(
    request,
    RATE_LIMITS.search,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 20);
  const neighborhood = searchParams.get("neighborhood");

  if (!query || !isValidString(query, 1, 100)) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
  }

  const supabase = await createClient();

  // Normalize search query
  const normalizedQuery = query.toLowerCase().trim();

  // Search venues by name, aliases, and address
  // Use a combination of exact match, prefix match, and fuzzy matching
  let searchQuery = supabase
    .from("venues")
    .select(
      `
      id,
      name,
      slug,
      address,
      neighborhood,
      city,
      state,
      venue_type,
      aliases
    `
    )
    .or(
      `name.ilike.%${normalizedQuery}%,` +
        `address.ilike.%${normalizedQuery}%,` +
        `aliases.cs.{${normalizedQuery}}`
    )
    .order("name")
    .limit(limit);

  // Filter by neighborhood if provided
  if (neighborhood && isValidString(neighborhood, 1, 50)) {
    searchQuery = searchQuery.eq("neighborhood", neighborhood);
  }

  const { data: venues, error } = await searchQuery;

  if (error) {
    return errorResponse(error, "venue search");
  }

  // Sort results: exact matches first, then prefix matches, then contains matches
  const sortedVenues = (venues || []).sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();

    // Exact match gets highest priority
    if (aName === normalizedQuery && bName !== normalizedQuery) return -1;
    if (bName === normalizedQuery && aName !== normalizedQuery) return 1;

    // Prefix match gets second priority
    const aPrefix = aName.startsWith(normalizedQuery);
    const bPrefix = bName.startsWith(normalizedQuery);
    if (aPrefix && !bPrefix) return -1;
    if (bPrefix && !aPrefix) return 1;

    // Alphabetical for the rest
    return aName.localeCompare(bName);
  });

  // Format results for autocomplete
  const results = sortedVenues.map((venue) => ({
    id: venue.id,
    name: venue.name,
    slug: venue.slug,
    address: venue.address,
    neighborhood: venue.neighborhood,
    city: venue.city,
    state: venue.state,
    venue_type: venue.venue_type,
    // Include matching alias if search matched on alias
    matchedAlias: venue.aliases?.find((alias: string) =>
      alias.toLowerCase().includes(normalizedQuery)
    ),
    displayLabel: formatVenueLabel(venue),
  }));

  return NextResponse.json({
    venues: results,
    query: query,
    count: results.length,
  });
}

// Format venue label for display in autocomplete
function formatVenueLabel(venue: {
  name: string;
  neighborhood: string | null;
  city: string | null;
}): string {
  const parts = [venue.name];
  if (venue.neighborhood) {
    parts.push(venue.neighborhood);
  } else if (venue.city && venue.city !== "Atlanta") {
    parts.push(venue.city);
  }
  return parts.join(" - ");
}
