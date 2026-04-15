"use client";

import SmartImage from "@/components/SmartImage";
import type { EventArtist } from "@/lib/artists-utils";
import {
  SpotifyLogo,
  InstagramLogo,
  Globe,
} from "@phosphor-icons/react";

interface RichArtistCardProps {
  artist: EventArtist;
  portalSlug: string;
}

/** First letter of display name, used as photo fallback */
function InitialFallback({ name, size }: { name: string; size: number }) {
  const letter = name.trim().charAt(0).toUpperCase();
  const textClass = size >= 48 ? "text-2xl" : "text-base";
  return (
    <div
      className={`w-full h-full flex items-center justify-center ${textClass} font-bold text-white/70 bg-[var(--dusk)] select-none`}
    >
      {letter}
    </div>
  );
}

export function RichArtistCard({ artist }: RichArtistCardProps) {
  const linked = artist.artist;
  const displayName = linked?.name || artist.name;
  const isHeadliner = artist.is_headliner || artist.billing_order === 1;
  const imageUrl = linked?.image_url ?? null;
  const hometown = linked?.hometown ?? null;
  const genres = linked?.genres?.slice(0, 3) ?? [];
  const spotifyId = linked?.spotify_id ?? null;
  const instagram = linked?.instagram ?? null;
  const website = linked?.website ?? null;

  const spotifyUrl = spotifyId
    ? spotifyId.startsWith("http")
      ? spotifyId
      : `https://open.spotify.com/artist/${spotifyId}`
    : null;

  const instagramUrl = instagram
    ? instagram.startsWith("http")
      ? instagram
      : `https://instagram.com/${instagram.replace(/^@/, "")}`
    : null;

  const hasSocialLinks = Boolean(spotifyUrl || instagramUrl || website);

  const photoSize = isHeadliner ? 48 : 36;
  const photoClass = isHeadliner
    ? "w-12 h-12 flex-shrink-0 rounded-full overflow-hidden bg-[var(--dusk)]"
    : "w-9 h-9 flex-shrink-0 rounded-full overflow-hidden bg-[var(--dusk)]";

  const containerPadding = isHeadliner ? "p-3" : "px-3 py-2";

  return (
    <div
      className={`flex items-start gap-3 rounded-card border border-[var(--twilight)] bg-[var(--night)] ${containerPadding}`}
    >
      {/* Circular photo */}
      <div className={photoClass}>
        {imageUrl ? (
          <SmartImage
            src={imageUrl}
            alt={displayName}
            width={photoSize}
            height={photoSize}
            className="object-cover w-full h-full"
            fallback={<InitialFallback name={displayName} size={photoSize} />}
          />
        ) : (
          <InitialFallback name={displayName} size={photoSize} />
        )}
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Row 1: name + role badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-[var(--cream)] leading-tight">
            {displayName}
          </span>
          {isHeadliner ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[8px] font-bold uppercase tracking-wide bg-[#FF6B7A33] text-[#FF6B7A]">
              Headliner
            </span>
          ) : (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[8px] font-bold uppercase tracking-wide bg-[var(--dusk)] text-[var(--muted)]">
              Support
            </span>
          )}
        </div>

        {/* Row 2: meta line — hometown · Genre, Genre, Genre */}
        {(hometown || genres.length > 0) && (
          <p className="text-[11px] text-[var(--muted)] leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
            {[
              hometown,
              genres.length > 0
                ? genres.map((g) => g.replace(/-/g, " ")).join(", ")
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}

        {/* Row 4: social links */}
        {hasSocialLinks && (
          <div className="flex items-center gap-2 pt-0.5">
            {spotifyUrl && (
              <a
                href={spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${displayName} on Spotify`}
                className="text-[#1DB954] hover:opacity-80 transition-opacity"
              >
                <SpotifyLogo size={16} weight="fill" />
              </a>
            )}
            {instagramUrl && (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${displayName} on Instagram`}
                className="text-[var(--soft)] hover:text-[var(--cream)] transition-colors"
              >
                <InstagramLogo size={16} weight="fill" />
              </a>
            )}
            {website && (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${displayName} website`}
                className="text-[var(--soft)] hover:text-[var(--cream)] transition-colors"
              >
                <Globe size={16} weight="fill" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export type { RichArtistCardProps };
