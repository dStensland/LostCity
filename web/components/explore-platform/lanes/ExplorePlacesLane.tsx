"use client";

import PortalSpotsView from "@/components/PortalSpotsView";
import type { ExploreLaneComponentProps } from "@/lib/explore-platform/types";
import type { PlacesLaneInitialData } from "@/lib/explore-platform/lane-data";

export function ExplorePlacesLane({
  portalId,
  portalSlug,
  portalExclusive,
  initialData,
}: ExploreLaneComponentProps) {
  const seededData = (initialData as PlacesLaneInitialData | null) ?? null;
  return (
    <PortalSpotsView
      portalId={portalId}
      portalSlug={portalSlug}
      isExclusive={portalExclusive}
      initialData={seededData}
    />
  );
}
