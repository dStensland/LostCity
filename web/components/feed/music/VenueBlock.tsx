"use client";

/**
 * VenueBlock — Single-row playbill entry for the Live Tonight widget.
 *
 * Density-fix rebuild: this component now mirrors the cinema widget's
 * `PlaybillRow` (web/components/feed/sections/now-showing/PlaybillRow.tsx).
 * One row per venue. NO marquee header, NO indented show stack, NO kicker.
 *
 * Layout: [110px venue name] [shows + showtimes] [caret arrow]
 *   - Venue: shortVenueName() compressed, font-display uppercase tight tracking
 *   - Shows: headliner link + showtime in gold mono, separated by <Dot />
 *   - Overflow: "+N more" after a <Dot /> when shows beyond cap
 *   - Caret: small CaretRight Phosphor icon linking to venue detail
 *
 * The whole row links to the venue spot URL via the caret arrow column;
 * each show title is a Link to the venue spot URL too (no per-show page yet).
 */

import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react";
import Dot from "@/components/ui/Dot";
import { buildSpotUrl } from "@/lib/entity-urls";
import { formatArtistName } from "@/lib/music/format-artist-name";
import { shortVenueName } from "@/lib/music/short-venue-name";
import type { MusicShowPayload, MusicVenuePayload } from "@/lib/music/types";

const MAX_SHOWS = 3;

export interface VenueBlockProps {
  venue: MusicVenuePayload;
  shows: MusicShowPayload[];
  portalSlug: string;
  /** Override max shows shown before "+N more" overflow link. */
  maxVisibleShows?: number;
}

/** Format "20:00" → "8:00", "19:30" → "7:30". 24-hour input, 12-hour output, no AM/PM. */
function formatShowtime(t: string | null): string {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, "0")}`;
}

function headlinerName(show: MusicShowPayload): string {
  const headliner = show.artists.find((a) => a.is_headliner);
  return formatArtistName(headliner?.name ?? show.title);
}

export function VenueBlock({
  venue,
  shows,
  portalSlug,
  maxVisibleShows = MAX_SHOWS,
}: VenueBlockProps) {
  if (shows.length === 0) return null;

  const venueUrl = buildSpotUrl(venue.slug, portalSlug, "overlay");
  const visible = shows.slice(0, maxVisibleShows);
  const overflow = Math.max(shows.length - visible.length, 0);

  return (
    <div className="grid grid-cols-[110px_1fr_auto] items-center gap-3 px-2 py-1.5 rounded hover:bg-[var(--cream)]/[0.03] transition-colors">
      {/* Venue column */}
      <span className="font-display text-sm tracking-[0.16em] uppercase text-[var(--cream)] truncate">
        {shortVenueName(venue.name)}
      </span>

      {/* Shows column */}
      <div className="flex items-center gap-1.5 flex-wrap overflow-hidden">
        {visible.map((show, idx) => {
          const time = formatShowtime(show.start_time ?? show.doors_time);
          return (
            <span key={show.id} className="flex items-center gap-1.5">
              <Link
                href={venueUrl}
                prefetch={false}
                className="text-sm font-semibold text-[var(--cream)] hover:text-[var(--vibe)] transition-colors"
              >
                {headlinerName(show)}
              </Link>
              {time && (
                <span className="font-mono text-xs text-[var(--gold)] tabular-nums">
                  {time}
                </span>
              )}
              {idx < visible.length - 1 && <Dot />}
            </span>
          );
        })}
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
        href={venueUrl}
        prefetch={false}
        aria-label={`See all ${venue.name} shows`}
        className="p-1 text-[var(--vibe)] hover:text-[var(--cream)] transition-colors"
      >
        <CaretRight weight="bold" className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

export default VenueBlock;
