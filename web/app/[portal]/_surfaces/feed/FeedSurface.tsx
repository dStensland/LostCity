import { Suspense } from "react";
import { getCityPhoto } from "@/lib/city-pulse/header-defaults";
import { getDayOfWeek, getTimeSlot, getPortalHour } from "@/lib/city-pulse/time-slots";
import { normalizeMarketplacePersona } from "@/lib/marketplace-art";
import { safeJsonLd } from "@/lib/formats";
import { toAbsoluteUrl } from "@/lib/site-url";
import { AmbientBackground } from "@/components/ambient";
import { DefaultTemplate } from "../../_templates/default";
import { GalleryTemplate } from "../../_templates/gallery";
import { TimelineTemplate } from "../../_templates/timeline";
import { FilmTemplate } from "../../_templates/film";
import { HotelTemplate } from "../../_templates/hotel";
import { MarketplaceTemplate } from "../../_templates/marketplace";
import { DogTemplate } from "../../_templates/dog";
import { FamilyFeed } from "@/components/family";
import DogMapView from "../../_components/dog/DogMapView";
import DogSavedView from "../../_components/dog/DogSavedView";
import { DOG_DETAIL_VIEW_CSS, DOG_PORTAL_VAR_OVERRIDES } from "@/lib/dog-art";
import { FeedLoading, DogMapLoading, DogSavedLoading } from "./FeedLoading";
import { FeedLayoutChrome } from "./FeedLayoutChrome";
import { AmbientSuppression } from "./AmbientSuppression";
import { PortalSurfaceChrome } from "../shared/PortalSurfaceChrome";
import type { PortalResolvedRequest } from "@/lib/portal-runtime/types";

type PortalSearchParams = {
  view?: string;
  persona?: string;
  event?: string;
  spot?: string;
  series?: string;
  festival?: string;
  org?: string;
};

async function DefaultCityTemplate({
  portal,
  serverHeroUrl,
}: {
  portal: Parameters<typeof DefaultTemplate>[0]["portal"];
  serverHeroUrl: string;
}) {
  // Feed + regulars prefetches now live inside CityPulseServerShell's manifest
  // loaders. FeedSurface only needs to emit the LCP preload for the hero.
  return (
    <>
      <link rel="preload" as="image" href={serverHeroUrl} fetchPriority="high" />
      <DefaultTemplate portal={portal} serverHeroUrl={serverHeroUrl} />
    </>
  );
}

/**
 * FeedSurface renders the feed template for a portal. The overlay wrap
 * (events / spots / series / festivals / orgs as query-param overlays)
 * is mounted inside PortalSurfaceChrome — see
 * docs/plans/explore-overlay-architecture-2026-04-18.md § Component 2.
 * Callers just pass `searchParams` and the chrome handles the rest,
 * gated on `request.runtimePolicy.supportsOverlayEntry`.
 */
