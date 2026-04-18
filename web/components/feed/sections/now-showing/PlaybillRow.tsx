"use client";

import Link from 'next/link';
import { CaretRight } from '@phosphor-icons/react';
import Dot from '@/components/ui/Dot';
import { formatTime } from '@/lib/formats';
import { buildSeriesUrl } from '@/lib/entity-urls';
import type { FilmScreening, FilmVenue } from '@/lib/film/types';

const MAX_FILMS = 4;

// Collapse venue name to a tight display token for the 110px column.
// Drop prefix words: "AMC ", "Regal ", "The ", etc.
function shortTheaterName(name: string): string {
  return name
    .replace(/^(AMC|Regal|Cinemark|The)\s+/i, '')
    .replace(/\s+(Theatre|Theater|Cinema|Cinemas|Drive-In|Drive In)$/i, '')
    .trim();
}

interface PlaybillRowProps {
  venue: FilmVenue;
  screenings: FilmScreening[];
  portalSlug: string;
}

export default function PlaybillRow({
  venue,
  screenings,
  portalSlug,
}: PlaybillRowProps) {
  const shown = screenings.slice(0, MAX_FILMS);
  const overflow = Math.max(screenings.length - MAX_FILMS, 0);
  const href = `/${portalSlug}/explore?lane=shows&tab=film&venue=${venue.slug}`;
  const isDriveIn = venue.programming_style === 'drive_in';

  return (
    <div className="grid grid-cols-[110px_1fr_auto] items-center gap-3 px-2 py-1.5 rounded hover:bg-[var(--cream)]/[0.03] transition-colors">
      {/* Theater column */}
      <span className="font-display text-sm tracking-[0.16em] uppercase text-[var(--cream)] truncate">
        {shortTheaterName(venue.name)}
      </span>

      {/* Films column */}
      <div className="flex items-center gap-1.5 flex-wrap overflow-hidden">
        {shown.map((s, idx) => (
          <span key={s.run_id} className="flex items-center gap-1.5">
            <Link
              href={buildSeriesUrl(s.slug, portalSlug, 'film')}
              prefetch={false}
              className="text-sm font-semibold text-[var(--cream)] hover:text-[var(--vibe)] transition-colors"
            >
              {s.title}
            </Link>
            {s.times[0]?.start_time && (
              <span className="font-mono text-xs text-[var(--vibe)] tabular-nums">
                {formatTime(s.times[0].start_time)}
              </span>
            )}
            {idx < shown.length - 1 && <Dot />}
          </span>
        ))}
        {isDriveIn && (
          <span className="text-xs italic text-[var(--gold)] ml-1">
            drive-in
          </span>
        )}
        {overflow > 0 && (
          <>
            <Dot />
            <span className="text-xs font-mono text-[var(--muted)]">
              +{overflow} more
            </span>
          </>
        )}
      </div>

      {/* Arrow column */}
      <Link
        href={href}
        prefetch={false}
        aria-label={`See all ${venue.name} screenings`}
        className="p-1 text-[var(--vibe)] hover:text-[var(--cream)] transition-colors"
      >
        <CaretRight weight="bold" className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
