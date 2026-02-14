import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import { EmoryDemoHeader, PortalHeader } from "@/components/headers";
import { AmbientBackground } from "@/components/ambient";
import FindView from "@/components/find/FindViewLazy";
import CommunityView from "@/components/community/CommunityView";
import DetailViewRouter from "@/components/views/DetailViewRouter";
import { DefaultTemplate } from "./_templates/default";
import { GalleryTemplate } from "./_templates/gallery";
import { TimelineTemplate } from "./_templates/timeline";
import { FilmTemplate } from "./_templates/film";
import { HotelTemplate } from "./_templates/hotel";
import { HospitalTemplate } from "./_templates/hospital";
import EmoryCommunityExperience from "./_components/hospital/EmoryCommunityExperience";
import { normalizeHospitalMode } from "@/lib/hospital-modes";
import { normalizeEmoryPersona, resolveHospitalModeForPersona } from "@/lib/emory-personas";
import { isEmoryDemoPortal } from "@/lib/hospital-art";
import { isPCMDemoPortal } from "@/lib/marketplace-art";
import { normalizeMarketplacePersona } from "@/lib/marketplace-art";
import { MarketplaceTemplate } from "./_templates/marketplace";
import { safeJsonLd } from "@/lib/formats";
import { toAbsoluteUrl } from "@/lib/site-url";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export const revalidate = 60;

type ViewMode = "feed" | "find" | "community";
type FeedTab = "curated" | "foryou";
type FindType = "events" | "classes" | "destinations" | "showtimes";
type FindDisplay = "list" | "map" | "calendar";

type PortalSearchParams = {
  search?: string;
  categories?: string;
  subcategories?: string;
  genres?: string;
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
  mode?: string;
  persona?: string;
  support?: string;
  // Detail view params
  event?: string;
  spot?: string;
  series?: string;
  org?: string;
};

type Props = {
  params: Promise<{ portal: string }>;
  searchParams: Promise<PortalSearchParams>;
};

