"use client";

import { memo } from "react";
import Link from "next/link";
import { getSeriesTypeLabel, getSeriesTypeColor } from "@/lib/series-utils";
import { formatTimeSplit } from "@/lib/formats";
import { formatRecurrence, type Frequency, type DayOfWeek } from "@/lib/recurrence";
import SeriesBadge from "./SeriesBadge";

export interface SeriesVenueGroup {
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
  };
  showtimes: { id: number; time: string | null }[];
}

export interface SeriesInfo {
  id: string;
  slug: string;
  title: string;
  series_type: string;
  image_url: string | null;
  frequency?: string | null;
  day_of_week?: string | null;
}

interface Props {
  series: SeriesInfo;
  venueGroups: SeriesVenueGroup[];
  portalSlug?: string;
  skipAnimation?: boolean;
}

const SeriesCard = memo(function SeriesCard({
  series,
  venueGroups,
  portalSlug,
  skipAnimation,
}: Props) {
  const typeColor = getSeriesTypeColor(series.series_type);
  const typeLabel = getSeriesTypeLabel(series.series_type);
  const seriesUrl = portalSlug ? `/${portalSlug}?series=${series.slug}` : `/series/${series.slug}`;

  // Get total showtime count
  const totalShowtimes = venueGroups.reduce((sum, vg) => sum + vg.showtimes.length, 0);

  // Get first showtime for the time display
  const firstShowtime = venueGroups[0]?.showtimes[0];
  const firstVenue = venueGroups[0]?.venue;

  // Format the first showtime like EventCard does
  const timeParts = firstShowtime?.time
    ? formatTimeSplit(firstShowtime.time, false)
    : null;

  // Recurrence pattern for recurring shows
  const recurrenceText = formatRecurrence(
    (series.frequency as Frequency) || null,
    (series.day_of_week as DayOfWeek) || null
  );

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
        {/* Time cell - matches EventCard typography */}
        <div className="flex-shrink-0 w-14 flex flex-col items-center justify-center py-1">
          <span className="font-mono text-[0.65rem] font-semibold text-[var(--muted)] leading-none uppercase tracking-wide">
            {totalShowtimes} {totalShowtimes === 1 ? "date" : "dates"}
          </span>
          {timeParts ? (
            <>
              <span className="font-mono text-base font-bold text-[var(--cream)] leading-none tabular-nums mt-1">
                {timeParts.time}
              </span>
              {timeParts.period && (
                <span className="font-mono text-[0.6rem] font-medium text-[var(--soft)] mt-0.5">{timeParts.period}</span>
              )}
            </>
          ) : (
            <span className="font-mono text-[0.65rem] font-semibold text-[var(--soft)] leading-none mt-1 uppercase tracking-wide">
              Times vary
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
            {venueGroups.length > 1 && (
              <>
                <span className="opacity-40">·</span>
                <span>+{venueGroups.length - 1} more venues</span>
              </>
            )}
            {firstVenue?.neighborhood && venueGroups.length === 1 && (
              <>
                <span className="opacity-40">·</span>
                <span className="truncate">{firstVenue.neighborhood}</span>
              </>
            )}
            <span className="opacity-40">·</span>
            <SeriesBadge
              seriesType={series.series_type}
              frequency={series.frequency as Frequency}
              dayOfWeek={series.day_of_week as DayOfWeek}
              compact
            />
          </div>

          {/* Recurrence or showtime pills */}
          {recurrenceText ? (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span
                className="inline-flex items-center gap-1 font-mono text-[0.6rem] px-1.5 py-0.5 rounded font-medium"
                style={{
                  backgroundColor: `${typeColor}20`,
                  color: typeColor,
                }}
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {recurrenceText}
              </span>
              <span className="font-mono text-[0.6rem] px-1.5 py-0.5 rounded bg-[var(--twilight)]/40 text-[var(--soft)]">
                {totalShowtimes} showtimes
              </span>
            </div>
          ) : totalShowtimes > 1 ? (
            <div className="flex items-center gap-1.5 mt-2">
              <span className="font-mono text-[0.6rem] px-1.5 py-0.5 rounded bg-[var(--twilight)]/40 text-[var(--soft)]">
                {totalShowtimes} showtimes
              </span>
            </div>
          ) : null}
        </div>

      </div>
    </Link>
  );
});

export default SeriesCard;
