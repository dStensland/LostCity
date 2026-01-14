import { getFilteredEventsWithSearch, PRICE_FILTERS, type SearchFilters } from "@/lib/search";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Parse price filter - same logic as page.tsx
  const priceParam = searchParams.get("price");
  const priceFilter = PRICE_FILTERS.find(p => p.value === priceParam);
  const isFree = priceParam === "free" || undefined;
  const priceMax = priceFilter?.max || undefined;

  const filters: SearchFilters = {
    search: searchParams.get("search") || undefined,
    categories: searchParams.get("categories")?.split(",").filter(Boolean) || undefined,
    subcategories: searchParams.get("subcategories")?.split(",").filter(Boolean) || undefined,
    is_free: isFree,
    price_max: priceMax,
    date_filter: (searchParams.get("date") as "today" | "weekend" | "week") || undefined,
    venue_id: searchParams.get("venue") ? parseInt(searchParams.get("venue")!, 10) : undefined,
  };

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = 20;

  const { events, total } = await getFilteredEventsWithSearch(filters, page, pageSize);

  return Response.json({
    events,
    hasMore: page * pageSize < total,
    total,
  });
}
