import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, isValidString } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

// GET /api/producers/search?q= - Search producers for autocomplete
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
  const category = searchParams.get("category");
  const includeUnverified = searchParams.get("include_unverified") === "true";

  if (!query || !isValidString(query, 1, 100)) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
  }

  const supabase = await createClient();

  // Normalize search query
  const normalizedQuery = query.toLowerCase().trim();

  // Search producers by name
  let searchQuery = supabase
    .from("event_producers")
    .select(
      `
      id,
      name,
      slug,
      org_type,
      website,
      neighborhood,
      city,
      categories,
      description,
      logo_url,
      featured,
      hidden,
      is_verified,
      total_events_tracked
    `
    )
    .ilike("name", `%${normalizedQuery}%`)
    .eq("hidden", false)
    .order("featured", { ascending: false })
    .order("total_events_tracked", { ascending: false, nullsFirst: false })
    .limit(limit);

  // Filter by category if provided
  if (category && isValidString(category, 1, 50)) {
    searchQuery = searchQuery.contains("categories", [category]);
  }

  // Filter out unverified unless explicitly requested
  if (!includeUnverified) {
    searchQuery = searchQuery.or("is_verified.eq.true,is_verified.is.null");
  }

  const { data: producers, error } = await searchQuery;

  if (error) {
    return errorResponse(error, "producer search");
  }

  // Sort results: exact matches first, then prefix matches, then featured, then by event count
  const sortedProducers = (producers || []).sort((a, b) => {
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

    // Featured producers next
    if (a.featured && !b.featured) return -1;
    if (b.featured && !a.featured) return 1;

    // Then by event count
    return (b.total_events_tracked || 0) - (a.total_events_tracked || 0);
  });

  // Format results for autocomplete
  const results = sortedProducers.map((producer) => ({
    id: producer.id,
    name: producer.name,
    slug: producer.slug,
    org_type: producer.org_type,
    website: producer.website,
    neighborhood: producer.neighborhood,
    city: producer.city,
    categories: producer.categories,
    description: producer.description,
    logo_url: producer.logo_url,
    featured: producer.featured,
    is_verified: producer.is_verified ?? true, // Default to true for legacy producers
    total_events: producer.total_events_tracked || 0,
    displayLabel: formatProducerLabel(producer),
  }));

  return NextResponse.json({
    producers: results,
    query: query,
    count: results.length,
  });
}

// Format producer label for display in autocomplete
function formatProducerLabel(producer: {
  name: string;
  org_type: string | null;
  neighborhood: string | null;
}): string {
  const parts = [producer.name];

  if (producer.org_type) {
    // Convert org_type to readable format
    const typeLabel = producer.org_type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    parts.push(`(${typeLabel})`);
  }

  if (producer.neighborhood) {
    parts.push(`- ${producer.neighborhood}`);
  }

  return parts.join(" ");
}
