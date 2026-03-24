"use client";

import { memo } from "react";
import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import {
  isClosingSoon,
  formatDateRange,
  EXHIBITION_TYPE_LABELS,
  ADMISSION_TYPE_LABELS,
} from "@/lib/exhibitions-utils";
import type { ExhibitionWithVenue } from "@/lib/exhibitions-utils";

interface ExhibitionCardProps {
  exhibition: ExhibitionWithVenue;
  portalSlug: string;
}

/**
 * Exhibition card — Underground Gallery aesthetic.
 *
 * Design rules:
 * - Zero corner radius (rounded-none)
 * - Stroke-defined: border-[var(--twilight)], no fill
 * - Playfair Display italic for exhibition title
 * - IBM Plex Mono for all labels and metadata
 * - // {type} section header in copper (action-primary)
 * - Artist names in copper uppercase mono
 * - Closing-soon urgency: date in copper when ≤ 7 days out
 * - FREE in neon-green; other admission in muted
 * - Art provides the only color — UI is monochrome
 */
export const ExhibitionCard = memo(function ExhibitionCard({
  exhibition,
  portalSlug,
}: ExhibitionCardProps) {
  const closingSoon = isClosingSoon(exhibition, 7);
  const dateRange = formatDateRange(exhibition.opening_date, exhibition.closing_date);
  const typeLabel = exhibition.exhibition_type
    ? EXHIBITION_TYPE_LABELS[exhibition.exhibition_type]
    : null;

  const venueName = exhibition.venue?.name ?? null;
  const neighborhood = exhibition.venue?.neighborhood ?? null;

  const artists = exhibition.artists ?? [];
  const hasTags = exhibition.tags && exhibition.tags.length > 0;
  const hasImage = Boolean(exhibition.image_url);

  const cardHref = `/${portalSlug}/exhibitions/${exhibition.slug}`;

  return (
    <Link
      href={cardHref}
      className="group block border border-[var(--twilight)] bg-transparent hover:border-[var(--soft)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--action-primary)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--void)]"
      aria-label={`${exhibition.title}${artists.length > 0 ? " by " + artists.map((a) => a.artist_name).join(", ") : ""}`}
    >
      {/* Optional image — card works without it */}
      {hasImage && (
        <div className="relative w-full aspect-[16/7] overflow-hidden border-b border-[var(--twilight)]">
          <SmartImage
            src={exhibition.image_url!}
            alt={exhibition.title}
            fill
            sizes="(max-width: 640px) 100vw, 640px"
            className="object-cover brightness-90 group-hover:brightness-95 transition-[filter] duration-300"
          />
        </div>
      )}

      <div className="p-4 sm:p-5">
        {/* Section header: // exhibition · type */}
        <p className="font-[family-name:var(--font-ibm-plex-mono)] text-xs uppercase tracking-[0.14em] text-[var(--muted)] mb-2">
          {"// exhibition"}
          {typeLabel ? (
            <span className="text-[var(--action-primary)]">
              {" · "}
              {typeLabel.toLowerCase()}
            </span>
          ) : null}
        </p>

        {/* Title — Playfair Display italic */}
        <h3
          className="font-[family-name:var(--font-playfair-display)] italic text-lg text-[var(--cream)] leading-snug mb-1 group-hover:text-[var(--action-primary)] transition-colors"
        >
          {exhibition.title}
        </h3>

        {/* Artist names — copper uppercase mono */}
        {artists.length > 0 && (
          <p className="font-[family-name:var(--font-ibm-plex-mono)] text-sm uppercase tracking-wider text-[var(--action-primary)] mb-1">
            {artists.map((artist, i) => {
              const isLast = i === artists.length - 1;
              if (artist.artist_id) {
                return (
                  <span key={i}>
                    <span
                      className="hover:underline"
                      onClick={(e) => {
                        // Prevent card navigation when clicking an artist name link
                        e.stopPropagation();
                      }}
                    >
                      {artist.artist_name}
                    </span>
                    {!isLast && ", "}
                  </span>
                );
              }
              return (
                <span key={i}>
                  {artist.artist_name}
                  {!isLast && ", "}
                </span>
              );
            })}
          </p>
        )}

        {/* Venue + neighborhood */}
        {(venueName || neighborhood) && (
          <p className="font-[family-name:var(--font-ibm-plex-mono)] text-sm text-[var(--soft)] mb-1">
            {venueName}
            {neighborhood && (
              <span className="text-[var(--muted)]"> · {neighborhood}</span>
            )}
          </p>
        )}

        {/* Date range — closing-soon urgency in copper */}
        <p
          className={`font-[family-name:var(--font-ibm-plex-mono)] text-sm mb-3 ${
            closingSoon ? "text-[var(--action-primary)]" : "text-[var(--muted)]"
          }`}
        >
          {closingSoon && (
            <span className="mr-1">Closing soon —</span>
          )}
          {dateRange}
        </p>

        {/* Footer row: tags + admission */}
        {(hasTags || exhibition.admission_type) && (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Medium/tag pills */}
            {hasTags && (
              <div className="flex flex-wrap gap-1">
                {exhibition.tags!.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-0.5 border border-[var(--twilight)] font-[family-name:var(--font-ibm-plex-mono)] text-2xs uppercase tracking-wider text-[var(--muted)]"
                  >
                    {tag.replace(/_/g, " ")}
                  </span>
                ))}
                {exhibition.tags!.length > 4 && (
                  <span className="inline-flex items-center px-2 py-0.5 border border-[var(--twilight)] font-[family-name:var(--font-ibm-plex-mono)] text-2xs uppercase tracking-wider text-[var(--muted)]">
                    +{exhibition.tags!.length - 4}
                  </span>
                )}
              </div>
            )}
            {!hasTags && <div />}

            {/* Admission */}
            {exhibition.admission_type && (
              <span
                className={`font-[family-name:var(--font-ibm-plex-mono)] text-xs font-medium uppercase tracking-wider flex-shrink-0 ${
                  exhibition.admission_type === "free"
                    ? "text-[var(--neon-green)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {ADMISSION_TYPE_LABELS[exhibition.admission_type]}
              </span>
            )}
          </div>
        )}
      </div>

    </Link>
  );
});

export type { ExhibitionCardProps };
