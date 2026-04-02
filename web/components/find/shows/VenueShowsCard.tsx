"use client";

import { memo } from "react";
import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import Dot from "@/components/ui/Dot";
import { ShowRow, type BaseShow } from "@/components/find/shows/ShowRow";

export interface VenueShowsCardVenue {
  id: number;
  name: string;
  slug: string;
  neighborhood: string | null;
  image_url: string | null;
}

export interface VenueShowsCardProps {
  venue: VenueShowsCardVenue;
  shows: BaseShow[];
  showCount: number;
  portalSlug: string;
  /** CSS color string used for accent tinting the fallback icon box, e.g. "var(--neon-magenta)" */
  accentColor: string;
  /** Rendered when venue has no image */
  fallbackIcon: React.ReactNode;
  /** Passed through to each ShowRow for vertical-specific metadata */
  renderMeta?: (show: BaseShow) => React.ReactNode;
}

export const VenueShowsCard = memo(function VenueShowsCard({
  venue,
  shows,
  showCount,
  portalSlug,
  accentColor,
  fallbackIcon,
  renderMeta,
}: VenueShowsCardProps) {
  const venueHref = `/${portalSlug}/places/${venue.slug}`;
  const countLabel = `${showCount} ${showCount === 1 ? "show" : "shows"} tonight`;

  const fallbackBg = `color-mix(in srgb, ${accentColor} 15%, transparent)`;

  return (
    <div className="rounded-card bg-[var(--night)] border border-[var(--twilight)]/40 overflow-hidden">
      {/* Venue header */}
      <div className="flex items-center gap-3 p-3">
        {/* Venue image */}
        <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden relative">
          {venue.image_url ? (
            <SmartImage
              src={venue.image_url}
              alt={venue.name}
              fill
              className="object-cover"
              sizes="64px"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: fallbackBg }}
              aria-hidden="true"
            >
              {fallbackIcon}
            </div>
          )}
        </div>

        {/* Venue name + meta */}
        <div className="flex-1 min-w-0">
          <Link
            href={venueHref}
            className="group/venue block"
          >
            <span className="text-sm font-semibold text-[var(--cream)] group-hover/venue:text-[var(--coral)] transition-colors leading-snug line-clamp-1">
              {venue.name}
            </span>
          </Link>
          <div className="flex items-center gap-1.5 mt-0.5">
            {venue.neighborhood && (
              <>
                <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-[0.06em]">
                  {venue.neighborhood}
                </span>
                <Dot className="text-[var(--muted)]/40 flex-shrink-0" />
              </>
            )}
            <span className="font-mono text-xs text-[var(--muted)]">
              {countLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Show rows */}
      <div className="divide-y divide-[var(--twilight)]/30 border-t border-[var(--twilight)]/30">
        {shows.map((show) => (
          <ShowRow
            key={show.event_id}
            show={show}
            portalSlug={portalSlug}
            renderMeta={renderMeta}
          />
        ))}
      </div>
    </div>
  );
});
