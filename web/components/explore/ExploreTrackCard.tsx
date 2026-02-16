"use client";

import Image from "@/components/SmartImage";
import type { ExploreTrack } from "@/lib/explore-tracks";
import { EXPLORE_THEME } from "@/lib/explore-tracks";

interface ExploreTrackCardProps {
  track: ExploreTrack;
  onSelect: () => void;
}

export default function ExploreTrackCard({
  track,
  onSelect,
}: ExploreTrackCardProps) {
  return (
    <button
      onClick={onSelect}
      className="relative w-full rounded-xl overflow-hidden text-left group focus:outline-none focus:ring-2 focus:ring-offset-2"
      style={{
        aspectRatio: "16/9",
      }}
      aria-label={`Track: ${track.name}, quote by ${track.quoteSource}, ${track.venueCount} venues`}
    >
      {/* Portrait background with parallax-ready container */}
      <div className="absolute inset-0">
        {track.quotePortraitUrl ? (
          <Image
            src={track.quotePortraitUrl}
            alt={track.quoteSource}
            fill
            sizes="(max-width: 768px) 100vw, 600px"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            style={{
              filter: "contrast(1.1) grayscale(0.15)",
            }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${EXPLORE_THEME.card} 0%, ${EXPLORE_THEME.bg} 100%)`,
            }}
          />
        )}
        {/* Dark gradient overlay for text readability */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.2) 100%)",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col justify-end p-4">
        {/* Quote */}
        <p
          className="text-lg sm:text-xl font-bold leading-tight tracking-tight line-clamp-2"
          style={{ color: EXPLORE_THEME.text }}
        >
          &ldquo;{track.quote}&rdquo;
        </p>

        {/* Attribution */}
        <p
          className="text-[0.65rem] mt-1.5 font-mono uppercase tracking-wider"
          style={{ color: EXPLORE_THEME.primary }}
        >
          {track.quoteSource}
        </p>

        {/* Track name + stats */}
        <div className="flex items-center justify-between mt-2">
          <span
            className="text-xs font-medium"
            style={{ color: EXPLORE_THEME.muted }}
          >
            {track.name}
          </span>
          <span
            className="text-[0.6rem] font-mono"
            style={{ color: EXPLORE_THEME.muted }}
          >
            {track.venueCount} places
          </span>
        </div>

        {/* Preview venues strip */}
        {track.previewVenues.length > 0 && (
          <div className="flex gap-1.5 mt-2">
            {track.previewVenues.slice(0, 3).map((venue) => (
              <div
                key={venue.id}
                className="flex-1 h-10 rounded-md overflow-hidden"
                style={{ background: EXPLORE_THEME.card }}
              >
                {venue.imageUrl ? (
                  <Image
                    src={venue.imageUrl}
                    alt={venue.name}
                    width={120}
                    height={40}
                    className="object-cover w-full h-full"
                    style={{
                      filter: "contrast(1.05) grayscale(0.1)",
                    }}
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ background: EXPLORE_THEME.card }}
                  >
                    <span
                      className="text-[0.5rem] font-mono truncate px-1"
                      style={{ color: EXPLORE_THEME.muted }}
                    >
                      {venue.name}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Neon border glow on hover */}
      <div
        className="absolute inset-0 rounded-xl border-2 border-transparent transition-colors duration-300 group-hover:border-current pointer-events-none"
        style={{ color: `${EXPLORE_THEME.primary}40` }}
      />
    </button>
  );
}
