"use client";

/**
 * LiveTonightHeroTile — single hero tile in the "This Week · N Headliners" strip.
 *
 * Density-fix posture: landscape-only. The strip is a fixed-height band that
 * always renders 16/9-ish landscape tiles regardless of count (1-up = full
 * width, 2-up / 3-up = side-by-side narrower). No portrait variant.
 *
 * - Image fills with a bottom gradient mask for legibility.
 * - Earned chip in top-left: CURATOR PICK (gold), FESTIVAL (gold), SOLD OUT (coral).
 * - Headliner cream, "with {support}" soft, footer "Venue · 8:00 PM" in
 *   gold mono tabular-nums (the temporal accent across the entire widget).
 */

import SmartImage from "@/components/SmartImage";
import { formatArtistName } from "@/lib/music/format-artist-name";
import type { MusicShowPayload } from "@/lib/music/types";

export interface LiveTonightHeroTileProps {
  show: MusicShowPayload;
  portalSlug: string;
  onTap: (show: MusicShowPayload) => void;
}

interface ChipDescriptor {
  label: string;
  /** "gold" = solid gold pill, "coral" = solid coral pill. Sharp letterboard corners (rounded-none). */
  tone: "gold" | "coral";
}

function pickImage(show: MusicShowPayload): string | null {
  return show.image_url ?? show.venue.hero_image_url ?? show.venue.image_url ?? null;
}

function pickChip(show: MusicShowPayload): ChipDescriptor | null {
  if (show.ticket_status === "sold-out") return { label: "SOLD OUT", tone: "coral" };
  if (show.is_curator_pick) return { label: "CURATOR PICK", tone: "gold" };
  if (show.festival_id) return { label: "FESTIVAL", tone: "gold" };
  return null;
}

function headlinerName(show: MusicShowPayload): string {
  const headliner = show.artists.find((a) => a.is_headliner);
  return formatArtistName(headliner?.name ?? show.title);
}

function supportLine(show: MusicShowPayload): string | null {
  const supports = show.artists.filter((a) => !a.is_headliner).slice(0, 1);
  if (!supports.length) return null;
  return `with ${supports[0].name}`;
}

/** Format "20:00" → "8:00 PM". 24-hour input, 12-hour output WITH AM/PM (hero footer convention). */
function formatTimeWithPeriod(t: string | null): string {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  const hour12 = ((h + 11) % 12) + 1;
  const period = h >= 12 ? "PM" : "AM";
  if (m === 0) return `${hour12}:00 ${period}`;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function LiveTonightHeroTile({
  show,
  portalSlug: _portalSlug,
  onTap,
}: LiveTonightHeroTileProps) {
  const img = pickImage(show);
  const chip = pickChip(show);
  const headliner = headlinerName(show);
  const support = supportLine(show);
  const primaryGenre = show.genre_buckets[0];
  const venueTime = formatTimeWithPeriod(show.start_time ?? show.doors_time);

  return (
    <button
      type="button"
      onClick={() => onTap(show)}
      aria-label={`${headliner} at ${show.venue.name}`}
      className={[
        "group relative w-full h-full overflow-hidden",
        "aspect-[16/9]",
        "bg-[var(--night)] text-left",
        "transition-transform duration-200 ease-out active:scale-[0.985]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]",
      ].join(" ")}
    >
      {img ? (
        <>
          <SmartImage
            src={img}
            alt={headliner}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-[var(--night)] via-[var(--night)]/70 to-transparent" />
        </>
      ) : (
        <div className="absolute inset-0 bg-[var(--night)] border-l-[3px] border-l-[var(--vibe)]" />
      )}

      {chip && (
        <span
          className={[
            "absolute top-2 left-2",
            "font-mono text-2xs font-bold uppercase tracking-[0.12em]",
            "px-1.5 py-0.5 rounded-none",
            chip.tone === "coral"
              ? "bg-[var(--coral)] text-[var(--void)]"
              : "bg-[var(--gold)] text-[var(--void)]",
          ].join(" ")}
        >
          {chip.label}
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 p-3">
        {!img && primaryGenre && (
          <div className="font-mono text-2xs font-bold tracking-[0.12em] uppercase text-[var(--gold)] mb-0.5">
            {primaryGenre}
          </div>
        )}
        <div
          data-tile-headline
          className={[
            "text-base sm:text-lg",
            "font-semibold text-[var(--cream)] leading-tight drop-shadow-lg",
            "transition-transform duration-200 ease-out group-hover:-translate-y-0.5",
          ].join(" ")}
        >
          {headliner}
        </div>
        {support && (
          <div className="text-xs text-white/80 mt-0.5 drop-shadow truncate">{support}</div>
        )}
        <div className="font-mono text-xs text-[var(--gold)] tabular-nums mt-1 drop-shadow truncate">
          {show.venue.name}
          {venueTime ? ` · ${venueTime}` : ""}
        </div>
      </div>
    </button>
  );
}
