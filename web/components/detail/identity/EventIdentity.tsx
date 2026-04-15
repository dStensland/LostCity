"use client";

import { memo } from "react";
import { parseISO, format } from "date-fns";
import { MapPin, CalendarBlank, Ticket } from "@phosphor-icons/react";
import Dot from "@/components/ui/Dot";
import Badge from "@/components/ui/Badge";
import { formatEventTime, formatPriceRange } from "@/lib/detail/format";
import { buildSpotUrl } from "@/lib/entity-urls";
import type { EventData } from "@/lib/detail/types";

// ── Duration labels (Taxonomy v2) ─────────────────────────────────────────────

const DURATION_LABELS: Record<string, string> = {
  short: "~1 hour",
  medium: "2-3 hours",
  "half-day": "Half day",
  "full-day": "Full day",
  "multi-day": "Multiple days",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateDisplay(startDate: string, endDate: string | null): string {
  const dateObj = parseISO(startDate);
  if (endDate && endDate !== startDate) {
    return `${format(dateObj, "MMM d")} – ${format(parseISO(endDate), "MMM d")}`;
  }
  return format(dateObj, "EEE, MMM d");
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface EventIdentityProps {
  event: EventData;
  portalSlug: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const EventIdentity = memo(function EventIdentity({
  event,
  portalSlug,
}: EventIdentityProps) {
  const dateDisplay = formatDateDisplay(event.start_date, event.end_date);
  const timeDisplay = formatEventTime(event.is_all_day, event.start_time, event.end_time);
  const priceText = formatPriceRange(event.is_free, event.price_min, event.price_max);
  const isFree = event.is_free || priceText === "Free";

  const venueUrl = event.venue
    ? buildSpotUrl(event.venue.slug, portalSlug, "page")
    : null;

  const hasTaxonomyBadges =
    (event.cost_tier && event.cost_tier !== "free") ||
    (event.duration && DURATION_LABELS[event.duration]) ||
    event.indoor_outdoor ||
    event.booking_required;

  return (
    <div className="space-y-2">
      {/* Title */}
      <h1 className="text-xl lg:text-2xl font-bold text-[var(--cream)] leading-tight">
        {event.title}
      </h1>

      {/* Venue link */}
      {event.venue && venueUrl && (
        <a
          href={venueUrl}
          className="flex items-start gap-1.5 text-sm text-[var(--soft)] hover:text-[var(--coral)] transition-colors focus-ring group"
        >
          <MapPin
            size={14}
            weight="duotone"
            className="flex-shrink-0 mt-0.5 text-[var(--coral)]"
            aria-hidden="true"
          />
          <span>
            <span className="group-hover:underline">{event.venue.name}</span>
            {event.venue.address && (
              <span className="block text-xs text-[var(--muted)] mt-0.5">
                {event.venue.address}
              </span>
            )}
          </span>
        </a>
      )}

      {/* Date + Time + Price row */}
      <p className="text-sm flex items-center gap-1.5 flex-wrap">
        <CalendarBlank
          size={13}
          weight="duotone"
          className="text-[var(--gold)] flex-shrink-0"
          aria-hidden="true"
        />
        <span className="text-[var(--cream)] font-medium">{dateDisplay}</span>
        {timeDisplay && (
          <>
            <Dot />
            <span className="text-[var(--soft)]">{timeDisplay}</span>
          </>
        )}
        {priceText && (
          <>
            <Dot />
            <Ticket
              size={13}
              weight="duotone"
              className="flex-shrink-0 text-[var(--muted)]"
              aria-hidden="true"
            />
            <span
              className={`font-mono font-bold ${
                isFree ? "text-[var(--neon-green)]" : "text-[var(--gold)]"
              }`}
            >
              {priceText}
            </span>
          </>
        )}
      </p>

      {/* Genre pills */}
      {event.genres && event.genres.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {event.genres.slice(0, 5).map((genre) => (
            <Badge key={genre} variant="neutral" size="sm">
              {genre.replace(/-/g, " ")}
            </Badge>
          ))}

          {/* Taxonomy v2 badges (inline with genres per spec 2.10) */}
          {hasTaxonomyBadges && (
            <>
              {event.cost_tier && event.cost_tier !== "free" && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-2xs font-medium text-[var(--gold)] bg-[var(--gold)]/10 border border-[var(--gold)]/25 uppercase tracking-wide">
                  {event.cost_tier}
                </span>
              )}
              {event.duration && DURATION_LABELS[event.duration] && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-2xs text-[var(--muted)] bg-[var(--twilight)]/40">
                  {DURATION_LABELS[event.duration]}
                </span>
              )}
              {event.indoor_outdoor && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-2xs text-[var(--muted)] bg-[var(--twilight)]/40 capitalize">
                  {event.indoor_outdoor === "both"
                    ? "Indoor & Outdoor"
                    : event.indoor_outdoor}
                </span>
              )}
              {event.booking_required && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-2xs text-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/20">
                  Book ahead
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* Taxonomy badges only (when no genres) */}
      {(!event.genres || event.genres.length === 0) && hasTaxonomyBadges && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {event.cost_tier && event.cost_tier !== "free" && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-2xs font-medium text-[var(--gold)] bg-[var(--gold)]/10 border border-[var(--gold)]/25 uppercase tracking-wide">
              {event.cost_tier}
            </span>
          )}
          {event.duration && DURATION_LABELS[event.duration] && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-2xs text-[var(--muted)] bg-[var(--twilight)]/40">
              {DURATION_LABELS[event.duration]}
            </span>
          )}
          {event.indoor_outdoor && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-2xs text-[var(--muted)] bg-[var(--twilight)]/40 capitalize">
              {event.indoor_outdoor === "both"
                ? "Indoor & Outdoor"
                : event.indoor_outdoor}
            </span>
          )}
          {event.booking_required && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-2xs text-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/20">
              Book ahead
            </span>
          )}
        </div>
      )}
    </div>
  );
});

export type { EventIdentityProps };
