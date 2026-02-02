import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, isValidString, escapeSQLPattern } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

// GET /api/organizations/search?q= - Search organizations for autocomplete
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
  const category = searchParams.get("category");
  const includeUnverified = searchParams.get("include_unverified") === "true";

  if (!query || !isValidString(query, 1, 100)) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
  }

  const supabase = await createClient();

  // Normalize search query
  const normalizedQuery = query.toLowerCase().trim();

  // Search organizations by name
  let searchQuery = supabase
    .from("organizations")
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
    .ilike("name", `%${escapeSQLPattern(normalizedQuery)}%`)
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

  const { data: organizationsData, error } = await searchQuery;

  if (error) {
    return errorResponse(error, "organization search");
  }

  type OrganizationResult = {
    id: string;
    name: string;
    slug: string;
    org_type: string | null;
    website: string | null;
    neighborhood: string | null;
    city: string | null;
    categories: string[] | null;
    description: string | null;
    logo_url: string | null;
    featured: boolean | null;
    hidden: boolean | null;
    is_verified: boolean | null;
    total_events_tracked: number | null;
  };

  const organizations = organizationsData as OrganizationResult[] | null;

  // Sort results: exact matches first, then prefix matches, then featured, then by event count
  const sortedOrganizations = (organizations || []).sort((a, b) => {
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

    // Featured organizations next
    if (a.featured && !b.featured) return -1;
    if (b.featured && !a.featured) return 1;

    // Then by event count
    return (b.total_events_tracked || 0) - (a.total_events_tracked || 0);
  });

  // Format results for autocomplete
  const results = sortedOrganizations.map((org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    org_type: org.org_type,
    website: org.website,
    neighborhood: org.neighborhood,
    city: org.city,
    categories: org.categories,
    description: org.description,
    logo_url: org.logo_url,
    featured: org.featured,
    is_verified: org.is_verified ?? true, // Default to true for legacy organizations
    total_events: org.total_events_tracked || 0,
    displayLabel: formatOrganizationLabel(org),
  }));

  return NextResponse.json(
    {
      organizations: results,
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

// Format organization label for display in autocomplete
function formatOrganizationLabel(org: {
  name: string;
  org_type: string | null;
  neighborhood: string | null;
}): string {
  const parts = [org.name];

  if (org.org_type) {
    // Convert org_type to readable format
    const typeLabel = org.org_type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    parts.push(`(${typeLabel})`);
  }

  if (org.neighborhood) {
    parts.push(`- ${org.neighborhood}`);
  }

  return parts.join(" ");
}
