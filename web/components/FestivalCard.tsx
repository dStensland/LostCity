"use client";

import Link from "next/link";
import Image from "next/image";
import { format, parseISO, isSameDay } from "date-fns";
import { getSeriesTypeLabel, getSeriesTypeColor } from "@/lib/series-utils";
import type { SeriesInfo } from "@/components/SeriesCard";
import type { FestivalSummary } from "@/lib/event-grouping";

interface Props {
  series: SeriesInfo;
  summary: FestivalSummary;
  portalSlug?: string;
  skipAnimation?: boolean;
}

/**
 * Collapsed festival/convention card that shows a summary
 * instead of individual events/showtimes
 */
export default function FestivalCard({
  series,
  summary,
  portalSlug,
  skipAnimation,
}: Props) {
  const typeColor = getSeriesTypeColor(series.series_type);
  const typeLabel = getSeriesTypeLabel(series.series_type);
  const seriesUrl = portalSlug ? `/${portalSlug}?series=${series.slug}` : `/series/${series.slug}`;

  // Format date range
  const startDate = parseISO(summary.startDate);
  const endDate = parseISO(summary.endDate);
  const isSingleDay = isSameDay(startDate, endDate);

  const dateDisplay = isSingleDay
    ? format(startDate, "MMM d")
    : `${format(startDate, "MMM d")} - ${format(endDate, "MMM d")}`;

  // Calculate days
  const dayCount = isSingleDay
    ? 1
    : Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  return (
    <div
      className={`rounded-lg border border-[var(--twilight)] mb-4 overflow-hidden card-atmospheric ${skipAnimation ? "" : "animate-fade-in"}`}
      style={{
        borderLeftWidth: "3px",
        borderLeftColor: typeColor,
        backgroundColor: "var(--card-bg)",
        "--glow-color": typeColor,
        "--reflection-color": `color-mix(in srgb, ${typeColor} 15%, transparent)`,
      } as React.CSSProperties}
    >
      {/* Header */}
      <div className="p-3">
        <div className="flex items-start gap-3">
          {/* Poster/icon */}
          {series.image_url ? (
            <Image
              src={series.image_url}
              alt={series.title}
              width={56}
              height={56}
              className="rounded-md object-cover flex-shrink-0"
              style={{ width: 56, height: 56 }}
            />
          ) : (
            <div
              className="w-14 h-14 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${typeColor}20` }}
            >
              {/* Festival/convention icon */}
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: typeColor }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          )}

          {/* Title and type */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.6rem] font-mono font-medium uppercase tracking-wider"
                style={{
                  backgroundColor: `${typeColor}20`,
                  color: typeColor,
                }}
              >
                {typeLabel}
              </span>
              <span className="font-mono text-[0.55rem] text-[var(--muted)]">
                {dateDisplay}
              </span>
            </div>
            <Link
              href={seriesUrl}
              scroll={false}
              className="font-medium text-[var(--cream)] hover:text-[var(--coral)] transition-colors line-clamp-2 block"
            >
              {series.title}
            </Link>
          </div>
        </div>

        {/* Summary stats */}
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          {/* Event count */}
          <div className="flex items-center gap-1.5 text-[var(--muted)]">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>
              {summary.eventCount} event{summary.eventCount !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Day count (if multi-day) */}
          {dayCount > 1 && (
            <div className="flex items-center gap-1.5 text-[var(--muted)]">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{dayCount} days</span>
            </div>
          )}

          {/* Venue count */}
          {summary.venues.length > 0 && (
            <div className="flex items-center gap-1.5 text-[var(--muted)]">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>
                {summary.venues.length === 1
                  ? summary.venues[0].name
                  : `${summary.venues.length} venues`}
              </span>
            </div>
          )}
        </div>

        {/* Venue list (if multiple) */}
        {summary.venues.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {summary.venues.slice(0, 3).map((venue) => (
              <Link
                key={venue.id}
                href={portalSlug ? `/${portalSlug}?spot=${venue.slug}` : `/spots/${venue.slug}`}
                scroll={false}
                className="text-[0.65rem] px-1.5 py-0.5 rounded bg-[var(--twilight)]/30 text-[var(--soft)] hover:bg-[var(--twilight)]/50 hover:text-[var(--cream)] transition-colors"
              >
                {venue.name}
              </Link>
            ))}
            {summary.venues.length > 3 && (
              <span className="text-[0.65rem] px-1.5 py-0.5 text-[var(--muted)]">
                +{summary.venues.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer link */}
      <Link
        href={seriesUrl}
        scroll={false}
        className="flex items-center justify-end gap-1 px-3 py-2 border-t border-[var(--twilight)]/30 text-xs text-[var(--muted)] hover:text-[var(--coral)] hover:bg-[var(--twilight)]/20 transition-colors"
      >
        View Schedule
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
