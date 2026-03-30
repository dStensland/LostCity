"use client";

import { memo } from "react";
import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import CategoryIcon from "@/components/CategoryIcon";
import { formatTime } from "@/lib/formats";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VenueShow {
  id: number;
  title: string;
  start_time: string | null;
  is_free?: boolean;
  price_min?: number | null;
}

interface VenueShowCardProps {
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
    image_url: string | null;
  };
  shows: VenueShow[];
  totalCount: number;
  portalSlug: string;
  accentColor: string;
  venueType?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of show rows rendered before the "+N more" overflow label */
const MAX_VISIBLE_SHOWS = 2;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const VenueShowCard = memo(function VenueShowCard({
  venue,
  shows,
  totalCount,
  portalSlug,
  accentColor,
  venueType = "music_venue",
}: VenueShowCardProps) {
  const visibleShows = shows.slice(0, MAX_VISIBLE_SHOWS);
  const overflowCount = totalCount - MAX_VISIBLE_SHOWS;

  return (
    <Link
      href={`/${portalSlug}/spots/${venue.slug}`}
      prefetch={false}
      className="group block rounded-lg overflow-hidden bg-[var(--night)] border border-[var(--twilight)]/30 hover:bg-[var(--dusk)]/50 hover:border-[var(--twilight)]/50 transition-colors"
      aria-label={venue.name}
    >
      {/* Header: icon/image + venue name + neighborhood */}
      <div className="flex items-center gap-3 px-3 pt-3 pb-2.5">
        {/* 48px venue icon or image */}
        <div className="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--twilight)]/40">
          {venue.image_url ? (
            <SmartImage
              src={venue.image_url}
              alt=""
              fill
              sizes="48px"
              className="object-cover"
              fallback={
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 15%, var(--night))` }}
                >
                  <CategoryIcon
                    type={venueType}
                    size={20}
                    glow="none"
                    weight="bold"
                    className="opacity-70"
                  />
                </div>
              }
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 15%, var(--night))` }}
            >
              <CategoryIcon
                type={venueType}
                size={20}
                glow="none"
                weight="bold"
                className="opacity-70"
              />
            </div>
          )}
        </div>

        {/* Venue name + neighborhood */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--cream)] truncate leading-snug group-hover:text-white transition-colors">
            {venue.name}
          </p>
          {venue.neighborhood && (
            <p className="text-xs text-[var(--muted)] truncate leading-snug mt-0.5">
              {venue.neighborhood}
            </p>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[var(--twilight)]/30 mx-3" />

      {/* Show rows */}
      <div className="px-3 pt-2 pb-2.5 space-y-1.5">
        {visibleShows.map((show) => (
          <div key={show.id} className="flex items-center justify-between gap-2">
            <p className="text-xs text-[var(--soft)] truncate leading-snug flex-1 min-w-0">
              {show.title}
            </p>
            <span className="text-2xs text-[var(--muted)] font-mono flex-shrink-0">
              {formatTime(show.start_time)}
            </span>
          </div>
        ))}

        {/* Overflow label — only shown when totalCount exceeds visible rows */}
        {overflowCount > 0 && (
          <p
            className="text-2xs font-mono"
            style={{ color: accentColor }}
          >
            +{overflowCount} more today
          </p>
        )}
      </div>
    </Link>
  );
});

export type { VenueShowCardProps, VenueShow };
