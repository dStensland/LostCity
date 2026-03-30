"use client";

import { memo } from "react";
import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import CategoryIcon from "@/components/CategoryIcon";
import { formatTime, formatSmartDate } from "@/lib/formats";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VenueShow {
  id: number;
  title: string;
  start_date?: string;
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

const MAX_VISIBLE_SHOWS = 3;

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
      className="group flex rounded-lg overflow-hidden bg-[var(--night)] border border-[var(--twilight)]/30 hover:border-[var(--twilight)]/50 transition-colors"
      style={{ borderLeftColor: `color-mix(in srgb, ${accentColor} 50%, transparent)`, borderLeftWidth: 2 }}
      aria-label={venue.name}
    >
      {/* Square image or icon fallback — left rail */}
      <div className="relative w-20 sm:w-24 flex-shrink-0 overflow-hidden bg-[var(--dusk)]">
        {venue.image_url ? (
          <SmartImage
            src={venue.image_url}
            alt=""
            fill
            sizes="96px"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            fallback={<IconFallback accentColor={accentColor} venueType={venueType} />}
          />
        ) : (
          <IconFallback accentColor={accentColor} venueType={venueType} />
        )}
      </div>

      {/* Content — right side */}
      <div className="flex-1 min-w-0 px-3 py-2.5">
        {/* Venue name + neighborhood */}
        <p className="text-sm font-semibold text-[var(--cream)] truncate leading-snug group-hover:text-white transition-colors">
          {venue.name}
        </p>
        {venue.neighborhood && (
          <p className="text-2xs text-[var(--muted)] truncate mb-1.5">{venue.neighborhood}</p>
        )}

        {/* Show rows with time/date chips */}
        <div className="space-y-1">
          {visibleShows.map((show) => {
            const dateInfo = show.start_date ? formatSmartDate(show.start_date) : null;
            const isToday = dateInfo?.label === "Today";
            const timeLabel = show.start_time ? formatTime(show.start_time) : null;
            const chipLabel = isToday || !dateInfo
              ? timeLabel
              : timeLabel
                ? `${dateInfo.label} ${timeLabel}`
                : dateInfo.label;

            return (
            <div key={show.id} className="flex items-center justify-between gap-1.5">
              <p className="text-xs text-[var(--soft)] truncate leading-snug flex-1 min-w-0">
                {show.title}
              </p>
              {chipLabel && (
                <span
                  className="flex-shrink-0 px-1.5 py-0.5 rounded text-2xs font-mono tabular-nums whitespace-nowrap"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${accentColor} 10%, transparent)`,
                    color: `color-mix(in srgb, ${accentColor} 80%, white)`,
                  }}
                >
                  {chipLabel}
                </span>
              )}
            </div>
            );
          })}

          {overflowCount > 0 && (
            <p className="text-2xs font-mono" style={{ color: accentColor }}>
              +{overflowCount} more
            </p>
          )}
        </div>
      </div>
    </Link>
  );
});

// ---------------------------------------------------------------------------
// Icon fallback — tinted background with category icon
// ---------------------------------------------------------------------------

function IconFallback({ accentColor, venueType }: { accentColor: string; venueType: string }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 15%, var(--night)), color-mix(in srgb, ${accentColor} 6%, var(--dusk)))`,
      }}
    >
      <CategoryIcon type={venueType} size={28} glow="none" weight="thin" className="opacity-30" />
    </div>
  );
}

export type { VenueShowCardProps, VenueShow };
