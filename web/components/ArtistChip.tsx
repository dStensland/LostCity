"use client";

import Link from "next/link";
import Image from "@/components/SmartImage";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import type { EventArtist } from "@/lib/artists";
import { getDisciplineColor } from "@/lib/artists";

interface ArtistChipProps {
  artist: EventArtist;
  portalSlug: string;
  variant?: "card" | "inline";
}

/** Discipline-based fallback icon SVG */
function DisciplineFallback({ discipline }: { discipline: string }) {
  // Simple music note fallback
  const paths: Record<string, string> = {
    musician: "M9 18V5l12-2v13",
    band: "M9 18V5l12-2v13",
    dj: "M12 3v18m-4-7h8",
    comedian: "M8 14s1.5 2 4 2 4-2 4-2",
  };

  return (
    <svg
      className="w-6 h-6 text-[var(--muted)]"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d={paths[discipline] || paths.musician}
      />
      {(discipline === "musician" || discipline === "band") && (
        <>
          <circle cx="6" cy="18" r="3" fill="none" stroke="currentColor" strokeWidth={1.5} />
          <circle cx="18" cy="16" r="3" fill="none" stroke="currentColor" strokeWidth={1.5} />
        </>
      )}
    </svg>
  );
}

export default function ArtistChip({ artist, portalSlug, variant = "card" }: ArtistChipProps) {
  const linkedArtist = artist.artist;
  const displayName = linkedArtist?.name || artist.name;
  const imageUrl = linkedArtist?.image_url || null;
  const discipline = linkedArtist?.discipline || "musician";
  const genres = linkedArtist?.genres || [];
  const slug = linkedArtist?.slug;
  const accentColor = getDisciplineColor(discipline);
  const accentClass = createCssVarClass("--accent-color", accentColor, "artist");

  const isHeadliner = artist.is_headliner || artist.billing_order === 1;

  if (variant === "inline") {
    const content = (
      <div className="flex items-center gap-3 py-1.5">
        <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden bg-[var(--twilight)] flex items-center justify-center">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={displayName}
              width={40}
              height={40}
              className="object-cover w-full h-full"
              unoptimized
            />
          ) : (
            <DisciplineFallback discipline={discipline} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-[var(--cream)] truncate block">
            {displayName}
          </span>
          {artist.role && (
            <span className="text-xs text-[var(--muted)] capitalize">{artist.role}</span>
          )}
        </div>
      </div>
    );

    if (slug) {
      return (
        <Link href={`/${portalSlug}/artists/${slug}`} className="hover:bg-[var(--card-bg-hover)] rounded-lg px-2 transition-colors">
          {content}
        </Link>
      );
    }

    return <div className="px-2">{content}</div>;
  }

  // Card variant
  const size = isHeadliner ? 120 : 80;
  const sizeClass = isHeadliner ? "w-[120px] h-[120px]" : "w-[80px] h-[80px]";

  const cardContent = (
    <div className={`flex flex-col items-center text-center gap-2 ${isHeadliner ? "min-w-[140px]" : "min-w-[100px]"}`}>
      {/* Circular image */}
      <div
        className={`${sizeClass} rounded-full overflow-hidden bg-[var(--twilight)] flex items-center justify-center flex-shrink-0 ${
          isHeadliner ? "ring-2 ring-accent/60 shadow-lg shadow-accent/20" : ""
        }`}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={displayName}
            width={size}
            height={size}
            className="object-cover w-full h-full"
            unoptimized
          />
        ) : (
          <DisciplineFallback discipline={discipline} />
        )}
      </div>

      {/* Name */}
      <span
        className={`font-medium text-[var(--cream)] line-clamp-2 leading-tight ${
          isHeadliner ? "text-sm" : "text-xs"
        }`}
      >
        {displayName}
      </span>

      {/* Genre chips */}
      {genres.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1">
          {genres.slice(0, 2).map((genre) => (
            <span
              key={genre}
              className="px-1.5 py-0.5 rounded-full text-[0.6rem] border border-[var(--twilight)] text-[var(--muted)] bg-[var(--void)]"
            >
              {genre}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  if (slug) {
    return (
      <>
        <ScopedStyles css={accentClass?.css} />
        <Link
          href={`/${portalSlug}/artists/${slug}`}
          className={`group transition-transform hover:scale-105 ${accentClass?.className ?? ""}`}
        >
          {cardContent}
        </Link>
      </>
    );
  }

  return <div>{cardContent}</div>;
}