export default async function PortalPage({ params, searchParams }: Props) {
  const { portal: slug } = await params;
  const searchParamsData = await searchParams;

  // Get portal data - all portals must exist in database
  const portal = await getCachedPortalBySlug(slug);

  if (!portal) {
    notFound();
  }

  // Check vertical type for hotel/specialty portals
  const vertical = getPortalVertical(portal);
  const isEmoryPortal = isEmoryDemoPortal(portal.slug);
  const isHotel = vertical === "hotel";
  const isFilm = vertical === "film";
  const isHospital = vertical === "hospital" || isEmoryPortal;
  const isEmoryNativeHospital = isHospital && isEmoryPortal;
  const isMarketplace = vertical === "marketplace" || isPCMDemoPortal(portal.slug);
  const disableAmbientEffects = isEmoryNativeHospital || isFilm || isMarketplace;

  // Hotel portals always show the hotel feed (no view switching)
  if (isHotel) {
    return (
      <div className="min-h-screen overflow-x-hidden">
        <Suspense fallback={null}>
          <DetailViewRouter portalSlug={portal.slug}>
            <HotelTemplate portal={portal} />
          </DetailViewRouter>
        </Suspense>
      </div>
    );
  }

  // Marketplace portals show the marketplace experience (no view switching)
  if (isMarketplace) {
    const marketplacePersona = normalizeMarketplacePersona(searchParamsData.persona);
    return (
      <div className="min-h-screen overflow-x-hidden bg-[var(--mkt-ivory)] text-[var(--mkt-charcoal)]">
        <style>{`
          body::before { opacity: 0 !important; }
          body::after { opacity: 0 !important; }
          .ambient-glow { opacity: 0 !important; }
          .rain-overlay { display: none !important; }
          .cursor-glow { display: none !important; }
        `}</style>
        <Suspense fallback={null}>
          <DetailViewRouter portalSlug={portal.slug}>
            <MarketplaceTemplate portal={portal} persona={marketplacePersona} />
          </DetailViewRouter>
        </Suspense>
      </div>
    );
  }

  const viewParam = searchParamsData.view;
  const findTypeParam = searchParamsData.type;
  const findDisplayParam = searchParamsData.display;
  const hasFindSignals = Boolean(
    findTypeParam ||
      findDisplayParam ||
      searchParamsData.search ||
      searchParamsData.categories ||
      searchParamsData.subcategories ||
      searchParamsData.genres ||
      searchParamsData.tags ||
      searchParamsData.vibes ||
      searchParamsData.neighborhoods ||
      searchParamsData.price ||
      searchParamsData.free ||
      searchParamsData.date ||
      searchParamsData.mood
  );

  // Parse view mode with deterministic fallback behavior.
  // If filter/display/type signals are present without explicit `view`, prefer Find.
  let viewMode: ViewMode = "feed";
  if (viewParam === "feed") {
    viewMode = "feed";
  } else if (viewParam === "community") {
    viewMode = "community";
  } else if (
    viewParam === "find" ||
    viewParam === "events" ||
    viewParam === "spots" ||
    viewParam === "map" ||
    viewParam === "calendar" ||
    hasFindSignals
  ) {
    viewMode = "find";
  }
  // Emory hospital experience intentionally avoids the generic Atlanta Find surface.
  if (isEmoryNativeHospital && viewMode === "find") {
    viewMode = "community";
  }

  // Parse sub-parameters - handle legacy "activity" tab by treating it as curated
  let feedTab: FeedTab = "curated";
  if (searchParamsData.tab === "foryou") {
    feedTab = "foryou";
  }

  // Determine find type - support legacy view params
  // Note: "orgs" was moved to community view, redirect to events
  let findType: FindType = "events";
  if (findTypeParam && findTypeParam !== "orgs") {
    findType = findTypeParam as FindType;
  } else if (viewParam === "spots") {
    findType = "destinations";
  }

  // Determine display mode - support legacy view params
  let findDisplay: FindDisplay = "list";
  if (findDisplayParam) {
    findDisplay = findDisplayParam as FindDisplay;
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
    searchParamsData.genres ||
    searchParamsData.tags ||
    searchParamsData.vibes ||
    searchParamsData.neighborhoods ||
    searchParamsData.price ||
    searchParamsData.free ||
    searchParamsData.date ||
    searchParamsData.mood
  );
  const emoryPersona = normalizeEmoryPersona(searchParamsData.persona);
  const hospitalMode = isHospital
    ? resolveHospitalModeForPersona({
        persona: emoryPersona,
        modeParam: searchParamsData.mode,
      })
    : normalizeHospitalMode(searchParamsData.mode);
  const portalPageSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${portal.name} Events | Lost City`,
    description: portal.tagline || `Find events, people, and community in ${portal.name}.`,
    url: toAbsoluteUrl(`/${portal.slug}`),
    isPartOf: {
      "@type": "WebSite",
      name: "Lost City",
      url: toAbsoluteUrl("/"),
    },
  };

  const mainClassName =
    viewMode === "find" && findDisplay === "map"
      ? ""
      : viewMode === "find" && findDisplay === "calendar"
      ? "max-w-[1500px] mx-auto px-4 pb-20"
        : isEmoryNativeHospital
          ? "max-w-6xl mx-auto px-4 pb-20"
          : isFilm
            ? "max-w-6xl mx-auto px-4 pb-20"
          : "max-w-5xl mx-auto px-4 pb-20";

  return (
    <div className={`min-h-screen ${isEmoryNativeHospital ? "bg-[#f2f5fa] text-[#002f6c]" : ""}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(portalPageSchema) }}
      />
      {disableAmbientEffects && (
        <style>{`
          body::before { opacity: 0 !important; }
          body::after { opacity: 0 !important; }
          .ambient-glow { opacity: 0 !important; }
          .rain-overlay { display: none !important; }
          .cursor-glow { display: none !important; }
        `}</style>
      )}
      {!disableAmbientEffects && <AmbientBackground />}
      {isEmoryNativeHospital ? (
        <EmoryDemoHeader portalSlug={portal.slug} />
      ) : (
        <PortalHeader
          portalSlug={portal.slug}
          portalName={portal.name}
          hideNav={isFilm}
        />
      )}

      <main className={mainClassName}>
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
                    <Suspense fallback={<FeedSkeleton vertical={vertical} isEmoryNativeHospital={isEmoryNativeHospital} />}>
                      {isHospital ? (
                        <HospitalTemplate
                          portal={portal}
                          feedTab={feedTab}
                          mode={hospitalMode}
                          persona={emoryPersona}
                        />
                      ) : isFilm ? (
                        <FilmTemplate portal={portal} />
                      ) : (
                        /* Template system - select based on portal.page_template */
                        portal.page_template === "gallery" ? (
                          <GalleryTemplate portal={portal} />
                        ) : portal.page_template === "timeline" ? (
                          <TimelineTemplate portal={portal} />
                        ) : (
                          /* Default template for backwards compatibility */
                          <DefaultTemplate portal={portal} feedTab={feedTab} />
                        )
                      )}
                    </Suspense>
                  )}

                  {!isEmoryNativeHospital && viewMode === "find" && (
                    <Suspense fallback={<FindViewSkeleton vertical={vertical} isEmoryNativeHospital={isEmoryNativeHospital} />}>
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
                    <Suspense fallback={<CommunityViewSkeleton vertical={vertical} isEmoryNativeHospital={isEmoryNativeHospital} />}>
                      {isEmoryNativeHospital ? (
                        <EmoryCommunityExperience
                          portal={portal}
                          mode={hospitalMode}
                          persona={emoryPersona}
                          includeSupportSensitive={searchParamsData.support === "1"}
                        />
                      ) : (
                        <CommunityView
                          portalId={portal.id}
                          portalSlug={portal.slug}
                          portalName={portal.name}
                          activeTab={communityTab}
                        />
                      )}
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
function FindViewSkeleton({
  vertical,
  isEmoryNativeHospital,
}: {
  vertical: ReturnType<typeof getPortalVertical>;
  isEmoryNativeHospital: boolean;
}) {
  const skeletonVertical = toSkeletonVertical(vertical, isEmoryNativeHospital);
  if (vertical === "hotel") {
    return (
      <div data-skeleton-route="find-view" data-skeleton-vertical={skeletonVertical} className="py-6 space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl skeleton-shimmer" style={{ animationDelay: `${i * 70}ms` }} />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl skeleton-shimmer" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  if (vertical === "film") {
    return (
      <div data-skeleton-route="find-view" data-skeleton-vertical={skeletonVertical} className="py-6 space-y-5">
        <div className="rounded-2xl border border-[#2a3244] p-4">
          <div className="h-10 rounded-xl skeleton-shimmer" />
          <div className="grid gap-2 sm:grid-cols-4 mt-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 rounded-lg skeleton-shimmer" style={{ animationDelay: `${i * 50}ms` }} />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl skeleton-shimmer" style={{ animationDelay: `${i * 70}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  if (vertical === "hospital" || isEmoryNativeHospital) {
    return (
      <div data-skeleton-route="find-view" data-skeleton-vertical={skeletonVertical} className="py-6 space-y-5">
        <div className="grid gap-2 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-11 rounded-xl skeleton-shimmer" style={{ animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl skeleton-shimmer" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div data-skeleton-route="find-view" data-skeleton-vertical={skeletonVertical} className="py-6 space-y-4">
      {/* Type selector skeleton */}
      <div className="flex gap-1 p-1 bg-[var(--night)] rounded-xl border border-[var(--twilight)]/30 max-w-lg">
        {[1, 2, 3, 4].map((i) => (
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

function CommunityViewSkeleton({
  vertical,
  isEmoryNativeHospital,
}: {
  vertical: ReturnType<typeof getPortalVertical>;
  isEmoryNativeHospital: boolean;
}) {
  const skeletonVertical = toSkeletonVertical(vertical, isEmoryNativeHospital);
  if (vertical === "hotel") {
    return (
      <div data-skeleton-route="community-view" data-skeleton-vertical={skeletonVertical} className="py-6 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-44 rounded-2xl skeleton-shimmer" />
          <div className="h-44 rounded-2xl skeleton-shimmer" />
        </div>
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl skeleton-shimmer" style={{ animationDelay: `${i * 70}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  if (vertical === "film") {
    return (
      <div data-skeleton-route="community-view" data-skeleton-vertical={skeletonVertical} className="py-6 space-y-4">
        <div className="h-12 rounded-xl skeleton-shimmer" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 rounded-2xl skeleton-shimmer" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  if (vertical === "hospital" || isEmoryNativeHospital) {
    return (
      <div data-skeleton-route="community-view" data-skeleton-vertical={skeletonVertical} className="py-6 space-y-4">
        <div className="h-12 rounded-xl skeleton-shimmer" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl skeleton-shimmer" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div data-skeleton-route="community-view" data-skeleton-vertical={skeletonVertical} className="py-6 space-y-4">
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

function FeedSkeleton({
  vertical,
  isEmoryNativeHospital,
}: {
  vertical: ReturnType<typeof getPortalVertical>;
  isEmoryNativeHospital: boolean;
}) {
  const skeletonVertical = toSkeletonVertical(vertical, isEmoryNativeHospital);
  if (vertical === "marketplace") {
    return (
      <div data-skeleton-route="feed-view" data-skeleton-vertical="marketplace" className="py-6 space-y-6">
        <div className="h-[340px] rounded-b-3xl skeleton-shimmer" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 w-20 rounded-full skeleton-shimmer" style={{ animationDelay: `${i * 40}ms` }} />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl skeleton-shimmer" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl skeleton-shimmer" style={{ animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  if (vertical === "hotel") {
    return (
      <div data-skeleton-route="feed-view" data-skeleton-vertical={skeletonVertical} className="py-6 space-y-6">
        <section className="rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-5 md:p-6">
          <div className="h-3 w-28 rounded skeleton-shimmer" />
          <div className="h-10 w-[72%] rounded skeleton-shimmer mt-3" />
          <div className="h-4 w-full rounded skeleton-shimmer mt-3" />
          <div className="h-4 w-[82%] rounded skeleton-shimmer mt-2" />
          <div className="mt-5 flex flex-wrap gap-2">
            <div className="h-8 w-28 rounded-full skeleton-shimmer" />
            <div className="h-8 w-24 rounded-full skeleton-shimmer" />
            <div className="h-8 w-32 rounded-full skeleton-shimmer" />
          </div>
        </section>
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-56 rounded-2xl skeleton-shimmer" style={{ animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  if (vertical === "film") {
    return (
      <div data-skeleton-route="feed-view" data-skeleton-vertical={skeletonVertical} className="py-6 space-y-6">
        <div className="h-56 rounded-3xl skeleton-shimmer" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="h-24 rounded-2xl skeleton-shimmer" />
          <div className="h-24 rounded-2xl skeleton-shimmer" />
          <div className="h-24 rounded-2xl skeleton-shimmer" />
        </div>
        <div className="h-64 rounded-2xl skeleton-shimmer" />
      </div>
    );
  }

  if (vertical === "hospital" || isEmoryNativeHospital) {
    return (
      <div data-skeleton-route="feed-view" data-skeleton-vertical={skeletonVertical} className="py-6 space-y-6">
        <div className="h-60 rounded-[30px] skeleton-shimmer" />
        <div className="grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl skeleton-shimmer" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl skeleton-shimmer" style={{ animationDelay: `${i * 70}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div data-skeleton-route="feed-view" data-skeleton-vertical={skeletonVertical} className="py-6 space-y-6">
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

function toSkeletonVertical(
  vertical: ReturnType<typeof getPortalVertical>,
  isEmoryNativeHospital: boolean
): "city" | "hotel" | "film" | "hospital" | "marketplace" {
  if (isEmoryNativeHospital) return "hospital";
  if (vertical === "hotel" || vertical === "film" || vertical === "hospital" || vertical === "marketplace") return vertical;
  return "city";
}
