"use client";

import Link from "next/link";
import Image from "next/image";
import { getSeriesTypeLabel, getSeriesTypeColor } from "@/lib/series-utils";
import { formatTime } from "@/lib/formats";
import { formatRecurrence, type Frequency, type DayOfWeek } from "@/lib/recurrence";

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

export default function SeriesCard({
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

  // Recurrence pattern for recurring shows
  const recurrenceText = formatRecurrence(
    (series.frequency as Frequency) || null,
    (series.day_of_week as DayOfWeek) || null
  );
  const isRecurring = series.series_type === "recurring_show" && recurrenceText;

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
        {/* Time cell - matches EventCard */}
        <div className="flex-shrink-0 w-14 flex flex-col items-center justify-center py-1">
          <span className="font-mono text-[0.55rem] font-medium text-[var(--muted)] leading-none">
            {totalShowtimes} {totalShowtimes === 1 ? "time" : "times"}
          </span>
          {firstShowtime?.time && (
            <>
              <span className="font-mono text-sm font-medium text-[var(--soft)] leading-none tabular-nums mt-0.5">
                {formatTime(firstShowtime.time).split(" ")[0]}
              </span>
              <span className="font-mono text-[0.55rem] text-[var(--muted)] mt-0.5">
                {formatTime(firstShowtime.time).split(" ")[1]}
              </span>
            </>
          )}
        </div>

        {/* Thumbnail */}
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
            {series.series_type === "film" ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: typeColor }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: typeColor }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Top row: type badge + title */}
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
          </div>

          {/* Recurrence pattern for recurring shows, showtime pills for others */}
          {isRecurring ? (
            <div className="flex items-center gap-2 mt-2">
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
              {firstShowtime?.time && (
                <span className="font-mono text-[0.6rem] text-[var(--muted)]">
                  at {formatTime(firstShowtime.time)}
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(() => {
                // Deduplicate showtimes by formatted time to avoid showing "3:25pm 3:25pm"
                const seen = new Set<string>();
                const uniqueShowtimes: { id: number; time: string | null; formatted: string }[] = [];
                for (const vg of venueGroups.slice(0, 2)) {
                  for (const st of vg.showtimes) {
                    const formatted = formatTime(st.time);
                    if (!seen.has(formatted)) {
                      seen.add(formatted);
                      uniqueShowtimes.push({ ...st, formatted });
                    }
                    if (uniqueShowtimes.length >= 6) break;
                  }
                  if (uniqueShowtimes.length >= 6) break;
                }
                return uniqueShowtimes.map((st) => (
                  <span
                    key={st.id}
                    className="font-mono text-[0.6rem] px-1.5 py-0.5 rounded bg-[var(--twilight)]/40 text-[var(--soft)]"
                  >
                    {st.formatted}
                  </span>
                ));
              })()}
              {totalShowtimes > 6 && (
                <span className="font-mono text-[0.6rem] px-1.5 py-0.5 text-[var(--muted)]">
                  +{totalShowtimes - 6} more
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
