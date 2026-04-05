import { Suspense } from "react";
import { CivicTabBar } from "@/components/civic/CivicTabBar";
import type { PortalResolvedRequest } from "@/lib/portal-runtime/types";

export function FeedLayoutChrome({ request }: { request: PortalResolvedRequest }) {
  if (!request.isCommunity) {
    return null;
  }

  const actLabel =
    typeof request.portal.settings.nav_labels === "object" &&
    request.portal.settings.nav_labels !== null &&
    typeof (request.portal.settings.nav_labels as Record<string, unknown>).feed === "string"
      ? (request.portal.settings.nav_labels as Record<string, string>).feed
      : "Act";

  return (
    <>
      <Suspense fallback={null}>
        <CivicTabBar portalSlug={request.portal.slug} actLabel={actLabel} />
      </Suspense>
      <div className="h-14 sm:hidden" />
    </>
  );
}
