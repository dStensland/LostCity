import PortalFooter from "@/components/PortalFooter";
import PortalHeader from "@/components/headers/PortalHeader";
import { resolvePortalChrome } from "@/lib/portal-runtime/resolvePortalChrome";
import { Suspense, type ReactNode } from "react";
import type { PortalResolvedRequest, PortalSurface } from "@/lib/portal-runtime/types";
import { LinkContextProvider } from "@/lib/link-context";
import { DetailSurface } from "../detail/DetailSurface";
import { hasDetailOverlayTarget } from "../detail/detail-entry-contract";
import { resolveDetailType, type DetailType } from "../detail/DetailLoading";
import { PortalOptionalClients } from "./PortalOptionalClients";

type OverlaySearchParams = {
  event?: string;
  spot?: string;
  series?: string;
  festival?: string;
  org?: string;
};

/**
 * PortalSurfaceChrome wraps every portal-scoped surface with the shared
 * chrome (header, footer, tracker) AND — on overlay-capable surfaces —
 * the detail overlay router.
 *
 * Single mount point for both concerns (per
 * docs/plans/explore-overlay-architecture-2026-04-18.md § Component 2,
 * architect-review Phase 3). When `supportsOverlayEntry` is true AND
 * the incoming URL carries an overlay target, children are wrapped in
 * `DetailSurface` — the overlay replaces children (lane/feed content
 * stays in the DOM hidden) while header/footer persist.
 *
 * Callers that don't pass `searchParams` (e.g., community surface,
 * standalone detail pages) skip the overlay wrap entirely — safe default.
 */
export function PortalSurfaceChrome({
  surface,
  request,
  searchParams,
  detailFallback,
  children,
}: {
  surface: PortalSurface;
  request: PortalResolvedRequest;
  /**
   * Raw URLSearchParams (or a plain object with overlay keys).
   * Required to compute overlay-target presence. Omit for surfaces
   * that never support overlays (community, standalone detail pages).
   */
  searchParams?: URLSearchParams | OverlaySearchParams;
  /**
   * Per-surface fallback rendered while the detail view suspends, in
   * the narrow unreachable branch of DetailPanelSkeleton where the
   * overlay type resolves to null despite wrap-condition passing.
   * Default: null (safe; most overlays skip straight to the skeleton).
   */
  detailFallback?: ReactNode;
  children: ReactNode;
}) {
  const chromePolicy = resolvePortalChrome({
    surface,
    request,
  });

  // Surfaces that support overlay entry (feed, explore) emit entity
  // links as ?event=id / ?spot=slug overlays. Other surfaces (detail,
  // community) default to canonical links via the provider default.
  // See docs/plans/explore-overlay-architecture-2026-04-18.md § Component 1.
  const linkContext = request.runtimePolicy.supportsOverlayEntry
    ? "overlay"
    : "canonical";

  const { overlayActive, detailType } = resolveOverlay(
    request.runtimePolicy.supportsOverlayEntry,
    searchParams,
  );

  const bodyContent = overlayActive ? (
    <DetailSurface
      portalSlug={request.portal.slug}
      detailType={detailType}
      feedFallback={detailFallback ?? null}
    >
      {children}
    </DetailSurface>
  ) : (
    children
  );

  return (
    <LinkContextProvider value={linkContext}>
      {chromePolicy.showHeader ? (
        <PortalHeader
          portalSlug={request.portal.slug}
          portalName={request.portal.name}
        />
      ) : null}
      {chromePolicy.showTracker ? (
        <Suspense fallback={null}>
          <PortalOptionalClients
            portalSlug={request.portal.slug}
            showTracker={chromePolicy.showTracker}
            showCannyWidget={false}
          />
        </Suspense>
      ) : null}
      {bodyContent}
      {chromePolicy.showCannyWidget ? (
        <PortalOptionalClients
          portalSlug={request.portal.slug}
          showTracker={false}
          showCannyWidget={chromePolicy.showCannyWidget}
        />
      ) : null}
      {chromePolicy.showFooter ? <PortalFooter /> : null}
    </LinkContextProvider>
  );
}

function resolveOverlay(
  supportsOverlayEntry: boolean,
  searchParams: URLSearchParams | OverlaySearchParams | undefined,
): { overlayActive: boolean; detailType: DetailType } {
  if (!supportsOverlayEntry || !searchParams) {
    return { overlayActive: false, detailType: null };
  }

  // DetailOverlayRouter's `hasDetailOverlayTarget` wants URLSearchParams.
  // `resolveDetailType` wants a plain object. Normalize to both.
  const asRecord: OverlaySearchParams =
    searchParams instanceof URLSearchParams
      ? {
          event: searchParams.get("event") ?? undefined,
          spot: searchParams.get("spot") ?? undefined,
          series: searchParams.get("series") ?? undefined,
          festival: searchParams.get("festival") ?? undefined,
          org: searchParams.get("org") ?? undefined,
        }
      : searchParams;

  const asUrlParams =
    searchParams instanceof URLSearchParams
      ? searchParams
      : (() => {
          const next = new URLSearchParams();
          for (const [key, value] of Object.entries(asRecord)) {
            if (value) next.set(key, value);
          }
          return next;
        })();

  if (!hasDetailOverlayTarget(asUrlParams)) {
    return { overlayActive: false, detailType: null };
  }

  return {
    overlayActive: true,
    detailType: resolveDetailType(asRecord),
  };
}
