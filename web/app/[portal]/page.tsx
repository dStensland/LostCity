import { getPortalBySlug } from "@/lib/portal";
import { PortalHeader } from "@/components/headers";
import { AmbientBackground } from "@/components/ambient";
import SearchBarWrapper from "@/components/SearchBarWrapper";
import FeedShell from "@/components/feed/FeedShell";
import CuratedContent from "@/components/feed/CuratedContent";
import FindView from "@/components/find/FindView";
import { FamilyFeed } from "@/components/family";
import CommunityView from "@/components/community/CommunityView";
import DetailViewRouter from "@/components/views/DetailViewRouter";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export const revalidate = 60;

type ViewMode = "feed" | "find" | "community";
type FeedTab = "curated" | "foryou";
type FindType = "events" | "destinations" | "orgs";
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
  const portal = await getPortalBySlug(slug);

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

      {/* Search bar for Find and Community views */}
      {viewMode !== "feed" && (
        <div
          className={`sticky z-[9999] border-b ${
            slug === "atlanta-families"
              ? "top-[64px] border-[#E8D5C4]/30 bg-[#FFF8F0]/97"
              : "top-[52px] border-[var(--twilight)] bg-[var(--night)]"
          }`}
        >
          <div className="max-w-5xl mx-auto px-4 pt-1 pb-2">
            <SearchBarWrapper
              viewMode={viewMode}
              findType={viewMode === "find" ? findType : null}
              portalSlug={portal.slug}
              portalId={portal.id}
            />
          </div>
        </div>
      )}

      <main className={findDisplay === "map" && viewMode === "find" ? "" : "max-w-5xl mx-auto px-4 pb-16"}>
        <Suspense fallback={<DetailViewSkeleton />}>
          <DetailViewRouter portalSlug={portal.slug}>
            {viewMode === "feed" && (
              portal.slug === "atlanta-families" ? (
                <FamilyFeed
                  portalId={portal.id}
                  portalSlug={portal.slug}
                  portalExclusive={portal.portal_type === "business"}
                />
              ) : (
                <FeedShell
                  portalId={portal.id}
                  portalSlug={portal.slug}
                  activeTab={feedTab}
                  curatedContent={<CuratedContent portalSlug={portal.slug} />}
                />
              )
            )}

            {viewMode === "find" && (
              <Suspense fallback={<FindViewSkeleton />}>
                <FindView
                  portalId={portal.id}
                  portalSlug={portal.slug}
                  portalExclusive={portal.portal_type === "business"}
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
          </DetailViewRouter>
        </Suspense>
      </main>
    </div>
  );
}

// Loading skeletons
function DetailViewSkeleton() {
  return (
    <div className="py-6 space-y-4">
      <div className="h-6 w-16 skeleton-shimmer rounded" />
      <div className="aspect-[2/1] skeleton-shimmer rounded-xl" />
      <div className="h-24 skeleton-shimmer rounded-xl" />
      <div className="h-48 skeleton-shimmer rounded-xl" />
    </div>
  );
}

function FindViewSkeleton() {
  return (
    <div className="py-6 space-y-4">
      {/* Type selector skeleton */}
      <div className="flex p-1 bg-[var(--night)] rounded-lg max-w-md">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 h-9 skeleton-shimmer rounded-md" />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="space-y-3">
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
      <div className="flex p-1 bg-[var(--night)] rounded-lg">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 h-9 skeleton-shimmer rounded-md" />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 skeleton-shimmer rounded-xl" />
        ))}
      </div>
    </div>
  );
}
