"use client";

import { memo } from "react";
import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import { formatTime } from "@/lib/formats";
import { getSubgenreLabels } from "@/lib/genre-map";

interface TonightShowCardProps {
  show: {
    id: number;
    title: string;
    start_time: string | null;
    doors_time: string | null;
    image_url: string | null;
    is_free: boolean;
    tags: string[] | null;
    genres: string[] | null;
  };
  venue: {
    name: string;
    slug: string;
    neighborhood: string | null;
    image_url: string | null;
  };
  portalSlug: string;
  accentColor: string;
}

export const TonightShowCard = memo(function TonightShowCard({
  show,
  venue,
  portalSlug,
  accentColor,
}: TonightShowCardProps) {
  const timeLabel = formatTime(show.start_time);
  const doorsLabel = show.doors_time
    ? `Doors ${formatTime(show.doors_time)}`
    : null;
  // Prefer genres column (dedicated genre data), fall back to tags
  const genreSource = show.genres?.length ? show.genres : show.tags;
  const subgenres = getSubgenreLabels(genreSource).slice(0, 3);

  return (
    <Link
      href={`/${portalSlug}/spots/${venue.slug}`}
      prefetch={false}
      className="group flex-shrink-0 w-[260px] snap-start rounded-card overflow-hidden bg-[var(--night)] border border-[var(--twilight)]/40 hover:border-[var(--twilight)]/60 transition-colors"
    >
      {/* Image area with gradient overlay */}
      <div className="relative h-[100px] overflow-hidden bg-[var(--dusk)]">
        {venue.image_url || show.image_url ? (
          <SmartImage
            src={(show.image_url || venue.image_url)!}
            alt=""
            fill
            sizes="260px"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            fallback={<GradientFallback accentColor={accentColor} />}
          />
        ) : (
          <GradientFallback accentColor={accentColor} />
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--night)] via-[var(--night)]/60 to-transparent" />

        {/* Top-right badge */}
        {show.is_free ? (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-2xs font-mono font-bold bg-[var(--neon-green)]/20 text-[var(--neon-green)]">
            FREE
          </span>
        ) : doorsLabel ? (
          <span
            className="absolute top-2 right-2 px-2 py-0.5 rounded text-2xs font-mono"
            style={{
              backgroundColor: `color-mix(in srgb, ${accentColor} 20%, transparent)`,
              color: accentColor,
            }}
          >
            {doorsLabel}
          </span>
        ) : null}

        {/* Show title overlaid on image */}
        <div className="absolute bottom-2 left-2.5 right-2.5">
          <p className="text-base font-semibold text-white truncate leading-snug">
            {show.title}
          </p>
        </div>
      </div>

      {/* Content below image */}
      <div className="px-2.5 py-2">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="min-w-0">
            <p className="text-xs text-[var(--soft)] truncate">{venue.name}</p>
            {venue.neighborhood && (
              <p className="text-2xs text-[var(--muted)] truncate">
                {venue.neighborhood}
              </p>
            )}
          </div>
          {timeLabel !== "TBA" && (
            <span
              className="flex-shrink-0 text-xs font-mono"
              style={{ color: accentColor }}
            >
              {timeLabel}
            </span>
          )}
        </div>

        {/* Subgenre chips */}
        {subgenres.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {subgenres.map((label) => (
              <span
                key={label}
                className="px-1.5 py-0.5 rounded text-2xs text-[var(--muted)] bg-[var(--twilight)]/60"
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
});

function GradientFallback({ accentColor }: { accentColor: string }) {
  return (
    <div
      className="absolute inset-0"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 15%, var(--night)), color-mix(in srgb, ${accentColor} 5%, var(--dusk)))`,
      }}
    />
  );
}

export type { TonightShowCardProps };
