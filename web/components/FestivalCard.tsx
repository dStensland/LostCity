"use client";

import { memo } from "react";
import Link from "next/link";
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
const FestivalCard = memo(function FestivalCard({
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

  // Calculate days
  const dayCount = isSingleDay
    ? 1
    : Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const firstVenue = summary.venues[0];

  return (
    <Link
      href={seriesUrl}
      scroll={false}
      className={`block p-3 mb-4 rounded-sm border border-[var(--twilight)] card-atmospheric group overflow-hidden ${skipAnimation ? "" : "animate-card-emerge"}`}
      style={{
        borderLeftWidth: "3px",
        borderLeftColor: typeColor,
        backgroundColor: "var(--card-bg)",
        "--glow-color": typeColor,
        "--reflection-color": `color-mix(in srgb, ${typeColor} 10%, transparent)`,
      } as React.CSSProperties}
    >
      <div className="flex gap-3">
        {/* Date cell - matches EventCard time cell */}
        <div className="flex-shrink-0 w-14 flex flex-col items-center justify-center py-1">
          <span className="font-mono text-[0.65rem] font-semibold text-[var(--coral)] leading-none uppercase tracking-wide">
            {format(startDate, "MMM")}
          </span>
          <span className="font-mono text-base font-bold text-[var(--cream)] leading-none tabular-nums mt-1">
            {format(startDate, "d")}
          </span>
          {dayCount > 1 && (
            <span className="font-mono text-[0.6rem] font-medium text-[var(--soft)] mt-0.5">
              {dayCount} days
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Mobile: Stacked layout matching EventCard */}
          <div className="sm:hidden">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="inline-flex items-center justify-center w-7 h-7 rounded"
                style={{ backgroundColor: `${typeColor}20` }}
              >
                <span className="text-xs font-bold" style={{ color: typeColor }}>
                  {typeLabel.charAt(0)}
                </span>
              </span>
            </div>
            <h3 className="text-[var(--cream)] font-bold text-lg leading-tight line-clamp-2 group-hover:text-[var(--glow-color)] transition-colors mb-1">
              {series.title}
            </h3>
          </div>

          {/* Desktop: Inline layout matching EventCard */}
          <div className="hidden sm:flex items-center gap-2 mb-0.5">
            <span
              className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded"
              style={{ backgroundColor: `${typeColor}20` }}
            >
              <span className="text-sm font-bold" style={{ color: typeColor }}>
                {typeLabel.charAt(0)}
              </span>
            </span>
            <span className="text-[var(--cream)] font-bold text-lg transition-colors line-clamp-1 group-hover:text-[var(--glow-color)]">
              {series.title}
            </span>
          </div>

          {/* Details row - matches EventCard style */}
          <div className="flex items-center gap-1.5 text-sm text-[var(--soft)] mt-1">
            {firstVenue && (
              <span className="truncate max-w-[40%] font-medium" title={firstVenue.name}>{firstVenue.name}</span>
            )}
            {summary.venues.length > 1 && (
              <>
                <span className="opacity-40">·</span>
                <span>+{summary.venues.length - 1} venues</span>
              </>
            )}
            <span className="opacity-40">·</span>
            <span>{summary.eventCount} event{summary.eventCount !== 1 ? "s" : ""}</span>
            {!isSingleDay && (
              <>
                <span className="opacity-40">·</span>
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.6rem] font-mono font-medium"
                  style={{
                    backgroundColor: `${typeColor}20`,
                    color: typeColor,
                  }}
                >
                  {typeLabel}
                </span>
              </>
            )}
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

      </div>
    </Link>
  );
});

export default FestivalCard;
