import { after } from "next/server";
import ExploreShellClient from "@/components/explore-platform/ExploreShellClient";
import {
  hasLegacyExploreNormalizationInput,
  normalizeLegacyExploreParams,
} from "@/lib/normalize-find-url";
import {
  getCachedExploreHomeSeed,
  getExploreHomeData,
} from "@/lib/explore-home-data";
import {
  loadExploreLaneInitialData,
  resolveExploreLaneFromParams,
} from "@/lib/explore-platform/server/registry";
import type { PortalResolvedRequest } from "@/lib/portal-runtime/types";
import { AmbientSuppression } from "../../_surfaces/feed/AmbientSuppression";
import { PortalSurfaceChrome } from "../../_surfaces/shared/PortalSurfaceChrome";

export async function ExploreSurface({
  request,
  rawParams,
}: {
  request: PortalResolvedRequest;
  rawParams: URLSearchParams;
}) {
  const normalizedParams = hasLegacyExploreNormalizationInput(rawParams)
    ? normalizeLegacyExploreParams(rawParams)
    : rawParams;
  const { lane: initialLaneId } = resolveExploreLaneFromParams(normalizedParams);
  const initialHomeSeed =
    !normalizedParams.get("lane") && !normalizedParams.get("q")
      ? await getCachedExploreHomeSeed(request.portal.slug)
      : null;
  if (
    !normalizedParams.get("lane") &&
    !normalizedParams.get("q") &&
    !initialHomeSeed
  ) {
    after(async () => {
      await getExploreHomeData(request.portal.slug, {
        portal: request.portal,
      });
    });
  }
  const initialHomeData = initialHomeSeed?.data ?? null;
  const initialHomeDataStale = initialHomeSeed?.isStale ?? false;
  const initialLaneData = initialLaneId
    ? await loadExploreLaneInitialData(initialLaneId, {
        portalId: request.portal.id,
        portalSlug: request.portal.slug,
        portalExclusive: request.isExclusive,
        params: normalizedParams,
      })
    : null;

  const content = (
    <div className="min-h-screen">
      {request.disableAmbientEffects && <AmbientSuppression />}
      <main className="mx-auto max-w-[1600px]">
        <ExploreShellClient
          portalSlug={request.portal.slug}
          portalId={request.portal.id}
          portalExclusive={request.isExclusive}
          initialHomeData={initialHomeData}
          initialHomeDataStale={initialHomeDataStale}
          initialLaneId={initialLaneId}
          initialLaneData={initialLaneData}
          portalChromeVisible={false}
        />
      </main>
    </div>
  );

  return (
    <PortalSurfaceChrome surface="explore" request={request}>
      {content}
    </PortalSurfaceChrome>
  );
}
