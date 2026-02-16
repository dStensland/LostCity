"use client";

import Image from "next/image";
import type { ItineraryItem, LocalItineraryItem } from "@/lib/itinerary-utils";
import {
  getItemTitle,
  formatItineraryTime,
  formatWalkTime,
  formatWalkDistance,
} from "@/lib/itinerary-utils";
import { getProxiedImageSrc } from "@/lib/image-proxy";

interface ItineraryItemCardProps {
  item: ItineraryItem | LocalItineraryItem;
  index: number;
  showWalkTime?: boolean;
  onRemove?: (id: string) => void;
  compact?: boolean;
}

function getItemImage(item: ItineraryItem | LocalItineraryItem): string | null {
  if ("event" in item && item.event?.image_url) return item.event.image_url;
  if ("venue" in item && item.venue?.image_url) return item.venue.image_url;
  if ("event_image" in item && item.event_image) return item.event_image;
  if ("venue_image" in item && item.venue_image) return item.venue_image;
  return null;
}

function getItemSubtitle(item: ItineraryItem | LocalItineraryItem): string {
  if (item.item_type === "event" && "event" in item && item.event) {
    return item.event.venue_name || item.event.category || "Event";
  }
  if (item.item_type === "venue" && "venue" in item && item.venue) {
    return item.venue.neighborhood || item.venue.venue_type || "Venue";
  }
  if (item.item_type === "custom" && item.custom_address) {
    return item.custom_address;
  }
  return item.item_type === "custom" ? "Custom stop" : "";
}

const TYPE_COLORS: Record<string, string> = {
  event: "bg-blue-500/20 text-blue-300",
  venue: "bg-amber-500/20 text-amber-300",
  custom: "bg-purple-500/20 text-purple-300",
};

export default function ItineraryItemCard({
  item,
  index,
  showWalkTime = true,
  onRemove,
  compact = false,
}: ItineraryItemCardProps) {
  const title = getItemTitle(item);
  const subtitle = getItemSubtitle(item);
  const imageUrl = getItemImage(item);
  const walkTime = formatWalkTime(item.walk_time_minutes);
  const walkDistance = formatWalkDistance(item.walk_distance_meters);
  const timeDisplay = formatItineraryTime(item.start_time);
  const proxiedImage = imageUrl ? getProxiedImageSrc(imageUrl) : null;

  return (
    <div className="group">
      {/* Walk time connector */}
      {showWalkTime && index > 0 && walkTime && (
        <div className="flex items-center gap-2 py-1.5 pl-6">
          <div className="w-px h-4 bg-white/10" />
          <span className="text-[11px] text-white/40 flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="5" r="1" />
              <path d="m9 20 3-6 3 6" />
              <path d="m6 8 3 2v5l-3 3" />
              <path d="m18 8-3 2v5l3 3" />
            </svg>
            {walkTime}
            {walkDistance && <span className="text-white/25">({walkDistance})</span>}
          </span>
        </div>
      )}

      {/* Card */}
      <div
        className={`flex items-stretch gap-3 rounded-xl border border-white/8 bg-white/5 overflow-hidden transition-all hover:bg-white/8 ${
          compact ? "p-2" : "p-3"
        }`}
      >
        {/* Position indicator */}
        <div className="flex flex-col items-center justify-center w-8 shrink-0">
          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/60">
            {index + 1}
          </div>
          {timeDisplay && (
            <span className="text-[10px] text-white/40 mt-1">{timeDisplay}</span>
          )}
        </div>

        {/* Image */}
        {proxiedImage && !compact && (
          <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-white/5">
            <Image
              src={typeof proxiedImage === "string" ? proxiedImage : ""}
              alt={title}
              width={56}
              height={56}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-white truncate">{title}</h4>
              {subtitle && (
                <p className="text-xs text-white/50 truncate mt-0.5">{subtitle}</p>
              )}
            </div>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                TYPE_COLORS[item.item_type] || TYPE_COLORS.custom
              }`}
            >
              {item.item_type}
            </span>
          </div>
          {item.notes && (
            <p className="text-xs text-white/40 mt-1 line-clamp-1">
              {item.notes}
            </p>
          )}
          {item.duration_minutes > 0 && (
            <p className="text-[10px] text-white/30 mt-1">
              ~{item.duration_minutes} min
            </p>
          )}
        </div>

        {/* Remove button */}
        {onRemove && (
          <button
            onClick={() => onRemove(item.id)}
            className="self-center p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
            aria-label="Remove item"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
