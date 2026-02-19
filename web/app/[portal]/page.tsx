import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import { EmoryDemoHeader, PortalHeader, DogHeader } from "@/components/headers";
import { AmbientBackground } from "@/components/ambient";
import FindView from "@/components/find/FindView";
import CommunityView from "@/components/community/CommunityView";
import DetailViewRouter from "@/components/views/DetailViewRouter";
import { DefaultTemplate } from "./_templates/default";
import { GalleryTemplate } from "./_templates/gallery";
import { TimelineTemplate } from "./_templates/timeline";
import { FilmTemplate } from "./_templates/film";
import { HotelTemplate } from "./_templates/hotel";
import type { Pillar } from "@/lib/concierge/concierge-types";
import { HospitalTemplate } from "./_templates/hospital";
import EmoryCommunityExperience from "./_components/hospital/EmoryCommunityExperience";
import { normalizeHospitalMode } from "@/lib/hospital-modes";
import { isEmoryDemoPortal } from "@/lib/hospital-art";
import { isPCMDemoPortal } from "@/lib/marketplace-art";
import { normalizeMarketplacePersona } from "@/lib/marketplace-art";
import { MarketplaceTemplate } from "./_templates/marketplace";
import { DogTemplate } from "./_templates/dog";
import DogMapView from "./_components/dog/DogMapView";
import DogSavedView from "./_components/dog/DogSavedView";
import { isDogPortal, DOG_PORTAL_VAR_OVERRIDES, DOG_DETAIL_VIEW_CSS } from "@/lib/dog-art";
import { safeJsonLd } from "@/lib/formats";
import { toAbsoluteUrl } from "@/lib/site-url";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import EmoryMobileBottomNav from "./_components/hospital/EmoryMobileBottomNav";
import { hasActiveFindFilters, type FindType } from "@/lib/find-filter-schema";

export const revalidate = 60;

