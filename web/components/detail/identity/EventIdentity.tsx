"use client";

import { memo } from "react";
import { parseISO, format } from "date-fns";
import { MapPin, CalendarBlank, Ticket } from "@phosphor-icons/react";
import { formatEventTime, formatPriceRange } from "@/lib/detail/format";
import { buildSpotUrl } from "@/lib/entity-urls";
import type { EventData } from "@/lib/detail/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateDisplay(startDate: string, endDate: string | null): string {
  const dateObj = parseISO(startDate);
  if (endDate && endDate !== startDate) {
    return `${format(dateObj, "MMM d")} – ${format(parseISO(endDate), "MMM d")}`;
  }
  return format(dateObj, "EEE, MMM d");
}

function formatDateShort(startDate: string): string {
  return format(parseISO(startDate), "MMM d").toUpperCase();
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface EventIdentityProps {
  event: EventData;
  portalSlug: string;
  variant?: "sidebar" | "elevated";
}

// ── Component ─────────────────────────────────────────────────────────────────

export const EventIdentity = memo(function EventIdentity({
  event,
  portalSlug,
  variant = "sidebar",
}: EventIdentityProps) {
  const dateDisplay = formatDateDisplay(event.start_date, event.end_date);
  const timeDisplay = formatEventTime(event.is_all_day, event.start_time, event.end_time);
  const priceText = formatPriceRange(event.is_free, event.price_min, event.price_max);

  const venueUrl = event.venue
    ? buildSpotUrl(event.venue.slug, portalSlug, "page")
    : null;

  const venueLabel = event.venue
    ? [event.venue.name, event.venue.neighborhood].filter(Boolean).join(" · ")
    : null;

  const dateLabel = [dateDisplay, timeDisplay].filter(Boolean).join(" · ");

  // ── Elevated variant ────────────────────────────────────────────────────────

  if (variant === "elevated") {
    const metaParts: string[] = [];
    if (event.start_date) metaParts.push(formatDateShort(event.start_date));
    if (event.venue?.name) metaParts.push(event.venue.name.toUpperCase());
    const metadataLine = metaParts.join(" · ");

    const pills = [
      ...(event.genres ?? []),
      ...(event.tags ?? []),
    ].slice(0, 5);

    return (
      <div className="flex flex-col gap-2">
        {/* Title */}
        <h1 className="text-2xl lg:text-3xl font-bold text-[var(--cream)] leading-tight">
          {event.title}
        </h1>

        {/* Single metadata line — no icons */}
        {metadataLine && (
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            {metadataLine}
          </p>
        )}

        {/* Genre/tag pills */}
        {pills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {pills.map((pill) => (
              <span
                key={pill}
                className="px-2 py-0.5 rounded-full bg-[var(--twilight)] font-mono text-xs text-[var(--muted)] border border-[var(--twilight)]"
              >
                {pill}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Sidebar variant (default — preserve exactly) ────────────────────────────

  return (
    <div className="flex flex-col gap-2">
      {/* Title — 26px per spec */}
      <h1 className="text-[1.625rem] font-bold text-[var(--cream)] leading-tight">
        {event.title}
      </h1>

      {/* VenueRow */}
      {venueLabel && (
        <div className="flex items-center gap-1.5 w-full">
          <MapPin
            size={14}
            weight="duotone"
            className="flex-shrink-0 text-[var(--coral)]"
            aria-hidden="true"
          />
          {venueUrl ? (
            <a
              href={venueUrl}
              className="text-sm text-[var(--soft)] hover:text-[var(--coral)] transition-colors focus-ring"
            >
              {venueLabel}
            </a>
          ) : (
            <span className="text-sm text-[var(--soft)]">{venueLabel}</span>
          )}
        </div>
      )}

      {/* DateRow */}
      {dateLabel && (
        <div className="flex items-center gap-2 w-full">
          <CalendarBlank
            size={14}
            weight="duotone"
            className="flex-shrink-0 text-[var(--muted)]"
            aria-hidden="true"
          />
          <span className="text-sm text-[var(--soft)]">{dateLabel}</span>
        </div>
      )}

      {/* PriceRow */}
      {priceText && (
        <div className="flex items-center gap-2 w-full">
          <Ticket
            size={14}
            weight="duotone"
            className="flex-shrink-0 text-[var(--muted)]"
            aria-hidden="true"
          />
          <span className="text-sm text-[var(--soft)]">{priceText}</span>
        </div>
      )}
    </div>
  );
});

export type { EventIdentityProps };
