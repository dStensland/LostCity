"use client";

import { memo } from "react";
import { MapPin, Repeat, PlayCircle } from "@phosphor-icons/react";
import Dot from "@/components/ui/Dot";
import { GenreChip } from "@/components/ActivityChip";
import { getSeriesTypeLabel, getSeriesTypeColor } from "@/lib/series-utils";
import { formatRecurrence } from "@/lib/detail/format";
import { buildSpotUrl } from "@/lib/entity-urls";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import type { SeriesData, VenueShowtime } from "@/lib/detail/types";

// ── Props ─────────────────────────────────────────────────────────────────────

interface SeriesIdentityProps {
  series: SeriesData;
  venueShowtimes: VenueShowtime[];
  portalSlug: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const SeriesIdentity = memo(function SeriesIdentity({
  series,
  venueShowtimes,
  portalSlug,
}: SeriesIdentityProps) {
  const isFilm = series.series_type === "film";
  const isRecurring = series.series_type === "recurring_show";

  const typeLabel = getSeriesTypeLabel(series.series_type);
  const typeColor = getSeriesTypeColor(series.series_type);
  const accentClass = createCssVarClass("--accent-color", typeColor, "series-accent");

  const recurrenceLabel = isRecurring
    ? formatRecurrence(series.frequency, series.day_of_week)
    : null;

  // Single-venue series: all showtimes at the same venue
  const singleVenue =
    venueShowtimes.length === 1 ? venueShowtimes[0].venue : null;

  const venueUrl = singleVenue
    ? buildSpotUrl(singleVenue.slug, portalSlug, "canonical")
    : null;

  return (
    <div className={`space-y-2 ${accentClass?.className ?? ""}`}>
      <ScopedStyles css={accentClass?.css} />

      {/* Type badge */}
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono font-semibold uppercase tracking-[0.14em] bg-accent-20 text-accent">
        {typeLabel}
      </span>

      {/* Title */}
      <h1 className="text-xl lg:text-2xl font-bold text-[var(--cream)] leading-tight">
        {series.title}
      </h1>

      {/* Recurrence label (recurring show) */}
      {recurrenceLabel && (
        <div className="flex items-center gap-2 text-sm text-[var(--soft)]">
          <Repeat
            size={14}
            weight="duotone"
            className="text-accent flex-shrink-0"
            aria-hidden="true"
          />
          <span>{recurrenceLabel}</span>
        </div>
      )}

      {/* Film metadata: year, rating, runtime */}
      {isFilm && (series.year || series.rating || series.runtime_minutes) && (
        <p className="text-sm flex items-center gap-1.5 flex-wrap text-[var(--soft)]">
          {series.year && (
            <span className="text-[var(--cream)]">{series.year}</span>
          )}
          {series.rating && (
            <>
              {series.year && <Dot />}
              <span className="px-1 py-0.5 border border-[var(--muted)] rounded text-xs">
                {series.rating}
              </span>
            </>
          )}
          {series.runtime_minutes && (
            <>
              <Dot />
              <span>
                {Math.floor(series.runtime_minutes / 60)}h{" "}
                {series.runtime_minutes % 60}m
              </span>
            </>
          )}
        </p>
      )}

      {/* Venue link (single-venue series only) */}
      {singleVenue && venueUrl && (
        <a
          href={venueUrl}
          className="flex items-center gap-1.5 text-sm text-[var(--soft)] hover:text-[var(--coral)] transition-colors focus-ring"
        >
          <MapPin
            size={14}
            weight="duotone"
            className="flex-shrink-0"
            aria-hidden="true"
          />
          <span>{singleVenue.name}</span>
          {singleVenue.neighborhood && (
            <span className="text-[var(--muted)]">
              · {singleVenue.neighborhood}
            </span>
          )}
        </a>
      )}

      {/* Director + Trailer (film only) */}
      {isFilm && (series.director || series.trailer_url) && (
        <div className="space-y-1.5">
          {series.director && (
            <p className="text-sm text-[var(--muted)]">
              Directed by{" "}
              <span className="text-[var(--soft)]">{series.director}</span>
            </p>
          )}
          {series.trailer_url && (
            <a
              href={series.trailer_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-[var(--coral)] hover:text-[var(--cream)] transition-colors focus-ring"
            >
              <PlayCircle size={16} weight="duotone" aria-hidden="true" />
              Watch Trailer
            </a>
          )}
        </div>
      )}

      {/* Genre pills */}
      {series.genres && series.genres.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {series.genres.slice(0, 5).map((genre) => (
            <GenreChip
              key={genre}
              genre={genre}
              category={isFilm ? "film" : null}
              portalSlug={portalSlug}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export type { SeriesIdentityProps };
