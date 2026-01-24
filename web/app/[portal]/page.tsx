import { getPortalBySlug } from "@/lib/portal";
import SimpleFilterBar from "@/components/SimpleFilterBar";
import EventList from "@/components/EventList";
import MapViewWrapper from "@/components/MapViewWrapper";
import FeedView from "@/components/FeedView";
import CalendarView from "@/components/CalendarView";
import UnifiedHeader from "@/components/UnifiedHeader";
import SearchBar from "@/components/SearchBar";
import PortalSpotsView from "@/components/PortalSpotsView";
import PortalCommunityView from "@/components/PortalCommunityView";
import TrendingNow from "@/components/TrendingNow";
import TonightsPicks from "@/components/TonightsPicks";
import TonightsPicksSkeleton from "@/components/TonightsPicksSkeleton";
import TrendingNowSkeleton from "@/components/TrendingNowSkeleton";
import DynamicAmbient from "@/components/DynamicAmbient";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export const revalidate = 60;

type ViewMode = "events" | "map" | "calendar" | "feed" | "spots" | "community";

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
    free?: string;
    date?: string;
    view?: string;
    mood?: string;
  }>;
};

export default async function PortalPage({ params, searchParams }: Props) {
  const { portal: slug } = await params;
  const searchParamsData = await searchParams;

  // Get portal data - all portals must exist in database
  const portal = await getPortalBySlug(slug);

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
    view === "community" ? "community" :
    "feed";

  // Don't block on data - let views fetch their own data client-side for instant navigation
  const hasActiveFilters = !!(searchParamsData.search || searchParamsData.categories || searchParamsData.subcategories || searchParamsData.tags || searchParamsData.vibes || searchParamsData.neighborhoods || searchParamsData.price || searchParamsData.free || searchParamsData.date || searchParamsData.mood);

  return (
    <div className="min-h-screen">
      {/* Dynamic ambient glow based on category */}
      <Suspense fallback={null}>
        <DynamicAmbient />
      </Suspense>

      <UnifiedHeader
        portalSlug={portal.slug}
        portalName={portal.name}
        branding={portal.branding}
      />

      {viewMode !== "feed" && (
        <div className="sticky top-[52px] z-30 border-b border-[var(--twilight)] bg-[var(--night)] backdrop-blur-md">
          <div className="max-w-3xl mx-auto px-4 pt-1 pb-2">
            <SearchBar />
          </div>
        </div>
      )}

      {(viewMode === "events" || viewMode === "map" || viewMode === "calendar") && (
        <Suspense fallback={<div className="h-10 bg-[var(--night)]" />}>
          <SimpleFilterBar variant={viewMode === "map" ? "compact" : "full"} />
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
          <>
            <Suspense fallback={<TonightsPicksSkeleton />}>
              <TonightsPicks portalSlug={portal.slug} />
            </Suspense>
            <Suspense fallback={<TrendingNowSkeleton />}>
              <TrendingNow portalSlug={portal.slug} />
            </Suspense>
            <Suspense fallback={null}>
              <FeedView />
            </Suspense>
          </>
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

        {viewMode === "community" && (
          <Suspense fallback={<div className="py-16 text-center text-[var(--muted)]">Loading community...</div>}>
            <PortalCommunityView portalId={portal.id} portalSlug={portal.slug} portalName={portal.name} />
          </Suspense>
        )}
      </main>
    </div>
  );
}
