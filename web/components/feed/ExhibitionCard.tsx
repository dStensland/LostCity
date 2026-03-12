"use client";

/**
 * ExhibitionCard — arts-specific event card for exhibitions, shows, and gallery events.
 *
 * Key differences from CompactEventRow:
 *  - Shows run dates (opens/closes) instead of single-event time
 *  - "Closing soon" urgency badge with countdown
 *  - Gallery/venue name prominent
 *  - No category icon strip — the medium IS the context
 *  - Horizontal layout on desktop, vertical on mobile
 */

import Link from "next/link";
import Image from "@/components/SmartImage";
import type { FeedEventData } from "@/components/EventCard";
import { formatExhibitionDate } from "@/lib/formats";

interface ExhibitionCardProps {
  event: FeedEventData;
  portalSlug: string;
  /** Show urgency badge for closing-soon items */
  showUrgency?: boolean;
  /** Accent color for urgency badge */
  accentColor?: string;
}

export default function ExhibitionCard({
  event,
  portalSlug,
  showUrgency = false,
  accentColor = "#D4944C",
}: ExhibitionCardProps) {
  const dateInfo = formatExhibitionDate(event.start_date, event.end_date ?? null);
  const venueName = event.venue?.name;
  const neighborhood = event.venue?.neighborhood;

  // Compute days until closing for urgency display
  let daysLeft: number | null = null;
  if (showUrgency && event.end_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(event.end_date + "T00:00:00");
    daysLeft = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  const placeholderBg = `linear-gradient(145deg, color-mix(in srgb, ${accentColor} 18%, #1A1714) 0%, #1A1714 70%)`;

  return (
    <Link
      href={`/${portalSlug}?event=${event.id}`}
      scroll={false}
      className="group block overflow-hidden border border-[var(--twilight)]/40 hover:border-[var(--soft)]/30 transition-all sm:flex"
    >
      {/* Image — square on mobile, fixed width on desktop */}
      <div className="relative aspect-[4/3] sm:aspect-auto sm:w-48 sm:flex-shrink-0 overflow-hidden">
        {event.image_url ? (
          <Image
            src={event.image_url}
            alt=""
            fill
            className="object-cover group-hover:scale-[1.03] transition-transform duration-700"
            sizes="(max-width: 640px) 100vw, 192px"
            blurhash={event.blurhash}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: placeholderBg }}
          >
            <svg className="w-10 h-10 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        )}

        {/* Urgency badge — top-left */}
        {showUrgency && daysLeft !== null && daysLeft <= 14 && (
          <span
            className="absolute top-2 left-2 px-2 py-1 font-mono text-2xs font-bold uppercase tracking-wider"
            style={{
              backgroundColor: daysLeft <= 3 ? "#D4567A" : daysLeft <= 7 ? accentColor : "#1A1714",
              color: daysLeft <= 7 ? "#12100E" : "#F5F0EB",
            }}
          >
            {daysLeft <= 1 ? "Last day" : `${daysLeft}d left`}
          </span>
        )}

        {/* Free badge — top-right */}
        {event.is_free && (
          <span className="absolute top-2 right-2 px-2 py-1 font-mono text-2xs font-bold uppercase tracking-wider bg-[#1A1714]/80 text-[#E8B931]">
            Free
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-3 sm:p-4 sm:flex sm:flex-col sm:justify-between flex-1 min-w-0">
        <div>
          {/* Title */}
          <h3 className="font-semibold text-[var(--cream)] text-sm sm:text-base leading-snug line-clamp-2 group-hover:opacity-80 transition-opacity">
            {event.title}
          </h3>

          {/* Venue + Neighborhood */}
          {venueName && (
            <p className="mt-1 font-mono text-xs text-[var(--soft)] truncate">
              {venueName}
              {neighborhood && (
                <span className="text-[var(--muted)]"> · {neighborhood}</span>
              )}
            </p>
          )}
        </div>

        {/* Date status + tags */}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span
            className={`font-mono text-xs font-medium ${
              dateInfo.isHighlight ? "text-[var(--cream)]" : "text-[var(--muted)]"
            }`}
            style={dateInfo.isHighlight ? { color: accentColor } : undefined}
          >
            {dateInfo.label}
          </span>

          {/* Medium tags — first 2 only */}
          {event.tags?.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="font-mono text-2xs text-[var(--muted)] uppercase tracking-wider"
            >
              {tag.replace(/-/g, " ")}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
