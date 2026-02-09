"use client";

import { memo } from "react";
import { getMapPinColor, getCategoryLabel } from "@/lib/category-config";
import { formatTime, getEventStatus } from "@/lib/formats";

interface MapListItemProps {
  id: number;
  type: "event" | "spot";
  title: string;
  category: string | null;
  venueName: string | null;
  neighborhood?: string | null;
  startDate?: string | null;
  startTime?: string | null;
  isAllDay?: boolean;
  isFree?: boolean;
  isLive?: boolean;
  isSelected?: boolean;
  onSelect: (item: { type: "event" | "spot"; id: number }) => void;
  onHover: (id: number | null) => void;
}

const MapListItem = memo(function MapListItem({
  id,
  type,
  title,
  category,
  venueName,
  neighborhood,
  startDate,
  startTime,
  isAllDay,
  isFree,
  isLive,
  isSelected,
  onSelect,
  onHover,
}: MapListItemProps) {
  const color = getMapPinColor(category || "other");
  const catLabel = getCategoryLabel(category || "other");
  const timeStr = type === "event" ? formatTime(startTime ?? null, isAllDay) : null;
  const status = type === "event" ? getEventStatus(startDate ?? null, startTime ?? null, isAllDay, isLive) : null;

  // Build accessible label
  const ariaLabel =
    type === "event"
      ? `${title}${venueName ? ` at ${venueName}` : ""}${status ? `, ${status.label}` : ""}${timeStr ? `, ${timeStr}` : ""}`
      : `${title}${neighborhood ? `, ${neighborhood}` : ""}`;

  return (
    <button
      role="option"
      aria-selected={isSelected}
      aria-label={ariaLabel}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left rounded-lg outline-none
        transition-colors duration-100 motion-reduce:transition-none
        focus-visible:ring-2 focus-visible:ring-[var(--coral)]/60 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--night)]
        ${isSelected
          ? "bg-[var(--twilight)] border-l-[3px] pl-[13px]"
          : "hover:bg-[var(--twilight)]/50 border-l-[3px] border-transparent pl-[13px]"
        }`}
      style={isSelected ? { borderLeftColor: color } : undefined}
      onClick={() => onSelect({ type, id })}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(id)}
      onBlur={() => onHover(null)}
    >
      {/* Color dot */}
      <span
        className="w-[10px] h-[10px] rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />

      {/* Text content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--cream)] truncate leading-snug">{title}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {venueName && type === "event" && (
            <span className="text-[11px] text-[var(--muted)] truncate leading-tight">{venueName}</span>
          )}
          {venueName && neighborhood && type === "event" && (
            <span className="text-[var(--muted)] text-[9px]" aria-hidden="true">·</span>
          )}
          {neighborhood && (
            <span className="text-[11px] text-[var(--soft)] truncate leading-tight flex-shrink-0">{neighborhood}</span>
          )}
        </div>
      </div>

      {/* Right side: status + time + badges */}
      <div className="flex-shrink-0 flex items-center gap-1.5">
        {status && (
          <span
            className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
            style={{ color: status.color, backgroundColor: `${status.color}20` }}
          >
            {status.label}
          </span>
        )}
        {isFree && (
          <span className="text-[10px] font-mono font-bold text-[var(--neon-green)] bg-[var(--neon-green)]/15 px-1.5 py-0.5 rounded">
            Free
          </span>
        )}
        {type === "event" && timeStr && !status && (
          <span className="text-[11px] font-mono text-[var(--cream)] bg-[var(--twilight)] px-1.5 py-0.5 rounded">
            {timeStr}
          </span>
        )}
        {type === "spot" && (
          <span className="text-[10px] font-mono text-[var(--muted)] flex-shrink-0">
            {catLabel}
          </span>
        )}
      </div>
    </button>
  );
});

export default MapListItem;
