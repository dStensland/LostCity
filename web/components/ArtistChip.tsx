"use client";

import Link from "next/link";
import Image from "@/components/SmartImage";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import type { EventArtist } from "@/lib/artists-utils";
import { getDisciplineColor, getParticipantWebsiteFallback } from "@/lib/artists-utils";

interface ArtistChipProps {
  artist: EventArtist;
  portalSlug: string;
  eventCategory?: string | null;
  variant?: "card" | "inline";
  fallbackImageUrl?: string | null;
  fallbackGenres?: string[] | null;
  emphasizeHeadliner?: boolean;
}

function formatRoleLabel(role: string | null | undefined, isHeadliner: boolean): string | null {
  if (isHeadliner) return "Headliner";
  if (!role) return null;

  const normalized = role.toLowerCase().trim();
  if (!normalized) return null;

  if (normalized.includes("support")) return "Support";
  if (normalized.includes("opener") || normalized.includes("opening")) return "Opener";

  return role
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Get initials from a display name (up to 2 chars) */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/** Deterministic hue offset from name for visual variety */
function nameToHueShift(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 40 - 20; // -20 to +20 degree shift
}

/** Initials on a discipline-colored gradient background */
function InitialsFallback({ name, discipline, size = "sm" }: { name: string; discipline: string; size?: "sm" | "lg" }) {
  const initials = getInitials(name);
  const hueShift = nameToHueShift(name);
  const textSize = size === "lg" ? "text-2xl" : "text-sm";

  const gradients: Record<string, [string, string]> = {
    musician: ["#b8256e", "#d94a8e"],
    band: ["#b8256e", "#d94a8e"],
    dj: ["#1a8a8a", "#2cbcbc"],
    comedian: ["#c28a1e", "#e0a832"],
    author: ["#8b6914", "#b8941e"],
    speaker: ["#8b6914", "#b8941e"],
    visual_artist: ["#7b4fb8", "#9b6fd8"],
    actor: ["#b8445a", "#d8647a"],
    filmmaker: ["#1a8a8a", "#2cbcbc"],
  };

  const [from, to] = gradients[discipline] || ["#6b5a7a", "#8b7a9a"];

  return (
    <div
      className={`w-full h-full flex items-center justify-center ${textSize} font-bold text-white/90 select-none`}
      style={{
        background: `linear-gradient(135deg, ${from}, ${to})`,
        filter: `hue-rotate(${hueShift}deg)`,
      }}
    >
      {initials}
    </div>
  );
}

export default function ArtistChip({
  artist,
  portalSlug,
  eventCategory = null,
  variant = "card",
  fallbackImageUrl = null,
  fallbackGenres = null,
  emphasizeHeadliner = true,
}: ArtistChipProps) {
  const linkedArtist = artist.artist;
  const displayName = linkedArtist?.name || artist.name;
  const imageUrl = linkedArtist?.image_url || fallbackImageUrl || null;
  const discipline = linkedArtist?.discipline || "musician";
  const genres = (linkedArtist?.genres && linkedArtist.genres.length > 0)
    ? linkedArtist.genres
    : (fallbackGenres || []);
  const hometown = linkedArtist?.hometown || null;
  const slug = linkedArtist?.slug;
  const websiteUrl = linkedArtist?.website || getParticipantWebsiteFallback(displayName, eventCategory);
  const accentColor = getDisciplineColor(discipline);
  const accentClass = createCssVarClass("--accent-color", accentColor, "artist");

  const isHeadliner = emphasizeHeadliner && (artist.is_headliner || artist.billing_order === 1);
  const roleLabel = formatRoleLabel(artist.role, isHeadliner);

  const profileHref = slug ? `/${portalSlug}/artists/${slug}` : null;
  const externalHref = !profileHref && websiteUrl ? websiteUrl : null;

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
            <InitialsFallback name={displayName} discipline={discipline} size="sm" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-[var(--cream)] truncate block">
            {displayName}
          </span>
          {roleLabel && (
            <span className="text-xs text-[var(--muted)] uppercase tracking-wide font-mono">
              {roleLabel}
            </span>
          )}
        </div>
      </div>
    );

    if (profileHref) {
      return (
        <Link href={profileHref} className="hover:bg-[var(--card-bg-hover)] rounded-lg px-2 transition-colors">
          {content}
        </Link>
      );
    }

    if (externalHref) {
      return (
        <a
          href={externalHref}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:bg-[var(--card-bg-hover)] rounded-lg px-2 transition-colors"
        >
          {content}
        </a>
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
          <InitialsFallback name={displayName} discipline={discipline} size={isHeadliner ? "lg" : "sm"} />
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

      {(roleLabel || hometown) && (
        <div className="text-[0.58rem] uppercase tracking-widest text-[var(--muted)] font-mono leading-tight">
          {roleLabel}
          {roleLabel && hometown ? " · " : ""}
          {hometown}
        </div>
      )}

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

      {externalHref && (
        <span className="text-[0.58rem] uppercase tracking-wide text-[var(--coral)]/85 font-mono">
          Official Site
        </span>
      )}
    </div>
  );

  if (profileHref) {
    return (
      <>
        <ScopedStyles css={accentClass?.css} />
        <Link
          href={profileHref}
          className={`group transition-transform hover:scale-105 ${accentClass?.className ?? ""}`}
        >
          {cardContent}
        </Link>
      </>
    );
  }

  if (externalHref) {
    return (
      <>
        <ScopedStyles css={accentClass?.css} />
        <a
          href={externalHref}
          target="_blank"
          rel="noopener noreferrer"
          className={`group transition-transform hover:scale-105 ${accentClass?.className ?? ""}`}
        >
          {cardContent}
        </a>
      </>
    );
  }

  return <div>{cardContent}</div>;
}
