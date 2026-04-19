"use client";

import { useState, useCallback } from "react";
import NeighborhoodMapWrapper from "./NeighborhoodMapWrapper";
import NeighborhoodDrillDown from "./NeighborhoodDrillDown";
import NeighborhoodsEditorialOverlay from "./NeighborhoodsEditorialOverlay";
import NeighborhoodsMapMode, {
  type NeighborhoodsMapModeValue,
} from "./NeighborhoodsMapMode";
import type { NeighborhoodActivity } from "./NeighborhoodMap";

interface Props {
  activityData: NeighborhoodActivity[];
  portalSlug: string;
  tonightNeighborhoodCount: number;
  weekNeighborhoodCount: number;
  cityName?: string;
}

export default function NeighborhoodsPageClient({
  activityData,
  portalSlug,
  tonightNeighborhoodCount,
  weekNeighborhoodCount,
  cityName,
}: Props) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<NeighborhoodsMapModeValue>(
    tonightNeighborhoodCount > 0 ? "tonight" : "week",
  );

  const selectedActivity = activityData.find((n) => n.slug === selectedSlug) ?? null;

  const handleSelect = useCallback((slug: string | null) => {
    setSelectedSlug((prev) => (prev === slug ? null : slug));
  }, []);

  const handleClose = useCallback(() => {
    setSelectedSlug(null);
  }, []);

  return (
    <div className="relative">
      <div className="flex gap-0 h-[50vh] sm:h-[60vh]">
        <div
          className={`relative transition-all duration-300 min-w-0 h-full ${selectedSlug ? "flex-1" : "w-full"}`}
        >
          <div className="h-full rounded-card-xl overflow-hidden border border-[var(--twilight)] relative">
            <NeighborhoodMapWrapper
              activityData={activityData}
              selectedSlug={selectedSlug}
              onSelect={handleSelect}
              modeFilter={mapMode}
            />

            {/* Editorial overlay — top-left, above the map */}
            <div className="pointer-events-none absolute top-5 left-5 right-5 flex items-start justify-between gap-4">
              <NeighborhoodsEditorialOverlay
                tonightNeighborhoodCount={tonightNeighborhoodCount}
                weekNeighborhoodCount={weekNeighborhoodCount}
                cityName={cityName}
              />
              <div className="pointer-events-auto">
                <NeighborhoodsMapMode value={mapMode} onChange={setMapMode} />
              </div>
            </div>
          </div>
        </div>

        {selectedSlug && selectedActivity && (
          <NeighborhoodDrillDown
            slug={selectedSlug}
            name={selectedActivity.name}
            portalSlug={portalSlug}
            activity={selectedActivity}
            onClose={handleClose}
          />
        )}
      </div>
      <p className="text-center font-mono text-2xs text-[var(--muted)] mt-2 sm:hidden">
        Tap a neighborhood to explore
      </p>
    </div>
  );
}
