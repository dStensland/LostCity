"use client";

import { GameDayView } from "@/components/find/GameDayView";
import type { ExploreLaneComponentProps } from "@/lib/explore-platform/types";
import type { GameDayLaneInitialData } from "@/lib/explore-platform/lane-data";

export function ExploreGameDayLane({
  portalId,
  portalSlug,
  initialData,
}: ExploreLaneComponentProps) {
  return (
    <GameDayView
      portalId={portalId}
      portalSlug={portalSlug}
      initialData={(initialData as GameDayLaneInitialData | null | undefined) ?? null}
    />
  );
}
