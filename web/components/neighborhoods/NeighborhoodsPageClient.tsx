"use client";

import { useState, useCallback } from "react";
import NeighborhoodMapWrapper from "./NeighborhoodMapWrapper";
import NeighborhoodDrillDown from "./NeighborhoodDrillDown";
import type { NeighborhoodActivity } from "./NeighborhoodMap";

interface Props {
  activityData: NeighborhoodActivity[];
  portalSlug: string;
}

export default function NeighborhoodsPageClient({ activityData, portalSlug }: Props) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const selectedActivity = activityData.find((n) => n.slug === selectedSlug) ?? null;

  const handleSelect = useCallback((slug: string | null) => {
    setSelectedSlug((prev) => (prev === slug ? null : slug));
  }, []);

  const handleClose = useCallback(() => {
    setSelectedSlug(null);
  }, []);

  return (
    <div className="relative">
      {/* Map + drill-down side by side on desktop */}
      <div className="flex gap-0 h-[50vh] sm:h-[60vh]">
        {/* Map container — shrinks when drill-down is open */}
        <div className={`transition-all duration-300 min-w-0 h-full ${selectedSlug ? "flex-1" : "w-full"}`}>
          <div className="h-full rounded-xl overflow-hidden border border-[var(--twilight)]">
            <NeighborhoodMapWrapper
              activityData={activityData}
              selectedSlug={selectedSlug}
              onSelect={handleSelect}
            />
          </div>
        </div>

        {/* Desktop drill-down panel — inline in flex so map shrinks */}
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
