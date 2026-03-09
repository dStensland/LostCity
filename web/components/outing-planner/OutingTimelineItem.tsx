"use client";

import { Star, X } from "@phosphor-icons/react";
import {
  getItemTitle,
  formatItineraryTime,
  type ItineraryItem,
  type LocalItineraryItem,
} from "@/lib/itinerary-utils";
import { getItemCategory } from "@/lib/playbook-shared";
import { getCategoryColor } from "@/components/CategoryIcon";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";

interface OutingTimelineItemProps {
  item: ItineraryItem | LocalItineraryItem;
  index: number;
  isAnchor: boolean;
  onRemove?: (itemId: string) => void;
  saving?: boolean;
}

export default function OutingTimelineItem({
  item,
  index,
  isAnchor,
  onRemove,
  saving,
}: OutingTimelineItemProps) {
  const title = getItemTitle(item);
  const time = item.start_time ? formatItineraryTime(item.start_time) : "";
  const category = getItemCategory(item);

  // Dynamic accent color for non-anchor items via CSS variable
  const accentHex = isAnchor ? null : getCategoryColor(category);
  const colorClass = accentHex
    ? createCssVarClass("--item-accent", accentHex, "oti")
    : null;

  // Subtitle: venue name for events, neighborhood for venues
  const subtitle = (() => {
    if ("event" in item && item.event && (item.event as { venue_name?: string | null }).venue_name) {
      return (item.event as { venue_name?: string | null }).venue_name;
    }
    if ("venue" in item && item.venue?.neighborhood) {
      return item.venue.neighborhood;
    }
    if (item.item_type === "custom" && item.custom_description) {
      return item.custom_description;
    }
    return null;
  })();

  return (
    <>
      {colorClass && <ScopedStyles css={colorClass.css} />}
      <div className={`relative flex gap-3 group ${colorClass?.className ?? ""}`}>
        {/* Time column */}
        <div className="shrink-0 w-[54px] flex flex-col items-end pt-3">
          <span
            className={`text-xs leading-none font-mono ${
              isAnchor ? "text-[var(--gold)]" : "text-[var(--muted)] opacity-70"
            }`}
          >
            {time}
          </span>
        </div>

        {/* Spine dot */}
        <div className="shrink-0 relative z-10 flex items-start pt-3">
          {isAnchor ? (
            <div className="w-7 h-7 rounded-full flex items-center justify-center bg-[var(--gold)]/15 border-2 border-[var(--gold)]/55 text-[var(--gold)] shadow-[0_0_16px_var(--gold)]/30">
              <Star size={12} weight="fill" />
            </div>
          ) : (
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-2xs font-mono font-semibold bg-[var(--night)] border-2"
              style={{
                borderColor: `color-mix(in srgb, var(--item-accent, #8B8B94) 25%, transparent)`,
                color: `var(--item-accent, #8B8B94)`,
              }}
            >
              {index + 1}
            </div>
          )}
        </div>

        {/* Card */}
        <div className="flex-1 min-w-0 py-2">
          <div
            className={`p-3 rounded-xl border ${
              isAnchor
                ? "bg-[var(--gold)]/5 border-[var(--gold)]/20"
                : "bg-white/[0.02] border-white/5"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--cream)] truncate">{title}</p>
                {subtitle && (
                  <p className="text-xs text-[var(--soft)] mt-0.5 truncate">{subtitle}</p>
                )}
              </div>

              {/* Remove button — hidden for anchor, visible on hover for others */}
              {!isAnchor && onRemove && (
                <button
                  onClick={() => onRemove(item.id)}
                  disabled={saving}
                  className="shrink-0 w-9 h-9 flex items-center justify-center rounded-md text-[var(--muted)] md:opacity-0 md:group-hover:opacity-100 hover:text-[var(--coral)] hover:bg-[var(--coral)]/10 active:bg-[var(--coral)]/15 transition-all"
                  aria-label="Remove stop"
                >
                  <X size={14} weight="bold" />
                </button>
              )}
            </div>

            {/* Duration chip + anchor badge */}
            <div className="flex items-center gap-2 mt-2">
              {isAnchor ? (
                <span className="px-2 py-0.5 rounded text-2xs font-mono bg-[var(--gold)]/5 text-[var(--gold)]/75">
                  {item.duration_minutes ?? 60} min
                </span>
              ) : (
                <span
                  className="px-2 py-0.5 rounded text-2xs font-mono"
                  style={{
                    background: `color-mix(in srgb, var(--item-accent, #8B8B94) 5%, transparent)`,
                    color: `color-mix(in srgb, var(--item-accent, #8B8B94) 73%, transparent)`,
                  }}
                >
                  {item.duration_minutes ?? 60} min
                </span>
              )}
              {isAnchor && (
                <span className="flex items-center gap-1 text-2xs font-mono text-[var(--muted)]">
                  <Star size={8} weight="fill" className="text-[var(--gold)]" /> Anchor
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
