"use client";

import { memo } from "react";
import Link from "next/link";

interface BrowseGridTileProps {
  category: string;
  label: string;
  count: number;
  accentColor: string;
  snippet?: { title: string; venue_name: string } | null;
  badge?: "pulse" | "new" | "closing" | null;
  href: string;
}

export const BrowseGridTile = memo(function BrowseGridTile({
  label,
  count,
  accentColor,
  snippet,
  badge,
  href,
}: BrowseGridTileProps) {
  return (
    <Link
      href={href}
      className="relative flex flex-col gap-1 p-3 rounded-lg border transition-all hover:scale-[1.02] active:scale-[0.98]"
      style={{
        backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
        borderColor: `color-mix(in srgb, ${accentColor} 20%, transparent)`,
      }}
    >
      {/* Corner badge */}
      {badge === "pulse" && (
        <span
          aria-label="Live activity"
          className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--neon-green)] animate-pulse"
        />
      )}
      {badge === "new" && (
        <span className="absolute top-2 right-2 font-mono text-2xs font-bold uppercase tracking-wider text-[var(--gold)]">
          NEW
        </span>
      )}
      {badge === "closing" && (
        <span className="absolute top-2 right-2 font-mono text-2xs font-bold uppercase tracking-wider text-[var(--neon-red)]">
          CLOSING
        </span>
      )}

      {/* Category name */}
      <span className="text-sm font-semibold text-[var(--cream)] leading-tight pr-6">
        {label}
      </span>

      {/* Live count */}
      <span
        className="text-xl font-bold tabular-nums leading-none"
        style={{ color: accentColor }}
      >
        {count}
      </span>

      {/* Count label */}
      <span className="text-2xs text-[var(--muted)]">this week</span>

      {/* Content snippet — desktop only */}
      {snippet && (snippet.title || snippet.venue_name) && (
        <p className="hidden sm:block text-2xs text-[var(--soft)] line-clamp-2 mt-0.5">
          {snippet.title}
          {snippet.venue_name ? ` · ${snippet.venue_name}` : ""}
        </p>
      )}
    </Link>
  );
});

export type { BrowseGridTileProps };
