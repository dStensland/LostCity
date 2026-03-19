import { getCachedPortalBySlug, getCachedPortalByVerticalAndCity, getPortalVertical } from "@/lib/portal";
import { headers } from "next/headers";
import { PortalHeader, DogHeader, AdventureHeader, ATLittleHeader } from "@/components/headers";
import { AmbientBackground } from "@/components/ambient";
import FindView from "@/components/find/FindView";
import CommunityHub from "@/components/community/CommunityHub";
import DetailViewRouter from "@/components/views/DetailViewRouter";
import { DefaultTemplate } from "./_templates/default";
import { GalleryTemplate } from "./_templates/gallery";
import { TimelineTemplate } from "./_templates/timeline";
import { FilmTemplate } from "./_templates/film";
import { HotelTemplate } from "./_templates/hotel";
// Pillar type import removed — Discover feed doesn't use pillars
import { isPCMDemoPortal } from "@/lib/marketplace-art";
import { normalizeMarketplacePersona } from "@/lib/marketplace-art";
import { MarketplaceTemplate } from "./_templates/marketplace";
import { DogTemplate } from "./_templates/dog";
import { FamilyFeed } from "@/components/family";
import DogMapView from "./_components/dog/DogMapView";
import DogSavedView from "./_components/dog/DogSavedView";
import { isDogPortal, DOG_PORTAL_VAR_OVERRIDES, DOG_DETAIL_VIEW_CSS } from "@/lib/dog-art";
import { safeJsonLd } from "@/lib/formats";
import { toAbsoluteUrl, getSiteUrl } from "@/lib/site-url";
import {
  hasActiveFindFilters,
  hasAnyActiveFindFilters,
} from "@/lib/find-filter-schema";
import {
  isFilmPortalVertical,
  shouldDisableAmbientEffects,
  toFeedSkeletonVertical,
} from "@/lib/portal-taxonomy";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import HorseSpinner from "@/components/ui/HorseSpinner";
import { CivicTabBar } from "@/components/civic/CivicTabBar";
import type { Metadata } from "next";

export const revalidate = 300;

/** Suppresses ambient background effects for portals with their own visual language. */
function AmbientSuppression() {
  return (
    <style>{`
      body::before { opacity: 0 !important; }
      body::after { opacity: 0 !important; }
      .ambient-glow { opacity: 0 !important; }
      .rain-overlay { display: none !important; }
      .cursor-glow { display: none !important; }
    `}</style>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ portal: string }>;
}): Promise<Metadata> {
  const { portal: slug } = await params;
  const headersList = await headers();
  const subdomainVertical = headersList.get("x-lc-vertical");

  let portal;
  if (subdomainVertical) {
    portal = await getCachedPortalByVerticalAndCity(subdomainVertical, slug);
    if (!portal) portal = await getCachedPortalBySlug(slug);
  } else {
    portal = await getCachedPortalBySlug(slug);
  }
  if (!portal) return {};

  const description =
    portal.tagline ||
    `Find events, people, and community in ${portal.name}.`;

  return {
    title: `${portal.name} Events | Lost City`,
    description,
    alternates: {
      canonical: `/${portal.slug}`,
      types: {
        "application/rss+xml": `${getSiteUrl()}/api/feed/rss?portal=${portal.slug}`,
      },
    },
    openGraph: {
      title: `${portal.name} Events | Lost City`,
      description,
      type: "website",
    },
  };
}

