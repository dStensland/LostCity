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
    : `${format(startDate, "MMM d")} - ${format(endDate, "d")}`;

  // Calculate days
  const dayCount = isSingleDay
    ? 1
    : Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const firstVenue = summary.venues[0];

  return (
    <Link
      href={seriesUrl}
      scroll={false}
      className={`block p-3 mb-4 rounded-lg border border-[var(--twilight)] card-atmospheric group overflow-hidden ${skipAnimation ? "" : "animate-fade-in"}`}
      style={{
        borderLeftWidth: "3px",
        borderLeftColor: typeColor,
        backgroundColor: "var(--card-bg)",
        "--glow-color": typeColor,
        "--reflection-color": `color-mix(in srgb, ${typeColor} 15%, transparent)`,
      } as React.CSSProperties}
    >
      <div className="flex gap-3">
        {/* Date cell - matches EventCard time cell */}
        <div className="flex-shrink-0 w-14 flex flex-col items-center justify-center py-1">
          <span className="font-mono text-[0.55rem] font-medium text-[var(--coral)] leading-none uppercase">
            {format(startDate, "MMM")}
          </span>
          <span className="font-mono text-lg font-bold text-[var(--soft)] leading-none tabular-nums">
            {format(startDate, "d")}
          </span>
          {dayCount > 1 && (
            <span className="font-mono text-[0.5rem] text-[var(--muted)] mt-0.5">
              {dayCount} days
            </span>
          )}
        </div>

        {/* Mobile thumbnail */}
        {series.image_url ? (
          <Image
            src={series.image_url}
            alt=""
            width={48}
            height={64}
            className="flex-shrink-0 w-12 h-16 rounded-md object-cover sm:hidden border border-[var(--twilight)]"
          />
        ) : (
          <div
            className="flex-shrink-0 w-12 h-16 rounded-md flex items-center justify-center sm:hidden border border-[var(--twilight)]"
            style={{ backgroundColor: `${typeColor}15` }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: typeColor }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Top row: type badge */}
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.55rem] font-mono font-medium uppercase tracking-wider"
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

          {/* Title */}
          <h3 className="text-[var(--cream)] font-medium leading-snug line-clamp-2 group-hover:text-[var(--glow-color)] transition-colors">
            {series.title}
          </h3>

          {/* Details row - matches EventCard style */}
          <div className="flex items-center gap-1.5 text-xs text-[var(--muted)] mt-1">
            {firstVenue && (
              <span className="truncate max-w-[40%]" title={firstVenue.name}>{firstVenue.name}</span>
            )}
            {summary.venues.length > 1 && (
              <>
                <span className="opacity-40">·</span>
                <span>+{summary.venues.length - 1} venues</span>
              </>
            )}
            <span className="opacity-40">·</span>
            <span>{summary.eventCount} event{summary.eventCount !== 1 ? "s" : ""}</span>
          </div>

          {/* Venue pills (if multiple) */}
          {summary.venues.length > 1 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {summary.venues.slice(0, 3).map((venue) => (
                <span
                  key={venue.id}
                  className="font-mono text-[0.6rem] px-1.5 py-0.5 rounded bg-[var(--twilight)]/40 text-[var(--soft)]"
                >
                  {venue.name}
                </span>
              ))}
              {summary.venues.length > 3 && (
                <span className="font-mono text-[0.6rem] px-1.5 py-0.5 text-[var(--muted)]">
                  +{summary.venues.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Desktop thumbnail (right side) */}
        {series.image_url && (
          <Image
            src={series.image_url}
            alt=""
            width={80}
            height={56}
            className="hidden sm:block flex-shrink-0 w-20 h-14 rounded-lg object-cover border border-[var(--twilight)] ml-auto"
          />
        )}
      </div>
    </Link>
  );
}
