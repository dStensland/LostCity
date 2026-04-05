import PortalFooter from "@/components/PortalFooter";
import PortalHeader from "@/components/headers/PortalHeader";
import { resolvePortalChrome } from "@/lib/portal-runtime/resolvePortalChrome";
import { Suspense } from "react";
import type { PortalResolvedRequest, PortalSurface } from "@/lib/portal-runtime/types";
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

  return (
    <>
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
    </>
  );
}