type ViewMode = "feed" | "find" | "community";
type FindType = "events" | "classes" | "destinations" | "showtimes" | "whats_on" | "regulars";
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
  open_now?: string;
  with_events?: string;
  price_level?: string;
  venue_type?: string;
  venue_types?: string;
  neighborhood?: string;
  cuisine?: string;
  label?: string;
  occasion?: string;
  activity?: string;
  weekday?: string;
  theater?: string;
  class_category?: string;
  class_date?: string;
  class_skill?: string;
  skill_level?: string;
  start_date?: string;
  end_date?: string;
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
  festival?: string;
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

  // Resolve portal: check for vertical subdomain header first (same as layout.tsx)
  const headersList = await headers();
  const subdomainVertical = headersList.get("x-lc-vertical");

  let portal;
  if (subdomainVertical) {
    portal = await getCachedPortalByVerticalAndCity(subdomainVertical, slug);
    if (!portal) portal = await getCachedPortalBySlug(slug);
  } else {
    portal = await getCachedPortalBySlug(slug);
  }

  if (!portal) {
    notFound();
  }

  // Check vertical type for hotel/specialty portals
  const vertical = getPortalVertical(portal);
  const isHotel = vertical === "hotel";
  const isFilm = isFilmPortalVertical(vertical);
  const isMarketplace = vertical === "marketplace" || isPCMDemoPortal(portal.slug);
  const isCommunity = vertical === "community";
  const isDog = vertical === "dog" || isDogPortal(portal.slug);
  const disableAmbientEffects = shouldDisableAmbientEffects(vertical);

  // Hotel portals always show the concierge experience (no view switching)
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
        <AmbientSuppression />
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
        <AmbientSuppression />
        <style>{`.dog-portal-root { ${DOG_PORTAL_VAR_OVERRIDES} }.dog-portal-root ${DOG_DETAIL_VIEW_CSS}`}</style>
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

  // Family portal — bespoke header + feed, no generic PortalHeader/main wrapper
  if (vertical === "family") {
    const isExclusive = portal.portal_type === "business" && !portal.parent_portal_id;
    return (
      <div className="min-h-screen overflow-x-hidden">
        <AmbientSuppression />
        <Suspense fallback={null}>
          <ATLittleHeader />
        </Suspense>
        <Suspense fallback={null}>
          <DetailViewRouter portalSlug={portal.slug}>
            <FamilyFeed
              portalId={portal.id}
              portalSlug={portal.slug}
              portalExclusive={isExclusive}
            />
          </DetailViewRouter>
        </Suspense>
      </div>
    );
  }

  // Adventure portal — bespoke header + feed, no generic PortalHeader/nav
  if (vertical === "adventure") {
    return (
      <div className="min-h-screen overflow-x-hidden">
        <AmbientSuppression />
        <Suspense fallback={null}>
          <AdventureHeader />
        </Suspense>
        <Suspense fallback={null}>
          <DetailViewRouter portalSlug={portal.slug}>
            <DefaultTemplate portal={portal} />
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
      hasAnyActiveFindFilters(searchParamsData)
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
  // Determine find type - support legacy view params
  // Note: "orgs" was moved to community view, redirect to events
  // Note: "spots" is a URL alias for the "destinations" findType
  const VALID_FIND_TYPES = new Set<FindType>(["events", "classes", "destinations", "showtimes", "whats_on", "regulars"]);
  let findType: FindType = "events";
  if (findTypeParam && findTypeParam !== "orgs" && findTypeParam !== "playbook") {
    let mapped = findTypeParam === "spots" ? "destinations" : findTypeParam;
    // Backward compat: ?type=showtimes now resolves to whats_on
    if (mapped === "showtimes") mapped = "whats_on";
    findType = VALID_FIND_TYPES.has(mapped as FindType) ? (mapped as FindType) : "events";
  } else if (viewParam === "spots") {
    findType = "destinations";
  }

  // Community portals only support events in the Find view
  if (isCommunity && findType !== "events") {
    findType = "events";
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

  // Destinations tab defaults to list unless the URL explicitly pairs
  // type=destinations (or view=spots) with display=map. This prevents the map
  // from auto-loading when the user switches to this tab from another find type
  // that had display=map, which risks exhausting browser WebGL contexts.
  if (findType === "destinations") {
    const destinationsTypeExplicit =
      findTypeParam === "destinations" || viewParam === "spots";
    const mapExplicit = findDisplayParam === "map";
    if (!(destinationsTypeExplicit && mapExplicit)) {
      findDisplay = "list";
    }
  }

  // Check for active filters
  const hasActiveFilters = hasActiveFindFilters(searchParamsData, findType);
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

  const mainClassName = (() => {
    const base = "mx-auto px-4 sm:px-6 lg:px-8 pb-20";
    if (viewMode !== "find") {
      return isFilm
        ? `max-w-6xl ${base}`
        : `max-w-[1600px] ${base}`;
    }
    return `max-w-[1600px] ${base}`;
  })();

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(portalPageSchema) }}
      />
      {disableAmbientEffects && <AmbientSuppression />}
      {!disableAmbientEffects && <AmbientBackground />}
      <PortalHeader
        portalSlug={portal.slug}
        portalName={portal.name}
        hideNav={isFilm}
      />

      <main className={mainClassName}>
        {/* DetailViewRouter handles showing detail views (event, venue, series, org) as overlays.
            It uses useSearchParams which requires Suspense. When a detail URL is active on first
            load, we show a skeleton matching the detail type so users never see blank space. */}
        <Suspense fallback={
          <DetailPanelSkeleton
            type={
              searchParamsData.event ? "event" :
              searchParamsData.spot ? "venue" :
              searchParamsData.series ? "series" :
              searchParamsData.festival ? "festival" :
              searchParamsData.org ? "org" :
              null
            }
            feedFallback={<FeedSkeleton vertical={vertical} />}
          />
        }>
          <DetailViewRouter portalSlug={portal.slug}>
            {/* Business portals with a parent_portal_id are white-label portals that show
                filtered public events, not exclusive events. Only standalone business portals
                (no parent) should be exclusive. */}
            {(() => {
              const isExclusive = portal.portal_type === "business" && !portal.parent_portal_id;

              return (
                <>
                  {viewMode === "feed" && (
                    <Suspense fallback={<FeedSkeleton vertical={vertical} />}>
                      {isFilm ? (
                        <FilmTemplate portal={portal} />
                      ) : (
                        /* Template system - select based on portal.page_template */
                        portal.page_template === "gallery" ? (
                          <GalleryTemplate portal={portal} />
                        ) : portal.page_template === "timeline" ? (
                          <TimelineTemplate portal={portal} />
                        ) : (
                          /* Default template for backwards compatibility */
                          <DefaultTemplate portal={portal} />
                        )
                      )}
                    </Suspense>
                  )}

                  {viewMode === "find" && (
                    <div data-skeleton-route="find-view" className="contents">
                      <FindView
                        portalId={portal.id}
                        portalSlug={portal.slug}
                        portalExclusive={isExclusive}
                        findType={findType}
                        displayMode={findDisplay}
                        hasActiveFilters={hasActiveFilters}
                        vertical={vertical}
                      />
                    </div>
                  )}

                  {viewMode === "community" && (
                    <div data-skeleton-route="community-view" className="contents">
                      <CommunityHub
                        portalSlug={portal.slug}
                      />
                    </div>
                  )}
                </>
              );
            })()}
          </DetailViewRouter>
        </Suspense>
      </main>
      {isCommunity && (
        <>
          <Suspense fallback={null}>
            <CivicTabBar
              portalSlug={portal.slug}
              actLabel={
                typeof portal.settings.nav_labels === "object" &&
                portal.settings.nav_labels !== null &&
                typeof (portal.settings.nav_labels as Record<string, unknown>).feed === "string"
                  ? (portal.settings.nav_labels as Record<string, string>).feed
                  : "Act"
              }
            />
          </Suspense>
          <div className="h-14 sm:hidden" />
        </>
      )}
    </div>
  );
}

