"use client";

import { memo } from "react";
import Link from "next/link";
import Dot from "@/components/ui/Dot";
import { FreeBadge } from "@/components/Badge";
import type { FeedEventData } from "@/components/EventCard";
import CategoryIcon, { getCategoryColor, getCategoryLabel } from "@/components/CategoryIcon";
import SmartImage from "@/components/SmartImage";
import { formatTime, formatSmartDate } from "@/lib/formats";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StandardRowProps {
  event: FeedEventData & { card_tier?: "standard" };
  portalSlug?: string;
  index?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const StandardRow = memo(function StandardRow({
  event,
  portalSlug = "atlanta",
  index: _index,
}: StandardRowProps) {
  const catColor = getCategoryColor(event.category);
  const catLabel = getCategoryLabel(event.category as string);
  const imageUrl = event.image_url || event.series?.image_url;

  const { label: dateLabel } = formatSmartDate(event.start_date);
  const isToday = dateLabel === "Today";
  const timeStr = event.is_all_day
    ? "All Day"
    : event.start_time
      ? formatTime(event.start_time)
      : null;

  // Today: just show time. Future dates: show date + time.
  const whenLabel = isToday
    ? (timeStr || dateLabel)
    : timeStr
      ? `${dateLabel} · ${timeStr}`
      : dateLabel;

  return (
    <Link
      href={`/${portalSlug}/events/${event.id}`}
      prefetch={false}
      className="group block w-full rounded-xl overflow-hidden bg-[var(--night)] border border-[var(--twilight)]/30 hover:bg-[var(--dusk)]/50 hover:border-[var(--twilight)]/50 transition-colors"
      aria-label={event.title}
    >
      <div className="flex items-center gap-0">
        {/* Thumbnail — full-bleed left edge */}
        <div className="relative w-16 self-stretch flex-shrink-0 overflow-hidden bg-[var(--twilight)]/40">
          {imageUrl ? (
            <SmartImage
              src={imageUrl}
              alt=""
              fill
              sizes="64px"
              className="object-cover"
              fallback={
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ backgroundColor: `color-mix(in srgb, ${catColor} 15%, var(--night))` }}
                >
                  <CategoryIcon type={event.category || "other"} size={20} glow="none" weight="bold" className="opacity-70" />
                </div>
              }
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: `color-mix(in srgb, ${catColor} 15%, var(--night))` }}
            >
              <CategoryIcon type={event.category || "other"} size={20} glow="none" weight="bold" className="opacity-70" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 px-3 py-2.5">
          {/* Category + time */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className="font-mono text-2xs font-bold uppercase tracking-wider"
              style={{ color: catColor }}
            >
              {catLabel}
            </span>
            <Dot className="text-[var(--twilight)]" />
            <span className="text-2xs text-[var(--muted)]">
              {whenLabel}
            </span>
          </div>

          {/* Title */}
          <p className="text-sm font-medium font-display text-[var(--cream)] truncate leading-snug group-hover:text-white transition-colors">
            {event.title}
          </p>

          {/* Venue */}
          {event.venue?.name && (
            <p className="text-xs text-[var(--muted)] truncate leading-snug mt-0.5">
              {event.venue.name}
              {event.venue.neighborhood && (
                <>
                  <span className="mx-1 opacity-40">·</span>
                  {event.venue.neighborhood}
                </>
              )}
            </p>
          )}
        </div>

        {/* Right: badges */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0 pr-2.5">
          {event.is_free ? (
            <FreeBadge />
          ) : event.price_min !== null && event.price_min !== undefined ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full border border-[var(--twilight)] font-mono text-2xs font-medium text-[var(--muted)]">
              ${event.price_min}
            </span>
          ) : null}
          {(event.going_count ?? 0) > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-[var(--coral)]/10 border border-[var(--coral)]/20 font-mono text-2xs font-medium text-[var(--coral)]">
              {event.going_count}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
});

export type { StandardRowProps };
