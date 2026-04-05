"use client";

import RegularsView from "@/components/find/RegularsView";
import type { ExploreLaneComponentProps } from "@/lib/explore-platform/types";
import type { RegularsLaneInitialData } from "@/lib/explore-platform/lane-data";

export function ExploreRegularsLane({
  portalId,
  portalSlug,
  initialData,
}: ExploreLaneComponentProps) {
  return (
    <RegularsView
      portalId={portalId}
      portalSlug={portalSlug}
      initialData={(initialData as RegularsLaneInitialData | null | undefined) ?? null}
    />
  );
}
