"use client";

import Link from "next/link";
import Image from "@/components/SmartImage";
import type { ExploreTrack, ExploreTrackVenuePreview } from "@/lib/explore-tracks";
import { EXPLORE_THEME } from "@/lib/explore-tracks";

interface ExploreTrackSectionProps {
  track: ExploreTrack;
  portalSlug: string;
}

export default function ExploreTrackSection({
  track,
  portalSlug,
}: ExploreTrackSectionProps) {
  // Use the first preview venue image as the track's background
  const bgImage = track.previewVenues.find((v) => v.imageUrl)?.imageUrl;

  return (
    <section
      className="rounded-xl overflow-hidden"
      style={{
        background: EXPLORE_THEME.card,
        border: `1px solid ${EXPLORE_THEME.cardBorder}`,
      }}
    >
      {/* Track header — cinematic card with gradient overlay */}
      <div className="relative px-4 pt-4 pb-3 overflow-hidden">
        {/* Background image from first venue, heavily darkened */}
        {bgImage && (
          <div className="absolute inset-0">
            <Image
              src={bgImage}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 600px"
              className="object-cover"
              style={{
                filter: "blur(12px) brightness(0.25) saturate(0.6)",
                transform: "scale(1.15)",
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${EXPLORE_THEME.bg}CC 0%, transparent 60%)`,
              }}
            />
          </div>
        )}

        <div className="relative">
          {/* Track name — the headline */}
          <h3
            className="text-lg font-bold tracking-tight leading-tight"
            style={{ color: EXPLORE_THEME.text }}
          >
            {track.name}
          </h3>

          {/* Description — what this track actually is */}
          {track.description && (
            <p
              className="text-xs mt-1 leading-relaxed"
              style={{ color: EXPLORE_THEME.muted }}
            >
              {track.description}
            </p>
          )}

          {/* Venue count pill */}
          <div className="mt-2 flex items-center gap-2">
            <span
              className="text-[0.6rem] font-mono px-2 py-0.5 rounded-full"
              style={{
                color: EXPLORE_THEME.primary,
                background: `${EXPLORE_THEME.primary}15`,
                border: `1px solid ${EXPLORE_THEME.primary}30`,
              }}
            >
              {track.venueCount} places
            </span>
          </div>
        </div>
      </div>

      {/* Horizontal scroll of venue cards */}
      {track.previewVenues.length > 0 && (
        <div
          className="flex gap-2.5 overflow-x-auto px-3 pb-3 scrollbar-hide"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {track.previewVenues.map((venue) => (
            <VenueThumb
              key={venue.id}
              venue={venue}
              portalSlug={portalSlug}
            />
          ))}

          {/* "See all" card */}
          {track.venueCount > track.previewVenues.length && (
            <Link
              href={`/${portalSlug}?view=find&type=destinations&search=${encodeURIComponent(track.name)}`}
              className="flex-shrink-0 w-28 rounded-lg flex items-center justify-center transition-all hover:scale-[1.02]"
              style={{
                background: EXPLORE_THEME.bg,
                border: `1px dashed ${EXPLORE_THEME.primary}40`,
                minHeight: 140,
              }}
            >
              <div className="text-center px-2">
                <span
                  className="text-[0.65rem] font-mono block"
                  style={{ color: EXPLORE_THEME.primary }}
                >
                  +{track.venueCount - track.previewVenues.length} more
                </span>
                <svg
                  className="w-4 h-4 mx-auto mt-1"
                  fill="none"
                  stroke={EXPLORE_THEME.primary}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

function VenueThumb({
  venue,
  portalSlug,
}: {
  venue: ExploreTrackVenuePreview;
  portalSlug: string;
}) {
  // Use real slug from DB, fall back to generated slug
  const venueSlug = venue.slug || venue.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const hasEvents = venue.upcomingEventCount > 0;

  return (
    <Link
      href={`/${portalSlug}?spot=${venueSlug}`}
      className="flex-shrink-0 w-36 rounded-lg overflow-hidden group transition-all hover:scale-[1.02]"
      style={{
        background: EXPLORE_THEME.bg,
        border: `1px solid ${hasEvents ? `${EXPLORE_THEME.primary}40` : EXPLORE_THEME.cardBorder}`,
      }}
    >
      {/* Image with film grain aesthetic */}
      <div className="relative" style={{ aspectRatio: "3/2" }}>
        {venue.imageUrl ? (
          <Image
            src={venue.imageUrl}
            alt={venue.name}
            fill
            sizes="144px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            style={{ filter: "contrast(1.08) saturate(0.85)" }}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: EXPLORE_THEME.card }}
          >
            <span className="text-xl opacity-15">📍</span>
          </div>
        )}
        {/* Subtle bottom gradient for text readability */}
        <div
          className="absolute inset-x-0 bottom-0 h-8"
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)",
          }}
        />
        {/* Alive badge — upcoming events */}
        {hasEvents && (
          <div
            className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-[0.5rem] font-mono font-bold"
            style={{
              background: EXPLORE_THEME.primary,
              color: EXPLORE_THEME.bg,
            }}
          >
            {venue.upcomingEventCount} upcoming
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-2 py-1.5">
        <h4
          className="text-[0.7rem] font-semibold truncate leading-tight"
          style={{ color: EXPLORE_THEME.text }}
        >
          {venue.name}
        </h4>
        {venue.neighborhood && (
          <p
            className="text-[0.55rem] font-mono mt-0.5 truncate"
            style={{ color: EXPLORE_THEME.muted }}
          >
            {venue.neighborhood}
          </p>
        )}
      </div>
    </Link>
  );
}
