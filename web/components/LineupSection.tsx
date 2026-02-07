"use client";

import { useState } from "react";
import ArtistChip from "@/components/ArtistChip";
import type { EventArtist } from "@/lib/artists";

interface LineupSectionProps {
  artists: EventArtist[];
  portalSlug: string;
  maxDisplay?: number;
  title?: string;
}

export default function LineupSection({
  artists,
  portalSlug,
  maxDisplay = 20,
  title = "Lineup",
}: LineupSectionProps) {
  const [expanded, setExpanded] = useState(false);

  if (artists.length === 0) return null;

  const headliners = artists.filter(
    (a) => a.is_headliner || a.billing_order === 1
  );
  const support = artists.filter(
    (a) => !a.is_headliner && a.billing_order !== 1
  );

  const displaySupport = expanded ? support : support.slice(0, maxDisplay - headliners.length);
  const hasMore = !expanded && support.length > displaySupport.length;

  return (
    <section>
      <h2 className="text-lg font-semibold text-[var(--cream)] mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        {title}
        <span className="text-sm font-normal text-[var(--muted)]">
          ({artists.length})
        </span>
      </h2>

      {/* Headliners - larger, prominent display */}
      {headliners.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 justify-items-center mb-6">
          {headliners.map((artist) => (
            <ArtistChip
              key={artist.id}
              artist={artist}
              portalSlug={portalSlug}
              variant="card"
            />
          ))}
        </div>
      )}

      {/* Supporting artists - compact grid */}
      {displaySupport.length > 0 && (
        <>
          {headliners.length > 0 && (
            <div className="border-t border-[var(--twilight)] my-4" />
          )}
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4 justify-items-center">
            {displaySupport.map((artist) => (
              <ArtistChip
                key={artist.id}
                artist={artist}
                portalSlug={portalSlug}
                variant="card"
              />
            ))}
          </div>
        </>
      )}

      {/* Expand/collapse */}
      {hasMore && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-4 w-full py-2.5 text-sm font-medium text-accent hover:text-[var(--cream)] border border-[var(--twilight)] rounded-lg hover:bg-[var(--card-bg-hover)] transition-colors"
        >
          See all {artists.length} artists
        </button>
      )}
    </section>
  );
}
