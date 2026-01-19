import { getFilteredEventsWithSearch, enrichEventsWithSocialProof, getEventsForMap, PRICE_FILTERS, type SearchFilters } from "@/lib/search";
import { getPortalBySlug, DEFAULT_PORTAL } from "@/lib/portal";
import FilterBar from "@/components/FilterBar";
import MainNav from "@/components/MainNav";
import EventList from "@/components/EventList";
import MapViewWrapper from "@/components/MapViewWrapper";
import FeedView from "@/components/FeedView";
import GlassHeader from "@/components/GlassHeader";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export const revalidate = 60;

const PAGE_SIZE = 20;

type ViewMode = "events" | "map" | "feed";

type Props = {
  params: Promise<{ portal: string }>;
  searchParams: Promise<{
    search?: string;
    categories?: string;
    subcategories?: string;
    tags?: string;
    vibes?: string;
    neighborhoods?: string;
    price?: string;
    date?: string;
    view?: ViewMode;
    mood?: string;
  }>;
};

export default async function PortalPage({ params, searchParams }: Props) {
  const { portal: slug } = await params;
  const searchParamsData = await searchParams;

  // Get portal data
  let portal = await getPortalBySlug(slug);

  // Fallback for Atlanta if not in database
  if (!portal && slug === "atlanta") {
    portal = DEFAULT_PORTAL;
  }

  if (!portal) {
    notFound();
  }

  // Current view mode (events, map, or feed)
  const viewMode: ViewMode = searchParamsData.view === "map" ? "map" : searchParamsData.view === "feed" ? "feed" : "events";

  // Parse price filter
  const priceFilter = PRICE_FILTERS.find(p => p.value === searchParamsData.price);
  const isFree = searchParamsData.price === "free";
  const priceMax = priceFilter?.max || undefined;

  // Build filters, incorporating portal-specific filters
  const filters: SearchFilters = {
    search: searchParamsData.search || undefined,
    categories: searchParamsData.categories?.split(",").filter(Boolean) || portal.filters.categories || undefined,
    subcategories: searchParamsData.subcategories?.split(",").filter(Boolean) || undefined,
    tags: searchParamsData.tags?.split(",").filter(Boolean) || portal.filters.tags || undefined,
    vibes: searchParamsData.vibes?.split(",").filter(Boolean) || undefined,
    neighborhoods: searchParamsData.neighborhoods?.split(",").filter(Boolean) || portal.filters.neighborhoods || undefined,
    is_free: isFree || undefined,
    price_max: priceMax || portal.filters.price_max || undefined,
    date_filter: (searchParamsData.date as "now" | "today" | "weekend" | "week") || undefined,
    mood: searchParamsData.mood as import("@/lib/moods").MoodId || undefined,
    city: portal.filters.city || undefined,
    exclude_categories: portal.filters.exclude_categories || undefined,
    date_range_start: portal.filters.date_range_start || undefined,
    date_range_end: portal.filters.date_range_end || undefined,
    venue_ids: portal.filters.venue_ids || undefined,
    geo_center: portal.filters.geo_center || undefined,
    geo_radius_km: portal.filters.geo_radius_km || undefined,
  };

  // Fetch data based on view mode
  let events: Awaited<ReturnType<typeof enrichEventsWithSocialProof>> = [];
  let total = 0;
  let mapEvents: Awaited<ReturnType<typeof getEventsForMap>> = [];

  if (viewMode === "events") {
    const { events: rawEvents, total: eventTotal } = await getFilteredEventsWithSearch(filters, 1, PAGE_SIZE);
    events = await enrichEventsWithSocialProof(rawEvents);
    total = eventTotal;
  } else if (viewMode === "map") {
    mapEvents = await getEventsForMap(filters);
  }

  const hasActiveFilters = !!(searchParamsData.search || searchParamsData.categories || searchParamsData.subcategories || searchParamsData.tags || searchParamsData.vibes || searchParamsData.neighborhoods || searchParamsData.price || searchParamsData.date || searchParamsData.mood);

  return (
    <div className="min-h-screen">
      <GlassHeader
        portalSlug={portal.slug}
        portalName={portal.name}
        branding={portal.branding}
      />

      <Suspense fallback={<div className="h-10 bg-[var(--night)]" />}>
        <MainNav portalSlug={portal.slug} />
      </Suspense>

      {viewMode === "events" && (
        <Suspense fallback={<div className="h-10 bg-[var(--night)]" />}>
          <FilterBar />
        </Suspense>
      )}

      <main className={viewMode === "map" ? "" : "max-w-3xl mx-auto px-4 pb-16"}>
        {viewMode === "events" && (
          <Suspense fallback={<div className="py-16 text-center text-[var(--muted)]">Loading...</div>}>
            <EventList
              initialEvents={events}
              initialTotal={total}
              hasActiveFilters={hasActiveFilters}
            />
          </Suspense>
        )}

        {viewMode === "feed" && (
          <Suspense fallback={<div className="py-16 text-center text-[var(--muted)]">Loading...</div>}>
            <FeedView />
          </Suspense>
        )}

        {viewMode === "map" && (
          <div className="h-[calc(100vh-56px)]">
            <Suspense fallback={<div className="h-full bg-[var(--night)] animate-pulse" />}>
              <MapViewWrapper events={mapEvents} />
            </Suspense>
          </div>
        )}
      </main>
    </div>
  );
}
