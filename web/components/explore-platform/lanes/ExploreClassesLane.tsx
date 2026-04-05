"use client";

import { ClassesView } from "@/components/find/ClassesView";
import type { ExploreLaneComponentProps } from "@/lib/explore-platform/types";
import type { ClassesLaneInitialData } from "@/lib/explore-platform/lane-data";

export function ExploreClassesLane({
  portalId,
  portalSlug,
  initialData,
}: ExploreLaneComponentProps) {
  const seededData = (initialData as ClassesLaneInitialData | null) ?? null;
  return (
    <ClassesView
      portalId={portalId}
      portalSlug={portalSlug}
      initialData={seededData}
    />
  );
}
