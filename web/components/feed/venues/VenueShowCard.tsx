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
      className="group block rounded-lg overflow-hidden bg-[var(--night)] border border-[var(--twilight)]/30 hover:border-[var(--twilight)]/50 transition-colors"
      style={{ borderTopColor: `color-mix(in srgb, ${accentColor} 40%, transparent)`, borderTopWidth: 2 }}
      aria-label={venue.name}
    >
      {/* Banner image or gradient fallback */}
      {venue.image_url ? (
        <div className="relative h-24 overflow-hidden bg-[var(--dusk)]">
          <SmartImage
            src={venue.image_url}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 50vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            fallback={
              <GradientBanner accentColor={accentColor} venueType={venueType} />
            }
          />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--night)] to-transparent" />
          <div className="absolute bottom-0 inset-x-0 px-3 pb-2">
            <p className="text-sm font-semibold text-white leading-tight truncate drop-shadow-sm">
              {venue.name}
            </p>
            {venue.neighborhood && (
              <p className="text-xs text-white/60 truncate">{venue.neighborhood}</p>
            )}
          </div>
        </div>
      ) : (
        <GradientBanner accentColor={accentColor} venueType={venueType}>
          <div className="absolute bottom-0 inset-x-0 px-3 pb-2">
            <p className="text-sm font-semibold text-[var(--cream)] leading-tight truncate">
              {venue.name}
            </p>
            {venue.neighborhood && (
              <p className="text-xs text-[var(--muted)] truncate">{venue.neighborhood}</p>
            )}
          </div>
        </GradientBanner>
      )}

      {/* Show rows with time chips */}
      <div className="px-3 pt-2 pb-2.5 space-y-1.5">
        {visibleShows.map((show) => (
          <div key={show.id} className="flex items-center justify-between gap-2">
            <p className="text-xs text-[var(--soft)] truncate leading-snug flex-1 min-w-0">
              {show.title}
            </p>
            {show.start_time && (
              <span
                className="flex-shrink-0 px-1.5 py-0.5 rounded text-2xs font-mono tabular-nums"
                style={{
                  backgroundColor: `color-mix(in srgb, ${accentColor} 10%, transparent)`,
                  color: `color-mix(in srgb, ${accentColor} 80%, white)`,
                }}
              >
                {formatTime(show.start_time)}
              </span>
            )}
          </div>
        ))}

        {overflowCount > 0 && (
          <p className="text-2xs font-mono" style={{ color: accentColor }}>
            +{overflowCount} more
          </p>
        )}
      </div>
    </Link>
  );
});

// ---------------------------------------------------------------------------
// Gradient banner fallback — used when no venue image
// ---------------------------------------------------------------------------

function GradientBanner({
  accentColor,
  venueType,
  children,
}: {
  accentColor: string;
  venueType: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="relative h-20 overflow-hidden"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 12%, var(--night)), color-mix(in srgb, ${accentColor} 5%, var(--dusk)))`,
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center opacity-15">
        <CategoryIcon type={venueType} size={36} glow="none" weight="thin" />
      </div>
      {children}
    </div>
  );
}

export type { VenueShowCardProps, VenueShow };
