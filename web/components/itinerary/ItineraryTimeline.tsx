"use client";

import type { ItineraryItem, LocalItineraryItem } from "@/lib/itinerary-utils";
import ItineraryItemCard from "./ItineraryItemCard";

interface ItineraryTimelineProps {
  items: (ItineraryItem | LocalItineraryItem)[];
  onRemoveItem?: (id: string) => void;
  compact?: boolean;
}

export default function ItineraryTimeline({
  items,
  onRemoveItem,
  compact = false,
}: ItineraryTimelineProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/30">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <p className="text-sm text-white/40">No stops added yet</p>
        <p className="text-xs text-white/25 mt-1">
          Add events, restaurants, or custom stops to build your plan
        </p>
      </div>
    );
  }

  // Calculate total duration
  const totalMinutes = items.reduce((sum, item) => {
    const duration = item.duration_minutes || 0;
    const walk = item.walk_time_minutes || 0;
    return sum + duration + walk;
  }, 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMins = totalMinutes % 60;

  return (
    <div className="space-y-0">
      {/* Summary bar */}
      <div className="flex items-center gap-3 mb-4 px-2">
        <span className="text-xs text-white/40">
          {items.length} stop{items.length !== 1 ? "s" : ""}
        </span>
        <span className="w-px h-3 bg-white/10" />
        <span className="text-xs text-white/40">
          ~{totalHours > 0 ? `${totalHours}h ` : ""}
          {remainingMins > 0 ? `${remainingMins}m` : ""}
        </span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        {items.length > 1 && (
          <div className="absolute left-[26px] top-4 bottom-4 w-px bg-white/8" />
        )}

        {/* Items */}
        {items.map((item, i) => (
          <ItineraryItemCard
            key={item.id}
            item={item}
            index={i}
            showWalkTime={i > 0}
            onRemove={onRemoveItem}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}
