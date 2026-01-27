"use client";

import Link from "next/link";
import Image from "next/image";
import { getSeriesTypeLabel, getSeriesTypeColor } from "@/lib/series-utils";
import { formatTime } from "@/lib/formats";

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
          {/* Poster thumbnail */}
          {series.image_url ? (
            <Image
              src={series.image_url}
              alt={series.title}
              width={48}
              height={72}
              className="rounded-md object-cover flex-shrink-0"
              style={{ width: 48, height: 72 }}
            />
          ) : (
            <div
              className="w-12 h-[72px] rounded-md flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${typeColor}20` }}
            >
              {series.series_type === "film" ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: typeColor }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: typeColor }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
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
            </div>
            <Link
              href={seriesUrl}
              scroll={false}
              className="font-medium text-[var(--cream)] hover:text-[var(--coral)] transition-colors line-clamp-2 block"
            >
              {series.title}
            </Link>
          </div>

          {/* Showtime count badge */}
          <span className="font-mono text-[0.6rem] text-[var(--muted)] bg-[var(--twilight)]/50 px-1.5 py-0.5 rounded flex-shrink-0 whitespace-nowrap">
            {totalShowtimes} {totalShowtimes === 1 ? "showtime" : "showtimes"}
          </span>
        </div>

        {/* Venue + Showtimes list */}
        <div className="mt-3 space-y-2">
          {venueGroups.map((vg) => (
            <div key={vg.venue.id} className="flex items-baseline gap-2">
              <Link
                href={portalSlug ? `/${portalSlug}?spot=${vg.venue.slug}` : `/spots/${vg.venue.slug}`}
                scroll={false}
                className="text-sm text-[var(--soft)] hover:text-[var(--cream)] transition-colors flex-shrink-0"
              >
                {vg.venue.name}:
              </Link>
              <div className="flex flex-wrap gap-1.5">
                {vg.showtimes.map((st) => (
                  <Link
                    key={st.id}
                    href={portalSlug ? `/${portalSlug}?event=${st.id}` : `/events/${st.id}`}
                    scroll={false}
                    className="font-mono text-xs px-1.5 py-0.5 rounded bg-[var(--twilight)]/40 text-[var(--muted)] hover:bg-[var(--twilight)] hover:text-[var(--cream)] transition-colors"
                  >
                    {formatTime(st.time)}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer link */}
      <Link
        href={seriesUrl}
        scroll={false}
        className="flex items-center justify-end gap-1 px-3 py-2 border-t border-[var(--twilight)]/30 text-xs text-[var(--muted)] hover:text-[var(--coral)] hover:bg-[var(--twilight)]/20 transition-colors"
      >
        All Showtimes
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