type ViewMode = "feed" | "find" | "community";
type FeedTab = "curated" | "explore" | "foryou";
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
  class_category?: string;
  class_date?: string;
  class_skill?: string;
  skill_level?: string;
  start_date?: string;
  end_date?: string;
  open_now?: string;
  with_events?: string;
  price_level?: string;
  venue_type?: string;
  theater?: string;
  mode?: string;
  persona?: string;
  support?: string;
  // Detail view params
  event?: string;
  spot?: string;
  series?: string;
  org?: string;
  // Concierge pillar
  pillar?: string;
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
  const isDog = vertical === "dog" || isDogPortal(portal.slug);
  const disableAmbientEffects = isEmoryNativeHospital || isFilm || isMarketplace || isDog;

  // Hotel portals always show the concierge experience (no view switching)
  if (isHotel) {
    const validPillars: Pillar[] = ["services", "around", "planner"];
    const rawPillar = typeof searchParamsData.pillar === "string" ? searchParamsData.pillar : undefined;
    const pillarParam = rawPillar && validPillars.includes(rawPillar as Pillar) ? (rawPillar as Pillar) : undefined;
    return (
      <div className="min-h-screen overflow-x-hidden">
        <Suspense fallback={null}>
          <DetailViewRouter portalSlug={portal.slug}>
            <HotelTemplate portal={portal} initialPillar={pillarParam} />
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

  // Dog portals show the dog discovery experience
  if (isDog) {
    const dogView = searchParamsData.view;
    return (
      <div className="min-h-screen overflow-x-hidden" style={{ background: "#FFFBEB" }}>
        <style>{`
          body::before { opacity: 0 !important; }
          body::after { opacity: 0 !important; }
          .ambient-glow { opacity: 0 !important; }
          .rain-overlay { display: none !important; }
          .cursor-glow { display: none !important; }
          .dog-portal-root { ${DOG_PORTAL_VAR_OVERRIDES} }
          .dog-portal-root ${DOG_DETAIL_VIEW_CSS}
        `}</style>
        <div className="dog-portal-root">
          <Suspense fallback={null}>
            <DogHeader portalSlug={portal.slug} />
          </Suspense>
          {dogView === "find" ? (
            <Suspense fallback={<DogMapSkeleton />}>
              <DetailViewRouter portalSlug={portal.slug}>
                <DogMapView />
              </DetailViewRouter>
            </Suspense>
          ) : dogView === "community" ? (
            <Suspense fallback={<DogSavedSkeleton />}>
              <DetailViewRouter portalSlug={portal.slug}>
                <DogSavedView portalSlug={portal.slug} />
              </DetailViewRouter>
            </Suspense>
          ) : (
            <Suspense fallback={null}>
              <DetailViewRouter portalSlug={portal.slug}>
                <DogTemplate portal={portal} />
              </DetailViewRouter>
            </Suspense>
          )}
          {/* Bottom nav spacer for mobile (not needed on map view) */}
          {dogView !== "find" && <div className="sm:hidden h-20" />}
        </div>
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
  // Emory: redirect ?view=community to the dedicated /community-hub route
  if (isEmoryNativeHospital && viewMode === "community") {
    const modeParam = searchParamsData.mode;
    const target = modeParam
      ? `/${portal.slug}/community-hub?mode=${modeParam}`
      : `/${portal.slug}/community-hub`;
    redirect(target);
  }
  // Emory hospital experience intentionally avoids the generic Atlanta Find surface.
  // Drop the view=find and show the hub instead.
  if (isEmoryNativeHospital && viewMode === "find") {
    viewMode = "feed";
  }

  // Parse sub-parameters - handle legacy "activity" tab by treating it as curated
  let feedTab: FeedTab = "curated";
  if (searchParamsData.tab === "explore") {
    feedTab = "explore";
  } else if (searchParamsData.tab === "foryou") {
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
  let communityTab: "people" | "groups" = "people";
  if (searchParamsData.tab === "groups") {
    communityTab = "groups";
  }

  // Check for active filters
  const hasActiveFilters = hasActiveFindFilters(searchParamsData, findType);
  const hospitalMode = normalizeHospitalMode(searchParamsData.mode);
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
                    <div data-skeleton-route="find-view" className="contents">
                      <FindView
                        portalId={portal.id}
                        portalSlug={portal.slug}
                        portalExclusive={isExclusive}
                        findType={findType}
                        displayMode={findDisplay}
                        hasActiveFilters={hasActiveFilters}
                      />
                    </div>
                  )}

                  {viewMode === "community" && (
                    <div data-skeleton-route="community-view" className="contents">
                      {isEmoryNativeHospital ? (
                        <EmoryCommunityExperience
                          portal={portal}
                          mode={hospitalMode}
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
                    </div>
                  )}
                </>
              );
            })()}
          </DetailViewRouter>
        </Suspense>
      </main>
      {isEmoryNativeHospital && (
        <>
          <Suspense fallback={null}>
            <EmoryMobileBottomNav portalSlug={portal.slug} />
          </Suspense>
          <div className="lg:hidden h-16" />
        </>
      )}
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
      <div className="flex gap-1 p-1 bg-[var(--night)] rounded-xl border border-[var(--twilight)]/30 max-w-sm">
        <div className="flex-1 h-10 skeleton-shimmer rounded-lg" />
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

function DogSavedSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-20">
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(253, 232, 138, 0.25)" }}>
        <div className="flex-1 h-10 rounded-lg skeleton-shimmer" />
        <div className="flex-1 h-10 rounded-lg skeleton-shimmer" style={{ animationDelay: "60ms" }} />
      </div>
      <div className="mt-4 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-2xl skeleton-shimmer" style={{ animationDelay: `${i * 70}ms` }} />
        ))}
      </div>
    </div>
  );
}

function DogMapSkeleton() {
  return (
    <div style={{ height: "calc(100dvh - 56px - 64px)" }} className="flex flex-col">
      <div className="flex gap-2 px-4 py-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 w-20 rounded-full skeleton-shimmer flex-shrink-0" style={{ animationDelay: `${i * 40}ms` }} />
        ))}
      </div>
      <div className="flex-1 skeleton-shimmer" />
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
