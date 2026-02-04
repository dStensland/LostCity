import { getCachedPortalBySlug } from "@/lib/portal";
import { PortalHeader } from "@/components/headers";
import { AmbientBackground } from "@/components/ambient";
import FindView from "@/components/find/FindView";
import CommunityView from "@/components/community/CommunityView";
import DetailViewRouter from "@/components/views/DetailViewRouter";
import { DefaultTemplate } from "./_templates/default";
import { GalleryTemplate } from "./_templates/gallery";
import { TimelineTemplate } from "./_templates/timeline";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export const revalidate = 60;

type ViewMode = "feed" | "find" | "community";
type FeedTab = "curated" | "foryou";
type FindType = "events" | "classes" | "destinations" | "orgs";
type FindDisplay = "list" | "map" | "calendar";

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
    tab?: string;
    type?: string;
    display?: string;
    mood?: string;
    // Detail view params
    event?: string;
    spot?: string;
    series?: string;
    org?: string;
  }>;
};

export default async function PortalPage({ params, searchParams }: Props) {
  const { portal: slug } = await params;
  const searchParamsData = await searchParams;

  // Get portal data - all portals must exist in database
  const portal = await getCachedPortalBySlug(slug);

  if (!portal) {
    notFound();
  }

  // Parse view mode - support legacy views for backwards compatibility
  const viewParam = searchParamsData.view;
  let viewMode: ViewMode = "feed";

  // Map legacy view params to new structure
  if (viewParam === "find" || viewParam === "events" || viewParam === "spots" || viewParam === "map" || viewParam === "calendar") {
    viewMode = "find";
  } else if (viewParam === "community") {
    viewMode = "community";
  } else if (viewParam === "feed" || !viewParam) {
    viewMode = "feed";
  }

  // Parse sub-parameters - handle legacy "activity" tab by treating it as curated
  let feedTab: FeedTab = "curated";
  if (searchParamsData.tab === "foryou") {
    feedTab = "foryou";
  }

  // Determine find type - support legacy view params
  let findType: FindType = "events";
  if (searchParamsData.type) {
    findType = searchParamsData.type as FindType;
  } else if (viewParam === "spots") {
    findType = "destinations";
  }

  // Determine display mode - support legacy view params
  let findDisplay: FindDisplay = "list";
  if (searchParamsData.display) {
    findDisplay = searchParamsData.display as FindDisplay;
  } else if (viewParam === "map") {
    findDisplay = "map";
  } else if (viewParam === "calendar") {
    findDisplay = "calendar";
  }

  // Community sub-tab - default to "people" (Your People)
  let communityTab: "people" | "lists" | "groups" = "people";
  if (searchParamsData.tab === "groups") {
    communityTab = "groups";
  } else if (searchParamsData.tab === "lists") {
    communityTab = "lists";
  }

  // Check for active filters
  const hasActiveFilters = !!(
    searchParamsData.search ||
    searchParamsData.categories ||
    searchParamsData.subcategories ||
    searchParamsData.tags ||
    searchParamsData.vibes ||
    searchParamsData.neighborhoods ||
    searchParamsData.price ||
    searchParamsData.free ||
    searchParamsData.date ||
    searchParamsData.mood
  );

  return (
    <div className="min-h-screen">
      {/* Portal-aware ambient background effect */}
      <AmbientBackground />

      {/* Portal-aware header (template selected from branding) */}
      <PortalHeader
        portalSlug={portal.slug}
        portalName={portal.name}
      />

      <main className={findDisplay === "map" && viewMode === "find" ? "" : "max-w-5xl mx-auto px-4 pb-20"}>
        {/* DetailViewRouter handles showing detail views (event, venue, series, org) as overlays.
            It uses useSearchParams which requires Suspense, but we use a minimal fallback since
            each content view below has its own appropriate skeleton. */}
        <Suspense fallback={null}>
          <DetailViewRouter portalSlug={portal.slug}>
            {/* Business portals with a parent_portal_id are white-label portals that show
                filtered public events, not exclusive events. Only standalone business portals
                (no parent) should be exclusive. */}
            {(() => {
              const isExclusive = portal.portal_type === "business" && !portal.parent_portal_id;

              return (
                <>
                  {viewMode === "feed" && (
                    <Suspense fallback={<FeedSkeleton />}>
                      {/* Template system - select based on portal.page_template */}
                      {portal.page_template === "gallery" ? (
                        <GalleryTemplate portal={portal} />
                      ) : portal.page_template === "timeline" ? (
                        <TimelineTemplate portal={portal} />
                      ) : (
                        /* Default template for backwards compatibility */
                        <DefaultTemplate portal={portal} feedTab={feedTab} />
                      )}
                    </Suspense>
                  )}

                  {viewMode === "find" && (
                    <Suspense fallback={<FindViewSkeleton />}>
                      <FindView
                        portalId={portal.id}
                        portalSlug={portal.slug}
                        portalExclusive={isExclusive}
                        findType={findType}
                        displayMode={findDisplay}
                        hasActiveFilters={hasActiveFilters}
                      />
                    </Suspense>
                  )}

                  {viewMode === "community" && (
                    <Suspense fallback={<CommunityViewSkeleton />}>
                      <CommunityView
                        portalId={portal.id}
                        portalSlug={portal.slug}
                        portalName={portal.name}
                        activeTab={communityTab}
                      />
                    </Suspense>
                  )}
                </>
              );
            })()}
          </DetailViewRouter>
        </Suspense>
      </main>
    </div>
  );
}

// Loading skeletons - optimized to prevent layout shift
function FindViewSkeleton() {
  return (
    <div className="py-6 space-y-4">
      {/* Type selector skeleton */}
      <div className="flex gap-1 p-1 bg-[var(--night)] rounded-xl border border-[var(--twilight)]/30 max-w-md">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 h-10 skeleton-shimmer rounded-lg" />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="space-y-3 mt-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 skeleton-shimmer rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function CommunityViewSkeleton() {
  return (
    <div className="py-6 space-y-4">
      {/* Tab skeleton */}
      <div className="flex gap-1 p-1 bg-[var(--night)] rounded-xl border border-[var(--twilight)]/30">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 h-10 skeleton-shimmer rounded-lg" />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="space-y-3 mt-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 skeleton-shimmer rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="py-6 space-y-6">
      {/* Feed tabs skeleton */}
      <div className="flex gap-1 p-1 bg-[var(--night)] rounded-xl border border-[var(--twilight)]/30 max-w-xs">
        <div className="flex-1 h-10 skeleton-shimmer rounded-lg" />
        <div className="flex-1 h-10 skeleton-shimmer rounded-lg" />
      </div>
      {/* Live now banner skeleton */}
      <div className="h-16 skeleton-shimmer rounded-xl" />
      {/* Tonight's picks skeleton */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 skeleton-shimmer rounded-full" />
          <div className="space-y-2">
            <div className="h-6 w-40 skeleton-shimmer rounded" />
            <div className="h-3 w-32 skeleton-shimmer rounded" />
          </div>
        </div>
        <div className="h-48 skeleton-shimmer rounded-xl" />
      </div>
      {/* Event cards skeleton */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 skeleton-shimmer rounded-xl" />
        ))}
      </div>
    </div>
  );
}
