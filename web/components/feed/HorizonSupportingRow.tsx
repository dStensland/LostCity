"use client";

import { memo } from "react";
import Link from "next/link";
import CategoryIcon from "@/components/CategoryIcon";
import Dot from "@/components/ui/Dot";
import type { CityPulseEventItem } from "@/lib/city-pulse/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Formats a YYYY-MM-DD string as "Sat, May 17" */
function formatHorizonDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${DAY_ABBR[d.getDay()]}, ${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HorizonSupportingRowProps {
  item: CityPulseEventItem;
  portalSlug: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const HorizonSupportingRow = memo(function HorizonSupportingRow({
  item,
  portalSlug,
}: HorizonSupportingRowProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event = item.event as any;
  const isSoldOut = event.ticket_status === "sold_out";
  const isCancelled = event.ticket_status === "cancelled";
  const isDimmed = isSoldOut || isCancelled;

  const dateLabel = event.start_date ? formatHorizonDate(event.start_date as string) : null;
  const category = (event.category as string) || "other";

  return (
    <Link
      href={`/${portalSlug}/events/${event.id}`}
      prefetch={false}
      className={[
        "group flex min-h-[44px] items-center gap-2.5 rounded-lg px-3 py-2",
        "transition-colors hover:bg-[var(--twilight)]/30",
        isDimmed ? "opacity-50" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Category icon */}
      <CategoryIcon
        type={category}
        size={10}
        glow="none"
        weight="bold"
        className="w-2.5 h-2.5 flex-shrink-0"
      />

      {/* Date */}
      {dateLabel && (
        <span className="flex-shrink-0 font-mono text-xs text-[var(--gold)]">
          {dateLabel}
        </span>
      )}

      {/* Title */}
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--cream)] group-hover:text-[var(--gold)]">
        {event.title}
      </span>

      {/* Venue + neighborhood (desktop only) */}
      {event.venue?.name && (
        <span className="hidden sm:flex items-center gap-1 flex-shrink-0 min-w-0 text-xs text-[var(--muted)]">
          <span className="truncate max-w-[120px]">{event.venue.name}</span>
          {event.venue.neighborhood && (
            <>
              <Dot />
              <span className="truncate max-w-[80px]">{event.venue.neighborhood}</span>
            </>
          )}
        </span>
      )}

      {/* Price / status badge */}
      {isSoldOut ? (
        <span className="flex-shrink-0 font-mono text-2xs font-bold uppercase text-[var(--muted)]">
          Sold Out
        </span>
      ) : event.is_free ? (
        <span className="flex-shrink-0 font-mono text-xs text-[var(--neon-green)]">
          Free
        </span>
      ) : event.price_min !== null && event.price_min !== undefined ? (
        <span className="flex-shrink-0 font-mono text-xs text-[var(--soft)]">
          ${event.price_min}
        </span>
      ) : null}
    </Link>
  );
});

export type { HorizonSupportingRowProps };
