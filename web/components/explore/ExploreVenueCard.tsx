"use client";

import Link from "next/link";
import Image from "@/components/SmartImage";
import { EXPLORE_THEME, isUncertainArtefactImageSlug } from "@/lib/explore-tracks";
import type { ExploreTrackVenue, ExploreVenueEvent } from "@/lib/explore-tracks";
import { HIGHLIGHT_CONFIG, type HighlightType } from "@/lib/venue-highlights";

interface ExploreVenueCardProps {
  venue: ExploreTrackVenue;
  portalSlug: string;
  accent?: string;
  variant?: "featured" | "compact";
  highlight?: boolean;
}

export default function ExploreVenueCard({
  venue,
  portalSlug,
  accent = EXPLORE_THEME.primary,
  variant = "compact",
  highlight = false,
}: ExploreVenueCardProps) {
  const isFeatured = variant === "featured";
  const events = venue.upcomingEvents ?? [];
  const tonightEvents = events.filter((e) => e.isTonight);
  const hasTonight = tonightEvents.length > 0;
  const eventCount = events.length;
  const nextEvent = events[0] ?? null;
  const highlights = venue.highlights ?? [];
  const imageUncertain = isUncertainArtefactImageSlug(venue.slug);

  const tags = buildVenueTags(venue);

  if (!isFeatured) {
    return (
      <CompactVenueCard
        venue={venue}
        portalSlug={portalSlug}
        accent={accent}
        events={events}
        hasTonight={hasTonight}
        eventCount={eventCount}
        imageUncertain={imageUncertain}
      />
    );
  }

  // Featured — venue card with image header + event rows
  return (
    <div
      className="rounded-xl overflow-hidden group venue-card-lift"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--night) 84%, transparent), color-mix(in srgb, var(--dusk) 72%, transparent))",
        border: `1px solid ${
          hasTonight
            ? "rgba(224,58,62,0.3)"
            : eventCount > 0
              ? "rgba(193,211,47,0.2)"
              : highlight
                ? `${accent}30`
                : "var(--twilight)"
        }`,
        borderLeft: hasTonight
          ? "2px solid #E03A3E"
          : eventCount > 0
            ? `2px solid ${accent}`
            : highlight
              ? `2px solid ${accent}`
              : undefined,
        boxShadow: hasTonight
          ? "0 10px 24px rgba(224,58,62,0.2)"
          : eventCount > 0
            ? "0 8px 22px rgba(193,211,47,0.14)"
            : "0 6px 16px rgba(0,0,0,0.26)",
      }}
    >
      {/* Image — 160px fixed height, venue name overlaid */}
      <Link
        href={`/${portalSlug}?spot=${venue.slug}`}
        className="block relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset"
        style={{ height: 160, isolation: "isolate" }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background:
              "linear-gradient(145deg, color-mix(in srgb, var(--night) 88%, transparent), color-mix(in srgb, var(--dusk) 70%, transparent))",
          }}
        >
          <span className="text-3xl opacity-20">📍</span>
        </div>
        {venue.imageUrl && (
          <Image
            src={venue.imageUrl}
            alt={venue.name}
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            style={{ filter: "contrast(1.06) saturate(0.8)", willChange: "transform", backfaceVisibility: "hidden" }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)",
          }}
        />

        {/* Venue name + tags overlay — bottom of image */}
        <div className="absolute bottom-0 left-0 right-0 p-3.5 z-[2]">
          <h3
            className="explore-display-heading text-[18px] md:text-[20px] font-semibold leading-[1.25] mb-1"
            style={{ color: "var(--cream)" }}
          >
            {venue.name}
          </h3>
          {tags.length > 0 && (
            <div className="flex gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="font-mono text-[9px] px-2 py-0.5 rounded uppercase tracking-[0.05em]"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    color: "var(--muted)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {nextEvent && (
          <div className="absolute top-2.5 left-2.5 z-[3]">
            <span
              className="font-mono text-[9px] font-semibold px-2 py-[3px] rounded-md"
              style={{
                background: "rgba(0,0,0,0.7)",
                color: hasTonight ? "#E03A3E" : "#C1D32F",
                border: `1px solid ${hasTonight ? "rgba(224,58,62,0.45)" : "rgba(193,211,47,0.35)"}`,
              }}
            >
              {hasTonight
                ? "Now"
                : nextEvent.startDate
                  ? `${formatShortDay(nextEvent.startDate)}${nextEvent.startTime ? ` ${formatTime(nextEvent.startTime)}` : ""}`
                  : "Upcoming"}
            </span>
          </div>
        )}

        {/* Badges — top right */}
        <div className="absolute top-2.5 right-2.5 z-[3] flex flex-col gap-1 items-end">
          {hasTonight && (
            <span
              className="font-mono text-[9px] font-semibold px-2 py-[3px] rounded-md uppercase tracking-[0.03em] animate-pulse"
              style={{ background: "#E03A3E", color: "#fff" }}
            >
              Tonight
            </span>
          )}
          {!hasTonight && eventCount > 0 && (
            <span
              className="font-mono text-[9px] font-semibold px-2 py-[3px] rounded-md"
              style={{ background: "#C1D32F", color: "var(--void)" }}
            >
              {eventCount} this week
            </span>
          )}
          {imageUncertain && (
            <span
              className="font-mono text-[10px] font-semibold px-2 py-[3px] rounded-md"
              style={{ background: "#22C55E", color: "#052e16" }}
              title="Image needs manual verification"
              aria-label="Image needs manual verification"
            >
              ?
            </span>
          )}
        </div>
      </Link>

      {/* Event rows — clickable links to event detail */}
      {events.length > 0 && (
        <div>
          {events.slice(0, 3).map((ev, i) => (
            <EventRow
              key={ev.id}
              event={ev}
              isLast={i === Math.min(events.length, 3) - 1 && events.length <= 3}
              accent={accent}
              portalSlug={portalSlug}
            />
          ))}
          {events.length > 3 && (
            <Link
              href={`/${portalSlug}?spot=${venue.slug}`}
              className="block px-3.5 py-2.5 text-center text-[10px] font-mono transition-colors hover:bg-[rgba(255,255,255,0.04)]"
              style={{
                color: accent,
                background: `${accent}05`,
                borderTop: "1px solid rgba(255,255,255,0.03)",
              }}
            >
              +{events.length - 3} more {events.length === 4 ? "event" : "events"}
            </Link>
          )}
        </div>
      )}

      {/* Editorial blurb */}
      {venue.editorialBlurb && (
        <div className="px-3.5 py-3" style={{ borderTop: events.length > 0 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
          <p
            className="text-[12.5px] italic leading-[1.55]"
            style={{ color: "var(--muted)" }}
          >
            {venue.editorialBlurb}
          </p>
          {venue.sourceUrl && (
            <a
              href={venue.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-mono mt-1 inline-block hover:underline"
              style={{ color: accent }}
              onClick={(e) => e.stopPropagation()}
            >
              {venue.sourceLabel || "Learn more"} &rarr;
            </a>
          )}
        </div>
      )}

      {/* Venue highlights */}
      {highlights.length > 0 && (
        <div
          className="px-3.5 py-2.5 flex flex-wrap gap-1.5"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.03)",
          }}
        >
          {highlights.map((h) => {
            const config = HIGHLIGHT_CONFIG[h.highlightType as HighlightType];
            const IconComp = config?.Icon;
            return (
              <span
                key={h.id}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-[3px] rounded-md"
                style={{
                  background: config ? `${config.color}12` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${config ? `${config.color}25` : "rgba(255,255,255,0.06)"}`,
                  color: config?.color ?? "var(--muted)",
                }}
                title={h.description ?? h.title}
              >
                {IconComp && <IconComp size={12} weight="light" className="icon-neon-subtle" />}
                <span className="font-mono font-medium">{h.title}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Compact Card — grid layout, larger text and images
// ============================================================================

function CompactVenueCard({
  venue,
  portalSlug,
  accent,
  events,
  hasTonight,
  eventCount,
  imageUncertain,
}: {
  venue: ExploreTrackVenue;
  portalSlug: string;
  accent: string;
  events: ExploreVenueEvent[];
  hasTonight: boolean;
  eventCount: number;
  imageUncertain: boolean;
}) {
  const nextEvent = events[0] ?? null;
  const highlights = venue.highlights ?? [];

  return (
    <Link
      href={`/${portalSlug}?spot=${venue.slug}`}
      className="rounded-xl overflow-hidden group block venue-card-lift transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)]"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--night) 84%, transparent), color-mix(in srgb, var(--dusk) 72%, transparent))",
        border: "1px solid var(--twilight)",
      }}
    >
      {/* Image — 4:3 on mobile, 1:1 on wider grids */}
      <div
        className="relative overflow-hidden aspect-[4/3] sm:aspect-square"
        style={{ isolation: "isolate" }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background:
              "linear-gradient(145deg, color-mix(in srgb, var(--night) 88%, transparent), color-mix(in srgb, var(--dusk) 70%, transparent))",
          }}
        >
          <span className="text-xl opacity-15">📍</span>
        </div>
        {venue.imageUrl && (
          <Image
            src={venue.imageUrl}
            alt={venue.name}
            fill
            sizes="(max-width: 640px) 50vw, 250px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            style={{ filter: "contrast(1.06) saturate(0.75)", willChange: "transform", backfaceVisibility: "hidden" }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 40%)",
          }}
        />

        {/* Badge */}
        <div className="absolute top-[6px] right-[6px] z-[3] flex flex-col gap-[3px] items-end">
          {hasTonight && (
            <span
              className="font-mono text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase animate-pulse"
              style={{ background: "#E03A3E", color: "#fff" }}
            >
              Tonight
            </span>
          )}
          {!hasTonight && eventCount > 0 && (
            <span
              className="font-mono text-[9px] font-semibold px-1.5 py-0.5 rounded"
              style={{ background: "#C1D32F", color: "var(--void)" }}
            >
              {eventCount} this week
            </span>
          )}
          {imageUncertain && (
            <span
              className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ background: "#22C55E", color: "#052e16" }}
              title="Image needs manual verification"
              aria-label="Image needs manual verification"
            >
              ?
            </span>
          )}
        </div>

        {nextEvent && (
          <div className="absolute top-[6px] left-[6px] z-[3]">
            <span
              className="font-mono text-[8px] font-semibold px-1.5 py-0.5 rounded"
              style={{
                background: "rgba(0,0,0,0.62)",
                color: hasTonight ? "#E03A3E" : "#C1D32F",
                border: `1px solid ${hasTonight ? "rgba(224,58,62,0.45)" : "rgba(193,211,47,0.35)"}`,
              }}
            >
              {hasTonight ? "Now" : "Next up"}
            </span>
          </div>
        )}

        {/* Next event overlay on image */}
        {nextEvent && (
          <div
            className="absolute bottom-1.5 left-1.5 right-1.5 z-[3] flex items-center gap-1 text-[9px] leading-[1.3]"
            style={{
              color: "var(--cream)",
              textShadow: "0 1px 4px rgba(0,0,0,0.9)",
            }}
          >
            <span
              className="font-mono text-[9px] font-semibold flex-shrink-0"
              style={{ color: nextEvent.isTonight ? "#E03A3E" : "#C1D32F" }}
            >
              {nextEvent.isTonight
                ? nextEvent.startTime
                  ? formatTime(nextEvent.startTime)
                  : "Tonight"
                : `${formatShortDay(nextEvent.startDate)}${nextEvent.startTime ? " " + formatTime(nextEvent.startTime) : ""}`}
            </span>
            <span className="truncate">{nextEvent.title}</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-2.5 pb-3">
        <h4
          className="text-[14px] font-bold leading-[1.25] mb-0.5"
          style={{ color: "var(--cream)" }}
        >
          {venue.name}
        </h4>
        {venue.neighborhood && (
          <p
            className="font-mono text-[9px] uppercase mb-1"
            style={{ color: "var(--muted)" }}
          >
            {venue.neighborhood}
          </p>
        )}
        {venue.editorialBlurb && (
          <p
            className="text-[11.5px] leading-[1.45] line-clamp-3"
            style={{ color: "var(--soft)" }}
          >
            {venue.editorialBlurb}
          </p>
        )}
        {venue.sourceUrl && (
          <span
            role="link"
            tabIndex={0}
            className="text-[10px] font-mono mt-0.5 inline-block cursor-pointer hover:underline"
            style={{ color: accent }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(venue.sourceUrl!, '_blank', 'noopener,noreferrer'); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); window.open(venue.sourceUrl!, '_blank', 'noopener,noreferrer'); } }}
          >
            {venue.sourceLabel || "Learn more"} &rarr;
          </span>
        )}
        {highlights.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {highlights.slice(0, 2).map((h) => {
              const config = HIGHLIGHT_CONFIG[h.highlightType as HighlightType];
              const IconComp = config?.Icon;
              return (
                <span
                  key={h.id}
                  className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-[2px] rounded"
                  style={{
                    background: config ? `${config.color}10` : "rgba(255,255,255,0.04)",
                    color: config?.color ?? "var(--muted)",
                  }}
                >
                  {IconComp && <IconComp size={10} weight="light" />}
                  <span className="font-mono">{h.title}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </Link>
  );
}

// ============================================================================
// Event Row — clickable link, time-first layout
// ============================================================================

function EventRow({
  event,
  isLast,
  accent,
  portalSlug,
}: {
  event: ExploreVenueEvent;
  isLast: boolean;
  accent: string;
  portalSlug: string;
}) {
  return (
    <Link
      href={`/${portalSlug}?event=${event.id}`}
      scroll={false}
      className="flex items-start gap-3 px-3.5 py-3 transition-colors hover:bg-[rgba(255,255,255,0.03)] group/row focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset"
      style={{
        background: event.isTonight ? "rgba(224,58,62,0.06)" : "transparent",
        borderBottom: isLast
          ? "none"
          : "1px solid color-mix(in srgb, var(--twilight) 50%, transparent)",
      }}
    >
      {/* Time column */}
      <div
        className="font-mono text-[12px] font-semibold min-w-[52px] flex-shrink-0 pt-0.5"
        style={{
          color: event.isTonight ? "#E03A3E" : accent,
        }}
      >
        {event.startTime
          ? formatTime(event.startTime)
          : event.isTonight
            ? "Tonight"
            : formatShortDay(event.startDate)}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p
          className="text-[15px] font-medium leading-[1.3] mb-0.5 transition-colors group-hover/row:text-[var(--coral)]"
          style={{ color: "var(--cream)" }}
        >
          {event.title}
        </p>
        <div
          className="font-mono text-[11px] flex items-center gap-2"
          style={{ color: "var(--muted)" }}
        >
          {/* Date context */}
          <span>
            {event.isTonight ? "Tonight" : formatShortDay(event.startDate)}
          </span>
          {/* Category */}
          {event.category && (
            <>
              <span>&middot;</span>
              <span>{event.category}</span>
            </>
          )}
          {/* Free badge */}
          {event.isFree && (
            <span
              className="text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase"
              style={{
                background: "rgba(52,211,153,0.15)",
                color: "#34D399",
              }}
            >
              Free
            </span>
          )}
        </div>
      </div>

      {/* Chevron — visible by default for touch, brighter on hover */}
      <svg
        className="w-4 h-4 flex-shrink-0 mt-1 opacity-30 group-hover/row:opacity-60 group-hover/row:translate-x-0.5 transition-all"
        style={{ color: "var(--soft)" }}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5l7 7-7 7"
        />
      </svg>
    </Link>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function buildVenueTags(venue: ExploreTrackVenue): string[] {
  const tags: string[] = [];
  if (venue.venueType) {
    tags.push(
      venue.venueType
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    );
  }
  return tags.slice(0, 3);
}

function formatShortDay(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[date.getDay()];
}

function formatTime(timeStr: string): string {
  const parts = timeStr.split(":");
  const h = parseInt(parts[0]);
  const m = parseInt(parts[1] ?? "0");
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m > 0 ? `${h12}:${parts[1]}${ampm}` : `${h12}${ampm}`;
}
