"use client";

import { memo } from "react";
import { MapPin } from "@phosphor-icons/react";

interface HangShareCardProps {
  hang: {
    venue: {
      name: string;
      slug: string | null;
      image_url: string | null;
      neighborhood: string | null;
    };
    note: string | null;
    started_at: string;
  };
  userName: string;
  avatarUrl: string | null;
  portalSlug: string;
  className?: string;
}

export const HangShareCard = memo(function HangShareCard({
  hang,
  userName,
  avatarUrl,
  className,
}: HangShareCardProps) {
  const { venue, note } = hang;

  return (
    <div
      className={[
        "relative aspect-[4/5] max-w-[320px] w-full rounded-2xl overflow-hidden shadow-2xl select-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Background: venue image or gradient fallback */}
      {venue.image_url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={venue.image_url}
          alt={venue.name}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--dusk)] to-[var(--void)]" />
      )}

      {/* Heavy gradient overlay from bottom — covers roughly bottom 60% */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />

      {/* Subtle top vignette for legibility if branding added at top */}
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/30 to-transparent" />

      {/* Content — pinned to bottom third */}
      <div className="absolute inset-x-0 bottom-0 px-5 pb-5 pt-12 flex flex-col gap-2">
        {/* User identity */}
        <div className="flex items-center gap-2">
          {avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={avatarUrl}
              alt={userName}
              className="w-8 h-8 rounded-full object-cover border border-white/20 flex-shrink-0"
              draggable={false}
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-white/20 border border-white/20 flex-shrink-0 flex items-center justify-center">
              <span className="text-white/80 text-xs font-mono font-bold">
                {userName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <span className="text-sm text-white/90 leading-tight">
            <span className="font-semibold">{userName}</span> is at
          </span>
        </div>

        {/* Venue name */}
        <div>
          <h2 className="text-xl font-bold text-white leading-tight">
            {venue.name}
          </h2>
          {venue.neighborhood && (
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin size={10} className="text-white/50 flex-shrink-0" weight="fill" />
              <span className="text-xs text-white/60">{venue.neighborhood}</span>
            </div>
          )}
        </div>

        {/* Note — only rendered when present */}
        {note && note.trim().length > 0 && (
          <p className="text-sm text-white/80 italic leading-snug">
            &ldquo;{note}&rdquo;
          </p>
        )}

        {/* LostCity branding */}
        <div className="flex items-center gap-1.5 mt-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon.svg"
            alt="Lost City"
            className="w-3.5 h-3.5 flex-shrink-0 opacity-60"
            draggable={false}
          />
          <span className="text-2xs text-white/40 font-mono tracking-wider">
            lostcity.ai
          </span>
        </div>
      </div>
    </div>
  );
});

export type { HangShareCardProps };
