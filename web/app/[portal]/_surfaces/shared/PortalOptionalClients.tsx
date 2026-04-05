"use client";

import dynamic from "next/dynamic";

const DeferredPortalTracker = dynamic(
  () => import("../../_components/PortalTracker").then((mod) => mod.PortalTracker),
  { ssr: false },
);

const DeferredCannyWidget = dynamic(
  () => import("@/components/CannyWidget"),
  { ssr: false },
);

export function PortalOptionalClients({
  portalSlug,
  showTracker,
  showCannyWidget,
}: {
  portalSlug: string;
  showTracker: boolean;
  showCannyWidget: boolean;
}) {
  return (
    <>
      {showTracker ? <DeferredPortalTracker portalSlug={portalSlug} /> : null}
      {showCannyWidget ? <DeferredCannyWidget /> : null}
    </>
  );
}
