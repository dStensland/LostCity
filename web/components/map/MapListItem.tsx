"use client";

import { memo } from "react";
import { getCategoryColor, getCategoryLabel } from "@/lib/category-config";
import { decodeHtmlEntities, formatTime, getEventStatus } from "@/lib/formats";

interface MapListItemProps {
  id: number;
  type: "event" | "spot";
  optionId?: string;
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
  optionId,
  title,
  category,
  venueName,
  neighborhood,
  startDate,
  startTime,
  isAllDay,
  isLive,
  isSelected,
  onSelect,
  onHover,
}: MapListItemProps) {
  const decodedTitle = decodeHtmlEntities(title);
  const decodedVenueName = venueName ? decodeHtmlEntities(venueName) : null;
  const decodedNeighborhood = neighborhood ? decodeHtmlEntities(neighborhood) : null;
  const color = getCategoryColor(category || "other");
  const catLabel = getCategoryLabel(category || "other");
  const timeStr = type === "event" ? formatTime(startTime ?? null, isAllDay) : null;
  const status = type === "event" ? getEventStatus(startDate ?? null, startTime ?? null, isAllDay, isLive) : null;

  // Build accessible label
  const ariaLabel =
    type === "event"
      ? `${decodedTitle}${decodedVenueName ? ` at ${decodedVenueName}` : ""}${status ? `, ${status.label}` : ""}${timeStr ? `, ${timeStr}` : ""}`
      : `${decodedTitle}${decodedNeighborhood ? `, ${decodedNeighborhood}` : ""}`;

  return (
    <button
      id={optionId}
      role="option"
      aria-selected={isSelected}
      aria-label={ariaLabel}
      className={`w-full flex items-start gap-3.5 px-3.5 py-3.5 text-left rounded-xl outline-none
        transition-all duration-150 motion-reduce:transition-none
        focus-visible:ring-2 focus-visible:ring-[var(--coral)]/60 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--night)]
        ${isSelected
          ? "bg-[var(--twilight)]/95 border-l-[3px] pl-[11px] shadow-[0_10px_24px_rgba(0,0,0,0.26)] ring-1 ring-[var(--twilight)]/60"
          : "hover:bg-[var(--twilight)]/55 hover:-translate-y-[1px] active:translate-y-0 border-l-[3px] border-transparent pl-[11px]"
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
        className="w-3 h-3 mt-1 rounded-full flex-shrink-0 border border-white/20 shadow-[0_0_0_3px_rgba(255,255,255,0.03)]"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />

      {/* Text content */}
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-[var(--cream)] truncate leading-snug tracking-[-0.01em]">{decodedTitle}</p>
        <div className="flex items-center gap-1.5 mt-1">
          {decodedVenueName && type === "event" && (
            <span className="text-[11px] text-[var(--muted)] truncate leading-tight">{decodedVenueName}</span>
          )}
          {decodedVenueName && decodedNeighborhood && type === "event" && (
            <span className="text-[var(--muted)] text-[10px]" aria-hidden="true">·</span>
          )}
          {decodedNeighborhood && (
            <span className="text-[11px] text-[var(--soft)] truncate leading-tight flex-shrink-0">{decodedNeighborhood}</span>
          )}
        </div>
      </div>

      {/* Right side: status + time + badges */}
      <div className="flex-shrink-0 flex items-start gap-2.5 pt-0.5">
        {status && (
          <span
            className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border border-current/25"
            style={{ color: status.color, backgroundColor: `${status.color}20` }}
          >
            {status.label}
          </span>
        )}
        {type === "event" && timeStr && !status && (
          <span className="text-[11px] font-mono text-[var(--cream)] bg-[var(--twilight)]/90 border border-[var(--twilight)]/80 px-2 py-0.5 rounded-md">
            {timeStr}
          </span>
        )}
        {type === "spot" && (
          <span className="text-[11px] font-mono text-[var(--muted)] flex-shrink-0">
            {catLabel}
          </span>
        )}
      </div>
    </button>
  );
});

export default MapListItem;
