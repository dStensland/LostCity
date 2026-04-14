import { Suspense } from "react";
import { getCityPhoto } from "@/lib/city-pulse/header-defaults";
import { getDayOfWeek, getTimeSlot, getPortalHour } from "@/lib/city-pulse/time-slots";
import { getServerFeedData } from "@/lib/city-pulse/server-feed";
import { getServerRegularsData } from "@/lib/server-regulars";
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
import { DetailSurface } from "../detail/DetailSurface";
import { hasDetailOverlayTarget } from "../detail/detail-entry-contract";
import { resolveDetailType } from "../detail/DetailLoading";
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

function toSearchParams(searchParams: PortalSearchParams): URLSearchParams {
  return new URLSearchParams(
    Object.entries(searchParams)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, value as string]),
  );
}

async function DefaultCityTemplate({
  portal,
  serverHeroUrl,
}: {
  portal: Parameters<typeof DefaultTemplate>[0]["portal"];
  serverHeroUrl: string;
}) {
  const [feedData, regularsData] = await Promise.all([
    getServerFeedData(portal.slug),
    getServerRegularsData(portal.slug),
  ]);

  return (
    <>
      <link rel="preload" as="image" href={serverHeroUrl} fetchPriority="high" />
      <DefaultTemplate
        portal={portal}
        serverHeroUrl={serverHeroUrl}
        serverFeedData={feedData}
        serverRegularsData={regularsData}
      />
    </>
  );
}

export async function FeedSurface({
  request,
  searchParams,
}: {
  request: PortalResolvedRequest;
  searchParams: PortalSearchParams;
}) {
  const detailSearchParams = toSearchParams(searchParams);
  const overlayEnabled =
    request.runtimePolicy.supportsOverlayEntry &&
    hasDetailOverlayTarget(detailSearchParams);
  const detailType = overlayEnabled ? resolveDetailType(searchParams) : null;
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

  if (request.isHotel) {
    const content = (
      <div className="min-h-screen overflow-x-hidden">
        <PortalSurfaceChrome surface="feed" request={request}>
          <HotelTemplate portal={request.portal} />
        </PortalSurfaceChrome>
      </div>
    );

    return overlayEnabled ? (
      <DetailSurface
        portalSlug={request.portal.slug}
        detailType={detailType!}
        feedFallback={<FeedLoading vertical={request.vertical} />}
      >
        {content}
      </DetailSurface>
    ) : (
      content
    );
  }

  if (request.isMarketplace) {
    const marketplacePersona = normalizeMarketplacePersona(searchParams.persona);
    const content = (
      <div className="min-h-screen overflow-x-hidden bg-[var(--mkt-ivory)] text-[var(--mkt-charcoal)]">
        <AmbientSuppression />
        <PortalSurfaceChrome surface="feed" request={request}>
          <MarketplaceTemplate portal={request.portal} persona={marketplacePersona} />
        </PortalSurfaceChrome>
      </div>
    );

    return overlayEnabled ? (
      <DetailSurface
        portalSlug={request.portal.slug}
        detailType={detailType!}
        feedFallback={<FeedLoading vertical={request.vertical} />}
      >
        {content}
      </DetailSurface>
    ) : (
      content
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
              {overlayEnabled ? (
                <DetailSurface
                  portalSlug={request.portal.slug}
                  detailType={detailType!}
                  feedFallback={<DogMapLoading />}
                >
                  <PortalSurfaceChrome surface="feed" request={request}>
                    <DogMapView />
                  </PortalSurfaceChrome>
                </DetailSurface>
              ) : (
                <PortalSurfaceChrome surface="feed" request={request}>
                  <DogMapView />
                </PortalSurfaceChrome>
              )}
            </Suspense>
          ) : dogView === "community" ? (
            <Suspense fallback={<DogSavedLoading />}>
              {overlayEnabled ? (
                <DetailSurface
                  portalSlug={request.portal.slug}
                  detailType={detailType!}
                  feedFallback={<DogSavedLoading />}
                >
                  <PortalSurfaceChrome surface="feed" request={request}>
                    <DogSavedView portalSlug={request.portal.slug} />
                  </PortalSurfaceChrome>
                </DetailSurface>
              ) : (
                <PortalSurfaceChrome surface="feed" request={request}>
                  <DogSavedView portalSlug={request.portal.slug} />
                </PortalSurfaceChrome>
              )}
            </Suspense>
          ) : (
            overlayEnabled ? (
              <DetailSurface
                portalSlug={request.portal.slug}
                detailType={detailType!}
                feedFallback={<FeedLoading vertical={request.vertical} />}
              >
                <PortalSurfaceChrome surface="feed" request={request}>
                  <DogTemplate portal={request.portal} />
                </PortalSurfaceChrome>
              </DetailSurface>
            ) : (
              <PortalSurfaceChrome surface="feed" request={request}>
                <DogTemplate portal={request.portal} />
              </PortalSurfaceChrome>
            )
          )}
          {dogView !== "find" && <div className="h-20 sm:hidden" />}
        </div>
      </div>
    );
  }

  if (request.isFamily) {
    const content = (
      <div className="min-h-screen overflow-x-hidden">
        <AmbientSuppression />
        <PortalSurfaceChrome surface="feed" request={request}>
          <FamilyFeed
            portalId={request.portal.id}
            portalSlug={request.portal.slug}
            portalExclusive={request.isExclusive}
          />
        </PortalSurfaceChrome>
      </div>
    );

    return overlayEnabled ? (
      <DetailSurface
        portalSlug={request.portal.slug}
        detailType={detailType!}
        feedFallback={<FeedLoading vertical={request.vertical} />}
      >
        {content}
      </DetailSurface>
    ) : (
      content
    );
  }

  if (request.isAdventure) {
    const content = (
      <div className="min-h-screen overflow-x-hidden">
        <AmbientSuppression />
        <PortalSurfaceChrome surface="feed" request={request}>
          <DefaultTemplate portal={request.portal} />
        </PortalSurfaceChrome>
      </div>
    );

    return overlayEnabled ? (
      <DetailSurface
        portalSlug={request.portal.slug}
        detailType={detailType!}
        feedFallback={<FeedLoading vertical={request.vertical} />}
      >
        {content}
      </DetailSurface>
    ) : (
      content
    );
  }

  const serverHeroUrl = (() => {
    const now = new Date();
    return getCityPhoto(getTimeSlot(getPortalHour(now)), undefined, getDayOfWeek(now));
  })();

  const mainClassName = request.isFilm
    ? "mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8"
    : "mx-auto max-w-[1600px] px-4 pb-20 sm:px-6 lg:px-8";

  const content = (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(portalPageSchema) }}
      />
      <PortalSurfaceChrome surface="feed" request={request}>
        {request.disableAmbientEffects ? <AmbientSuppression /> : <AmbientBackground />}
        <main className={mainClassName}>
          <Suspense fallback={<FeedLoading vertical={request.vertical} />}>
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

  return overlayEnabled ? (
    <DetailSurface
      portalSlug={request.portal.slug}
      detailType={detailType!}
      feedFallback={<FeedLoading vertical={request.vertical} />}
    >
      {content}
    </DetailSurface>
  ) : (
    content
  );
}
