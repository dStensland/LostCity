"use client";

import { ShowsView } from "@/components/find/ShowsView";
import type { ExploreLaneComponentProps } from "@/lib/explore-platform/types";
import type { ShowsLaneInitialData } from "@/lib/explore-platform/lane-data";

export function ExploreShowsLane({
  portalId,
  portalSlug,
  initialData,
}: ExploreLaneComponentProps) {
  return (
    <ShowsView
      portalId={portalId}
      portalSlug={portalSlug}
      initialData={(initialData as ShowsLaneInitialData | null | undefined) ?? null}
    />
  );
}
