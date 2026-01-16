import { getFilteredEventsWithSearch, enrichEventsWithSocialProof, PRICE_FILTERS, type SearchFilters } from "@/lib/search";

// Helper to safely parse integers with validation
function safeParseInt(value: string | null, defaultValue: number, min = 1, max = 1000): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultValue;
  return Math.min(Math.max(parsed, min), max);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse price filter - same logic as page.tsx
    const priceParam = searchParams.get("price");
    const priceFilter = PRICE_FILTERS.find(p => p.value === priceParam);
    const isFree = priceParam === "free" || undefined;
    const priceMax = priceFilter?.max || undefined;

    // Parse venue_id with validation
    const venueParam = searchParams.get("venue");
    const venueId = venueParam ? safeParseInt(venueParam, 0, 0, 999999) : undefined;

    const filters: SearchFilters = {
      search: searchParams.get("search") || undefined,
      categories: searchParams.get("categories")?.split(",").filter(Boolean) || undefined,
      subcategories: searchParams.get("subcategories")?.split(",").filter(Boolean) || undefined,
      tags: searchParams.get("tags")?.split(",").filter(Boolean) || undefined,
      vibes: searchParams.get("vibes")?.split(",").filter(Boolean) || undefined,
      neighborhoods: searchParams.get("neighborhoods")?.split(",").filter(Boolean) || undefined,
      is_free: isFree,
      price_max: priceMax,
      date_filter: (searchParams.get("date") as "today" | "weekend" | "week") || undefined,
      venue_id: venueId || undefined,
    };

    const page = safeParseInt(searchParams.get("page"), 1, 1, 100);
    const pageSize = 20;

    const { events: rawEvents, total } = await getFilteredEventsWithSearch(filters, page, pageSize);

    // Enrich with social proof counts (RSVPs, recommendations)
    const events = await enrichEventsWithSocialProof(rawEvents);

    return Response.json({
      events,
      hasMore: page * pageSize < total,
      total,
    });
  } catch (error) {
    console.error("Events API error:", error);
    return Response.json(
      { error: "Failed to fetch events", events: [], hasMore: false, total: 0 },
      { status: 500 }
    );
  }
}
