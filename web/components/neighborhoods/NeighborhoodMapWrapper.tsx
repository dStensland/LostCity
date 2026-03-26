"use client";

/**
 * NeighborhoodMapWrapper — Dynamic import shell for NeighborhoodMap.
 *
 * Keeps the maplibre-gl bundle out of the shared chunk by loading
 * NeighborhoodMap client-side only (ssr: false). Import this file everywhere;
 * never import NeighborhoodMap directly.
 */

import dynamic from "next/dynamic";
import type { NeighborhoodActivity } from "./NeighborhoodMap";

const NeighborhoodMap = dynamic(() => import("./NeighborhoodMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[var(--night)] border border-[var(--twilight)] relative overflow-hidden rounded-xl">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-[var(--twilight)] border-t-[var(--coral)] animate-spin" />
      </div>
    </div>
  ),
});

interface Props {
  activityData: NeighborhoodActivity[];
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
}

export default function NeighborhoodMapWrapper(props: Props) {
  return <NeighborhoodMap {...props} />;
}

export type { NeighborhoodActivity };
