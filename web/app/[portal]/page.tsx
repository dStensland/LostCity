import { getPortalBySlug } from "@/lib/portal";
import UnifiedHeader from "@/components/UnifiedHeader";
import SearchBar from "@/components/SearchBar";
import DynamicAmbient from "@/components/DynamicAmbient";
import FeedShell from "@/components/feed/FeedShell";
import CuratedContent from "@/components/feed/CuratedContent";
import FindView from "@/components/find/FindView";
import CommunityView from "@/components/community/CommunityView";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export const revalidate = 60;

type ViewMode = "feed" | "find" | "community";
type FeedTab = "curated" | "foryou" | "activity";
type FindType = "events" | "places" | "orgs";
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

  // Parse sub-parameters
  const feedTab: FeedTab = (searchParamsData.tab as FeedTab) || "curated";

  // Determine find type - support legacy view params
  let findType: FindType = "events";
  if (searchParamsData.type) {
    findType = searchParamsData.type as FindType;
  } else if (viewParam === "spots") {
    findType = "places";
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

  // Community sub-tab
  const communityTab = searchParamsData.tab === "groups" ? "groups" : "lists";

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
      {/* Dynamic ambient glow based on category */}
      <Suspense fallback={null}>
        <DynamicAmbient />
      </Suspense>

      <UnifiedHeader
        portalSlug={portal.slug}
        portalName={portal.name}
        branding={portal.branding}
      />

      {/* Search bar for Find and Community views */}
      {viewMode !== "feed" && (
        <div className="sticky top-[52px] z-30 border-b border-[var(--twilight)] bg-[var(--night)] backdrop-blur-md">
          <div className="max-w-3xl mx-auto px-4 pt-1 pb-2">
            <SearchBar />
          </div>
        </div>
      )}

      <main className={findDisplay === "map" && viewMode === "find" ? "" : "max-w-3xl mx-auto px-4 pb-16"}>
        {viewMode === "feed" && (
          <Suspense fallback={<FeedShellSkeleton />}>
            <FeedShell
              portalId={portal.id}
              portalSlug={portal.slug}
              activeTab={feedTab}
              curatedContent={<CuratedContent portalSlug={portal.slug} />}
            />
          </Suspense>
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
      </main>
    </div>
  );
}

// Loading skeletons
function FeedShellSkeleton() {
  return (
    <div className="py-6 space-y-6">
      {/* Sub-nav skeleton */}
      <div className="flex gap-1 p-1 bg-[var(--night)] rounded-lg">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 h-9 skeleton-shimmer rounded-md" />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="rounded-2xl h-56 skeleton-shimmer" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 skeleton-shimmer rounded-xl" />
        ))}
      </div>
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
      <div className="flex p-1 bg-[var(--night)] rounded-lg max-w-xs">
        {[1, 2].map((i) => (
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
