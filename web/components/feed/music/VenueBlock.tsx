"use client";

/**
 * VenueBlock — Letterboard playbill row for the Live Tonight widget.
 *
 * Per spec (`docs/design-specs/live-tonight-widget-{desktop,mobile}.md`):
 * - Marquee header: VENUE NAME in mono uppercase + optional editorial kicker
 * - Indented show entries (headliner cream, "+ support" soft, gold mono showtime)
 * - Hairline top border (var(--twilight)) — letterboard rule between blocks
 * - Whole block is a single <a> link to the venue detail (NO caret arrows)
 * - "+N more" link nested when more than 2 shows
 *
 * Pure presentational. Time formatting handled here so loaders stay payload-agnostic.
 */

import { buildSpotUrl } from "@/lib/entity-urls";
import type { KickerTone } from "@/lib/music/derive-kicker";
import { formatArtistName } from "@/lib/music/format-artist-name";
import type { MusicShowPayload, MusicVenuePayload } from "@/lib/music/types";

const KICKER_COLOR: Record<KickerTone, string> = {
  vibe: "text-[var(--vibe)]",
  gold: "text-[var(--gold)]",
  coral: "text-[var(--coral)]",
  muted: "text-[var(--muted)]",
};

export interface VenueBlockKicker {
  label: string;
  tone: KickerTone;
}

export interface VenueBlockProps {
  venue: MusicVenuePayload;
  shows: MusicShowPayload[];
  portalSlug: string;
  kicker?: VenueBlockKicker | null;
  /** Maximum show entries rendered before showing the "+N more" link. */
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
  kicker = null,
  maxVisibleShows = 2,
}: VenueBlockProps) {
  if (shows.length === 0) return null;

  const venueUrl = buildSpotUrl(venue.slug, portalSlug, "feed");
  const visible = shows.slice(0, maxVisibleShows);
  const overflow = shows.length - visible.length;

  return (
    <a
      href={venueUrl}
      aria-label={`${venue.name} — ${shows.length} show${shows.length === 1 ? "" : "s"} tonight`}
      className={[
        "block border-t border-[var(--twilight)]/40",
        "px-1 pt-3.5 pb-3",
        "transition-colors duration-150 ease-out",
        "hover:bg-[var(--cream)]/[0.03]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--gold)]",
      ].join(" ")}
    >
      {/* Marquee: venue name + optional kicker */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="font-mono text-base sm:text-lg font-bold uppercase tracking-[1.5px] sm:tracking-[1.8px] text-[var(--cream)]">
          {venue.name}
        </span>
        {kicker && (
          <span
            className={[
              "font-mono text-xs uppercase tracking-[0.12em] font-bold text-right shrink-0",
              KICKER_COLOR[kicker.tone],
            ].join(" ")}
          >
            {kicker.label}
          </span>
        )}
      </div>

      {/* Indented show rows */}
      <div className="pl-[18px] flex flex-col gap-1">
        {visible.map((show, idx) => {
          const isPrimary = idx === 0;
          const name = headlinerName(show);
          return (
            <div key={show.id} className="flex items-center justify-between gap-3">
              <span
                className={
                  isPrimary
                    ? "text-sm font-semibold text-[var(--cream)]"
                    : "text-sm text-[var(--soft)]"
                }
              >
                {isPrimary ? name : `+ ${name}`}
              </span>
              <span className="font-mono text-xs text-[var(--gold)] tabular-nums shrink-0">
                {formatShowtime(show.start_time ?? show.doors_time)}
              </span>
            </div>
          );
        })}

        {overflow > 0 && (
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--soft)] mt-0.5">
            +{overflow} more →
          </span>
        )}
      </div>
    </a>
  );
}

export default VenueBlock;
