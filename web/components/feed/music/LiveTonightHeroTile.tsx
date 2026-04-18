"use client";

import SmartImage from "@/components/SmartImage";
import type { MusicShowPayload } from "@/lib/music/types";

export type LiveTonightHeroTileSize = "xl" | "lg" | "md";

export interface LiveTonightHeroTileProps {
  show: MusicShowPayload;
  portalSlug: string;
  onTap: (show: MusicShowPayload) => void;
  sizeVariant?: LiveTonightHeroTileSize;
}

const HEADLINE_CLASSES: Record<LiveTonightHeroTileSize, string> = {
  xl: "text-3xl sm:text-4xl",
  lg: "text-2xl sm:text-3xl",
  md: "text-lg sm:text-2xl",
};

const GENRE_ACCENT: Record<string, string> = {
  Rock: "border-l-[var(--vibe)]",
  "Hip-Hop/R&B": "border-l-[var(--coral)]",
  Electronic: "border-l-[var(--neon-cyan)]",
  "Jazz/Blues": "border-l-[var(--gold)]",
};

function pickImage(show: MusicShowPayload): string | null {
  return show.image_url ?? show.venue.hero_image_url ?? show.venue.image_url ?? null;
}

function chipLabel(show: MusicShowPayload): string | null {
  if (show.is_curator_pick) return "CURATOR PICK";
  if (show.is_tentpole || show.importance === "flagship") return "FLAGSHIP";
  if (show.festival_id) return "FESTIVAL";
  if (show.importance === "major") return "MAJOR SHOW";
  return null;
}

function headlinerName(show: MusicShowPayload): string {
  const headliner = show.artists.find((a) => a.is_headliner);
  return headliner?.name ?? show.title;
}

function supportLine(show: MusicShowPayload): string | null {
  const supports = show.artists.filter((a) => !a.is_headliner).slice(0, 2);
  if (!supports.length) return null;
  return "w/ " + supports.map((s) => s.name).join(", ");
}

function metaLine(show: MusicShowPayload): string {
  const tonight =
    show.doors_time && show.start_time
      ? `DOORS ${show.doors_time} · SHOW ${show.start_time}`
      : show.start_time
      ? `SHOW ${show.start_time}`
      : show.doors_time
      ? `DOORS ${show.doors_time}`
      : "";
  return [show.venue.name, tonight].filter(Boolean).join(" · ");
}

export function LiveTonightHeroTile({
  show,
  portalSlug: _portalSlug,
  onTap,
  sizeVariant = "lg",
}: LiveTonightHeroTileProps) {
  const img = pickImage(show);
  const chip = chipLabel(show);
  const headliner = headlinerName(show);
  const support = supportLine(show);
  const headlineCls = HEADLINE_CLASSES[sizeVariant];
  const primaryGenre = show.genre_buckets[0];
  const accent = primaryGenre
    ? GENRE_ACCENT[primaryGenre] ?? "border-l-[var(--vibe)]"
    : "border-l-[var(--vibe)]";

  return (
    <button
      type="button"
      onClick={() => onTap(show)}
      className={[
        "group relative w-full h-full min-h-[200px] overflow-hidden",
        "bg-[var(--night)] text-left transition-transform active:scale-[0.98]",
      ].join(" ")}
    >
      {img ? (
        <>
          <SmartImage
            src={img}
            alt={headliner}
            fill
            sizes="(min-width: 768px) 33vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-[var(--night)] via-[var(--night)]/70 to-transparent" />
        </>
      ) : (
        <div className={["absolute inset-0 bg-[var(--night)] border-l-[3px]", accent].join(" ")} />
      )}

      {chip && (
        <span className="absolute top-3 left-3 bg-[var(--gold)] text-[var(--void)] text-2xs font-mono font-bold tracking-widest uppercase px-2 py-1">
          {chip}
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 p-4">
        {!img && primaryGenre && (
          <div className="font-mono text-xs font-bold tracking-[2px] uppercase text-[var(--gold)] mb-1">
            {primaryGenre}
          </div>
        )}
        <div
          data-tile-headline
          className={[
            headlineCls,
            "font-bold text-[var(--cream)] leading-tight drop-shadow-lg",
            "transition-transform duration-[240ms] ease-out group-hover:-translate-y-0.5",
          ].join(" ")}
        >
          {headliner}
        </div>
        {support && (
          <div className="text-xs italic text-white/80 mt-1 drop-shadow">{support}</div>
        )}
        <div className="font-mono text-xs text-white/80 mt-2 tracking-wider uppercase drop-shadow">
          {metaLine(show)}
        </div>
      </div>
    </button>
  );
}