type DetailType = "event" | "venue" | "series" | "festival" | "org" | null;

// Shown while DetailViewRouter's Suspense boundary resolves (useSearchParams hydration).
// When the URL already contains a detail param on first load, this prevents blank white space.
function DetailPanelSkeleton({
  type,
  feedFallback,
}: {
  type: DetailType;
  feedFallback: React.ReactNode;
}) {
  // No detail in the URL — fall back to the normal feed skeleton so the page
  // doesn't flash blank while the router hydrates.
  if (!type) return <>{feedFallback}</>;

  // Generic detail skeleton: hero area + metadata card.
  // Matches the shape common to EventDetailView / VenueDetailView skeletons.
  return (
    <div className="pt-6 pb-8" role="status" aria-label="Loading details">
      {/* Hero area */}
      <div className="relative aspect-[4/3] rounded-xl overflow-hidden mb-4 skeleton-shimmer-enhanced" />

      {/* Quick actions bar */}
      <div className="rounded-xl border border-[var(--twilight)] bg-[var(--night)] mb-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--twilight)]">
          <div className="flex items-center gap-4">
            <div className="h-5 w-14 rounded skeleton-shimmer-enhanced" />
            <div className="h-4 w-20 rounded skeleton-shimmer-enhanced" style={{ animationDelay: "50ms" }} />
            <div className="h-4 w-16 rounded skeleton-shimmer-enhanced" style={{ animationDelay: "80ms" }} />
          </div>
        </div>
        <div className="p-3 flex items-center gap-3">
          <div className="flex-1 h-12 rounded-lg skeleton-shimmer-enhanced" style={{ animationDelay: "100ms" }} />
          <div className="h-12 w-12 rounded-lg skeleton-shimmer-enhanced" style={{ animationDelay: "120ms" }} />
        </div>
      </div>

      {/* Info card */}
      <div className="border border-[var(--twilight)] rounded-lg p-6 bg-[var(--night)]">
        <div className="h-3 w-16 rounded skeleton-shimmer-enhanced mb-3" style={{ animationDelay: "140ms" }} />
        <div className="space-y-2 mb-5">
          <div className="h-4 w-full rounded skeleton-shimmer-enhanced" style={{ animationDelay: "160ms" }} />
          <div className="h-4 w-[90%] rounded skeleton-shimmer-enhanced" style={{ animationDelay: "180ms" }} />
          <div className="h-4 w-[75%] rounded skeleton-shimmer-enhanced" style={{ animationDelay: "200ms" }} />
        </div>
        <div className="pt-5 border-t border-[var(--twilight)]">
          <div className="h-3 w-16 rounded skeleton-shimmer-enhanced mb-3" style={{ animationDelay: "220ms" }} />
          <div className="p-3 rounded-lg border border-[var(--twilight)] bg-[var(--void)]">
            <div className="h-5 w-[50%] rounded skeleton-shimmer-enhanced mb-2" style={{ animationDelay: "240ms" }} />
            <div className="h-3 w-[70%] rounded skeleton-shimmer-enhanced" style={{ animationDelay: "260ms" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeedSkeleton({
  vertical,
}: {
  vertical: ReturnType<typeof getPortalVertical>;
}) {
  const skeletonVertical = toFeedSkeletonVertical(vertical);
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

  if (isFilmPortalVertical(vertical)) {
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

  // Community vertical: clean skeleton matching CivicFeedShell layout
  if (vertical === "community") {
    return (
      <div data-skeleton-route="feed-view" data-skeleton-vertical="community" className="space-y-4 mt-2">
        {/* CivicHero skeleton */}
        <div className="rounded-xl border border-[var(--twilight)] bg-[var(--night)] p-4 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="h-7 w-44 rounded skeleton-shimmer" />
              <div className="h-4 w-36 rounded skeleton-shimmer" style={{ animationDelay: "40ms" }} />
            </div>
            <div className="h-9 w-24 rounded-lg skeleton-shimmer" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-lg skeleton-shimmer" style={{ animationDelay: `${i * 50}ms` }} />
            ))}
          </div>
        </div>
        {/* Channel chips skeleton */}
        <div className="flex gap-2 px-1">
          {[28, 24, 32, 20].map((w, i) => (
            <div key={i} className="h-8 rounded-full skeleton-shimmer" style={{ width: `${w * 4}px`, animationDelay: `${i * 40}ms` }} />
          ))}
        </div>
        {/* Event card skeletons */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl border border-[var(--twilight)] skeleton-shimmer" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  // City vertical: structural skeleton matching CityPulseShell layout
  // (hero area is rendered by GreetingBar instantly, so only lineup area needs a skeleton)
  return (
    <div data-skeleton-route="feed-view" data-skeleton-vertical={skeletonVertical} className="mt-4" style={{ minHeight: 400 }}>
      <div className="flex items-center justify-center py-16">
        <HorseSpinner />
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
