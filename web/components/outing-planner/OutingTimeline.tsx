"use client";

import type { ItineraryItem, LocalItineraryItem } from "@/lib/itinerary-utils";
import { formatWalkDistance } from "@/lib/itinerary-utils";
import OutingTimelineItem from "./OutingTimelineItem";
import OutingTimelineConnector from "./OutingTimelineConnector";

interface OutingTimelineProps {
  items: (ItineraryItem | LocalItineraryItem)[];
  onRemoveItem?: (itemId: string) => void;
  saving?: boolean;
}

export default function OutingTimeline({
  items,
  onRemoveItem,
  saving,
}: OutingTimelineProps) {
  const totalWalkMeters = items.reduce(
    (sum, item) => sum + (item.walk_distance_meters || 0),
    0,
  );

  if (items.length === 0) return null;

  return (
    <div>
      {/* Summary bar */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-mono text-[var(--muted)]">
          {items.length} STOP{items.length !== 1 ? "S" : ""}
          {totalWalkMeters > 0 ? ` \u00b7 ${formatWalkDistance(totalWalkMeters)}` : ""}
        </span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Spine line */}
        <div className="absolute left-[27px] top-4 bottom-4 w-px outing-spine-gradient" />

        {items.map((item, idx) => (
          <div key={item.id}>
            {/* Walk connector between stops */}
            {idx > 0 && (item.walk_time_minutes != null || item.walk_distance_meters != null) && (
              <OutingTimelineConnector
                walkTimeMinutes={item.walk_time_minutes}
                walkDistanceMeters={item.walk_distance_meters}
                durationMinutes={item.duration_minutes}
              />
            )}

            {/* Stop card */}
            <OutingTimelineItem
              item={item}
              index={idx}
              isAnchor={idx === 0}
              onRemove={onRemoveItem}
              saving={saving}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
