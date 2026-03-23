"use client";

import { memo } from "react";
import Link from "next/link";
import Dot from "@/components/ui/Dot";
import { FreeBadge } from "@/components/Badge";
import type { FeedEventData } from "@/components/EventCard";
import { getCategoryColor } from "@/components/CategoryIcon";
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

  const { label: dateLabel } = formatSmartDate(event.start_date);
  const timeStr = event.is_all_day
    ? "All Day"
    : event.start_time
      ? formatTime(event.start_time)
      : null;

  const venueParts: string[] = [];
  if (event.venue?.name) venueParts.push(event.venue.name);
  if (timeStr) venueParts.push(timeStr);
  else venueParts.push(dateLabel);

  return (
    <Link
      href={`/${portalSlug}/events/${event.id}`}
      className="block w-full rounded-lg bg-[var(--night)] border border-[var(--twilight)]/40 overflow-hidden hover:bg-[var(--dusk)] transition-colors"
      aria-label={event.title}
    >
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        {/* Left: 2px category accent + text */}
        <div className="flex items-stretch gap-3 min-w-0 flex-1">
          {/* Accent bar */}
          <div
            className="w-0.5 flex-shrink-0 rounded-full self-stretch"
            style={{ backgroundColor: catColor }}
          />

          {/* Title + meta */}
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--cream)] truncate leading-snug">
              {event.title}
            </p>
            {venueParts.length > 0 && (
              <p className="text-xs text-[var(--muted)] truncate leading-snug flex items-center gap-1">
                {venueParts.map((part, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1">
                    {idx > 0 && <Dot />}
                    {part}
                  </span>
                ))}
              </p>
            )}
          </div>
        </div>

        {/* Right: badges */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {event.is_free ? (
            <FreeBadge />
          ) : event.price_min !== null && event.price_min !== undefined ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full border border-[var(--twilight)] font-mono text-2xs font-medium text-[var(--muted)]">
              ${event.price_min}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
});

export type { StandardRowProps };
