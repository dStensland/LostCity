import { getFilteredEventsWithSearch, enrichEventsWithSocialProof, getEventsForMap, PRICE_FILTERS, type SearchFilters } from "@/lib/search";
import { getPortalBySlug, DEFAULT_PORTAL } from "@/lib/portal";
import { getPortalSections } from "@/lib/portal-sections";
import { getSpotsWithEventCounts } from "@/lib/spots";
import SearchBar from "@/components/SearchBar";
import FilterBar from "@/components/FilterBar";
import EventList from "@/components/EventList";
import ModeToggle from "@/components/ModeToggle";
import ViewToggle from "@/components/ViewToggle";
import SpotCard from "@/components/SpotCard";
import MapViewWrapper from "@/components/MapViewWrapper";
import Logo from "@/components/Logo";
import HomeFriendsActivity from "@/components/HomeFriendsActivity";
import PopularThisWeek from "@/components/PopularThisWeek";
import GlassHeader from "@/components/GlassHeader";
import { PortalSection } from "@/components/PortalSection";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export const revalidate = 60;

const PAGE_SIZE = 20;

type ViewMode = "events" | "venues" | "map";

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

  // Current view mode
  const viewMode: ViewMode = searchParamsData.view || "events";

  // Parse price filter
  const priceFilter = PRICE_FILTERS.find(p => p.value === searchParamsData.price);
  const isFree = searchParamsData.price === "free";
  const priceMax = priceFilter?.max || undefined;

  // Build filters, incorporating portal-specific filters
  // User's search params can override portal defaults for categories/neighborhoods
  const filters: SearchFilters = {
    search: searchParamsData.search || undefined,
    // Categories: user selection overrides portal default
    categories: searchParamsData.categories?.split(",").filter(Boolean) || portal.filters.categories || undefined,
    subcategories: searchParamsData.subcategories?.split(",").filter(Boolean) || undefined,
    // Tags: combine user and portal tags
    tags: searchParamsData.tags?.split(",").filter(Boolean) || portal.filters.tags || undefined,
    vibes: searchParamsData.vibes?.split(",").filter(Boolean) || undefined,
    // Neighborhoods: user selection overrides portal default
    neighborhoods: searchParamsData.neighborhoods?.split(",").filter(Boolean) || portal.filters.neighborhoods || undefined,
    is_free: isFree || undefined,
    // Price: user selection overrides portal default
    price_max: priceMax || portal.filters.price_max || undefined,
    date_filter: (searchParamsData.date as "now" | "today" | "weekend" | "week") || undefined,
    // Portal-specific filters (cannot be overridden by user)
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
  let spots: Awaited<ReturnType<typeof getSpotsWithEventCounts>> = [];
  let mapEvents: Awaited<ReturnType<typeof getEventsForMap>> = [];
  let sections: Awaited<ReturnType<typeof getPortalSections>> = [];

  if (viewMode === "events") {
    const { events: rawEvents, total: eventTotal } = await getFilteredEventsWithSearch(filters, 1, PAGE_SIZE);
    events = await enrichEventsWithSocialProof(rawEvents);
    total = eventTotal;
    // Fetch curated sections (only if no active filters applied)
    if (!searchParamsData.search && !searchParamsData.categories) {
      sections = await getPortalSections(portal.id);
    }
  } else if (viewMode === "venues") {
    spots = await getSpotsWithEventCounts("all", "", "all", searchParamsData.search || "");
  } else if (viewMode === "map") {
    mapEvents = await getEventsForMap(filters);
  }

  const hasActiveFilters = !!(searchParamsData.search || searchParamsData.categories || searchParamsData.subcategories || searchParamsData.tags || searchParamsData.vibes || searchParamsData.neighborhoods || searchParamsData.price || searchParamsData.date);

  return (
    <div className="min-h-screen">
      {/* Header with glass effect on scroll */}
      <GlassHeader
        portalSlug={portal.slug}
        portalName={portal.name}
        branding={portal.branding}
      />

      {/* Mode Toggle + View Toggle + Search */}
      <section className="py-4 sm:py-6 border-b border-[var(--twilight)]">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <ModeToggle />
            {/* View Toggle */}
            <Suspense fallback={null}>
              <ViewToggle />
            </Suspense>
            {/* Search Bar */}
            <div className="flex-1 max-w-md">
              <Suspense fallback={<div className="h-10 bg-[var(--night)] rounded-lg animate-pulse" />}>
                <SearchBar />
              </Suspense>
            </div>
          </div>
        </div>
      </section>

      {/* Filters - only show for events view */}
      {viewMode === "events" && (
        <Suspense fallback={<div className="h-24 bg-[var(--night)]" />}>
          <FilterBar />
        </Suspense>
      )}

      {/* Popular This Week - only shows for events view */}
      {viewMode === "events" && (
        <Suspense fallback={null}>
          <PopularThisWeek />
        </Suspense>
      )}

      {/* Curated Sections - only show on events view without filters */}
      {viewMode === "events" && sections.length > 0 && (
        <div className="border-b border-[var(--twilight)]">
          {sections.map((section) => (
            <PortalSection key={section.id} section={section} />
          ))}
        </div>
      )}

      {/* Count indicator */}
      <div className="max-w-3xl mx-auto px-4 border-b border-[var(--twilight)]">
        <p className="font-mono text-xs text-[var(--muted)] py-3">
          <span className="text-[var(--soft)]">
            {viewMode === "events" ? total : viewMode === "venues" ? spots.length : mapEvents.length}
          </span>{" "}
          {viewMode === "events"
            ? hasActiveFilters ? "matching events" : "upcoming events"
            : viewMode === "venues"
            ? "venues"
            : "events on map"}
        </p>
      </div>

      {/* Main Content */}
      <main className={viewMode === "map" ? "" : "max-w-3xl mx-auto px-4 pb-12"}>
        {/* Events View */}
        {viewMode === "events" && (
          <>
            {/* Friends Activity - only shows for logged-in users with friends */}
            <div className="pt-4">
              <HomeFriendsActivity />
            </div>

            <Suspense fallback={<div className="py-16 text-center text-[var(--muted)]">Loading events...</div>}>
              <EventList
                initialEvents={events}
                initialTotal={total}
                hasActiveFilters={hasActiveFilters}
              />
            </Suspense>
          </>
        )}

        {/* Venues View */}
        {viewMode === "venues" && (
          <div className="pt-4">
            {spots.length > 0 ? (
              spots.map((spot, index) => (
                <SpotCard key={spot.id} spot={spot} index={index} />
              ))
            ) : (
              <div className="py-16 text-center text-[var(--muted)]">
                No venues found
              </div>
            )}
          </div>
        )}

        {/* Map View */}
        {viewMode === "map" && (
          <div className="h-[calc(100vh-200px)] min-h-[400px]">
            <Suspense fallback={<div className="h-full bg-[var(--night)] animate-pulse" />}>
              <MapViewWrapper events={mapEvents} />
            </Suspense>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--twilight)] bg-[var(--night)]">
        <div className="max-w-3xl mx-auto px-4 py-8 text-center">
          <Logo size="md" href={undefined} />
          <p className="font-serif text-[var(--muted)] mt-1">
            {portal.tagline || `The real ${portal.name}, found`}
          </p>
          <p className="font-mono text-[0.6rem] text-[var(--muted)] mt-4 opacity-60">
            AI-powered · Updated continuously
          </p>
        </div>
      </footer>
    </div>
  );
}
