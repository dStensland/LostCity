import PortalFooter from "@/components/PortalFooter";
import PortalHeader from "@/components/headers/PortalHeader";
import { resolvePortalChrome } from "@/lib/portal-runtime/resolvePortalChrome";
import { Suspense } from "react";
import type { PortalResolvedRequest, PortalSurface } from "@/lib/portal-runtime/types";
import { LinkContextProvider } from "@/lib/link-context";
import { PortalOptionalClients } from "./PortalOptionalClients";

export function PortalSurfaceChrome({
  surface,
  request,
  children,
}: {
  surface: PortalSurface;
  request: PortalResolvedRequest;
  children: React.ReactNode;
}) {
  const chromePolicy = resolvePortalChrome({
    surface,
    request,
  });

  // Surfaces that support overlay entry (feed, explore) emit entity links
  // as ?event=id / ?spot=slug overlays. All other surfaces and standalone
  // detail pages default to canonical links via the provider's default.
  // See docs/plans/explore-overlay-architecture-2026-04-18.md § Component 1.
  const linkContext = request.runtimePolicy.supportsOverlayEntry
    ? "overlay"
    : "canonical";

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
      {children}
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