export async function FeedSurface({
  request,
  searchParams,
}: {
  request: PortalResolvedRequest;
  searchParams: PortalSearchParams;
}) {
  const portalPageSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${request.portal.name} Events | Lost City`,
    description:
      request.portal.tagline ||
      `Find events, people, and community in ${request.portal.name}.`,
    url: toAbsoluteUrl(`/${request.portal.slug}`),
    isPartOf: {
      "@type": "WebSite",
      name: "Lost City",
      url: toAbsoluteUrl("/"),
    },
  };

  const feedFallback = <FeedLoading vertical={request.vertical} />;

  if (request.isHotel) {
    return (
      <div className="min-h-screen overflow-x-hidden">
        <PortalSurfaceChrome
          surface="feed"
          request={request}
          searchParams={searchParams}
          detailFallback={feedFallback}
        >
          <HotelTemplate portal={request.portal} />
        </PortalSurfaceChrome>
      </div>
    );
  }

  if (request.isMarketplace) {
    const marketplacePersona = normalizeMarketplacePersona(searchParams.persona);
    return (
      <div className="min-h-screen overflow-x-hidden bg-[var(--mkt-ivory)] text-[var(--mkt-charcoal)]">
        <AmbientSuppression />
        <PortalSurfaceChrome
          surface="feed"
          request={request}
          searchParams={searchParams}
          detailFallback={feedFallback}
        >
          <MarketplaceTemplate portal={request.portal} persona={marketplacePersona} />
        </PortalSurfaceChrome>
      </div>
    );
  }

  if (request.isDog) {
    const dogView = searchParams.view;

    return (
      <div className="min-h-screen overflow-x-hidden" style={{ background: "#FFFBEB" }}>
        <AmbientSuppression />
        <style>{`.dog-portal-root { ${DOG_PORTAL_VAR_OVERRIDES} }.dog-portal-root ${DOG_DETAIL_VIEW_CSS}`}</style>
        <div className="dog-portal-root">
          {dogView === "find" ? (
            <Suspense fallback={<DogMapLoading />}>
              <PortalSurfaceChrome
                surface="feed"
                request={request}
                searchParams={searchParams}
                detailFallback={<DogMapLoading />}
              >
                <DogMapView />
              </PortalSurfaceChrome>
            </Suspense>
          ) : dogView === "community" ? (
            <Suspense fallback={<DogSavedLoading />}>
              <PortalSurfaceChrome
                surface="feed"
                request={request}
                searchParams={searchParams}
                detailFallback={<DogSavedLoading />}
              >
                <DogSavedView portalSlug={request.portal.slug} />
              </PortalSurfaceChrome>
            </Suspense>
          ) : (
            <PortalSurfaceChrome
              surface="feed"
              request={request}
              searchParams={searchParams}
              detailFallback={feedFallback}
            >
              <DogTemplate portal={request.portal} />
            </PortalSurfaceChrome>
          )}
          {dogView !== "find" && <div className="h-20 sm:hidden" />}
        </div>
      </div>
    );
  }

  if (request.isFamily) {
    return (
      <div className="min-h-screen overflow-x-hidden">
        <AmbientSuppression />
        <PortalSurfaceChrome
          surface="feed"
          request={request}
          searchParams={searchParams}
          detailFallback={feedFallback}
        >
          <FamilyFeed
            portalId={request.portal.id}
            portalSlug={request.portal.slug}
            portalExclusive={request.isExclusive}
          />
        </PortalSurfaceChrome>
      </div>
    );
  }

  if (request.isAdventure) {
    return (
      <div className="min-h-screen overflow-x-hidden">
        <AmbientSuppression />
        <PortalSurfaceChrome
          surface="feed"
          request={request}
          searchParams={searchParams}
          detailFallback={feedFallback}
        >
          <DefaultTemplate portal={request.portal} />
        </PortalSurfaceChrome>
      </div>
    );
  }

  const serverHeroUrl = (() => {
    const now = new Date();
    return getCityPhoto(getTimeSlot(getPortalHour(now)), undefined, getDayOfWeek(now));
  })();

  const mainClassName = request.isFilm
    ? "mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8"
    : "mx-auto max-w-[1600px] px-4 pb-20 sm:px-6 lg:px-8";

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(portalPageSchema) }}
      />
      <PortalSurfaceChrome
        surface="feed"
        request={request}
        searchParams={searchParams}
        detailFallback={feedFallback}
      >
        {request.disableAmbientEffects ? <AmbientSuppression /> : <AmbientBackground />}
        <main className={mainClassName}>
          <Suspense fallback={feedFallback}>
            {request.isFilm ? (
              <FilmTemplate portal={request.portal} />
            ) : request.portal.page_template === "gallery" ? (
              <GalleryTemplate portal={request.portal} />
            ) : request.portal.page_template === "timeline" ? (
              <TimelineTemplate portal={request.portal} />
            ) : (
              <DefaultCityTemplate portal={request.portal} serverHeroUrl={serverHeroUrl} />
            )}
          </Suspense>
        </main>
        <FeedLayoutChrome request={request} />
      </PortalSurfaceChrome>
    </div>
  );
}
