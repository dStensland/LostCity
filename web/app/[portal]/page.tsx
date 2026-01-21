import { PRICE_FILTERS, type SearchFilters } from "@/lib/search";
import { getPortalBySlug, DEFAULT_PORTAL } from "@/lib/portal";
import FilterBar from "@/components/FilterBar";
import MainNav from "@/components/MainNav";
import EventList from "@/components/EventList";
import MapViewWrapper from "@/components/MapViewWrapper";
import FeedView from "@/components/FeedView";
import CalendarView from "@/components/CalendarView";
import GlassHeader from "@/components/GlassHeader";
import SearchBar from "@/components/SearchBar";
import PortalSpotsView from "@/components/PortalSpotsView";
import PortalHappeningNow from "@/components/PortalHappeningNow";
import PortalCommunityView from "@/components/PortalCommunityView";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export const revalidate = 60;

const PAGE_SIZE = 20;

type ViewMode = "events" | "map" | "calendar" | "feed" | "spots" | "happening-now" | "community";

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
    view?: string;
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

  // Current view mode - Feed is the default
  const view = searchParamsData.view;
  const viewMode: ViewMode =
    view === "map" ? "map" :
    view === "calendar" ? "calendar" :
    view === "events" ? "events" :
    view === "spots" ? "spots" :
    view === "happening-now" ? "happening-now" :
    view === "community" ? "community" :
    "feed";

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
    portal_id: portal.id,  // Pass portal ID to filter portal-restricted events
    portal_exclusive: portal.portal_type === "business",  // Business portals only show their own events
  };

  // Don't block on data - let views fetch their own data client-side for instant navigation
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

      {viewMode !== "feed" && (
        <div className="border-b border-[var(--twilight)] bg-[var(--night)]/95 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto px-4 py-2">
            <SearchBar />
          </div>
        </div>
      )}

      {(viewMode === "events" || viewMode === "map" || viewMode === "calendar") && (
        <Suspense fallback={<div className="h-10 bg-[var(--night)]" />}>
          <FilterBar variant={viewMode === "map" ? "compact" : "full"} />
        </Suspense>
      )}

      <main className={viewMode === "map" ? "" : "max-w-3xl mx-auto px-4 pb-16"}>
        {viewMode === "events" && (
          <EventList
            hasActiveFilters={hasActiveFilters}
            portalId={portal.id}
            portalExclusive={portal.portal_type === "business"}
            portalSlug={portal.slug}
          />
        )}

        {viewMode === "calendar" && (
          <Suspense fallback={<div className="py-16 text-center text-[var(--muted)]">Loading calendar...</div>}>
            <CalendarView
              portalId={portal.id}
              portalSlug={portal.slug}
              portalExclusive={portal.portal_type === "business"}
            />
          </Suspense>
        )}

        {viewMode === "feed" && (
          <Suspense fallback={<div className="py-16 text-center text-[var(--muted)]">Loading...</div>}>
            <FeedView />
          </Suspense>
        )}

        {viewMode === "map" && (
          <div className="h-[calc(100vh-180px)]">
            <MapViewWrapper
              portalId={portal.id}
              portalExclusive={portal.portal_type === "business"}
            />
          </div>
        )}

        {viewMode === "spots" && (
          <Suspense fallback={<div className="py-16 text-center text-[var(--muted)]">Loading spots...</div>}>
            <PortalSpotsView portalId={portal.id} portalSlug={portal.slug} isExclusive={portal.portal_type === "business"} />
          </Suspense>
        )}

        {viewMode === "happening-now" && (
          <Suspense fallback={<div className="py-16 text-center text-[var(--muted)]">Loading live events...</div>}>
            <PortalHappeningNow portalId={portal.id} portalSlug={portal.slug} isExclusive={portal.portal_type === "business"} />
          </Suspense>
        )}

        {viewMode === "community" && (
          <Suspense fallback={<div className="py-16 text-center text-[var(--muted)]">Loading community...</div>}>
            <PortalCommunityView portalId={portal.id} portalSlug={portal.slug} portalName={portal.name} />
          </Suspense>
        )}
      </main>
    </div>
  );
}
