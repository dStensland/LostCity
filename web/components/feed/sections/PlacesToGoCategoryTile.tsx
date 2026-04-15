"use client";

import { memo } from "react";
import Link from "next/link";
import {
  Tree,
  Mountains,
  Bank,
  PaintBrush,
  MaskHappy,
  MusicNotes,
  ForkKnife,
  Martini,
  Storefront,
  Books,
  GameController,
  Compass,
} from "@phosphor-icons/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { PlacesToGoCard } from "./PlacesToGoCard";
import type { PlacesToGoCategory } from "@/lib/places-to-go/types";

const CATEGORY_ICONS: Record<string, PhosphorIcon> = {
  parks_gardens: Tree,
  trails_nature: Mountains,
  museums: Bank,
  galleries_studios: PaintBrush,
  theaters_stage: MaskHappy,
  music_venues: MusicNotes,
  restaurants: ForkKnife,
  bars_nightlife: Martini,
  markets_local: Storefront,
  libraries_learning: Books,
  fun_games: GameController,
  historic_sites: Compass,
};

interface PlacesToGoCategoryTileProps {
  category: PlacesToGoCategory;
  isExpanded: boolean;
  onToggle: () => void;
}

export const PlacesToGoCategoryTile = memo(function PlacesToGoCategoryTile({
  category,
  isExpanded,
  onToggle,
}: PlacesToGoCategoryTileProps) {
  const accent = category.accent_color;
  const Icon: PhosphorIcon = CATEGORY_ICONS[category.key] ?? Compass;

  return (
    <div
      className={`rounded-card hover-lift border transition-all ${
        isExpanded ? "col-span-2 sm:col-span-3 lg:col-span-4" : ""
      }`}
      style={{
        background: `linear-gradient(160deg, color-mix(in srgb, ${accent} 14%, var(--night)) 0%, var(--night) 55%)`,
        borderColor: isExpanded
          ? `color-mix(in srgb, ${accent} 45%, transparent)`
          : `color-mix(in srgb, ${accent} 28%, transparent)`,
        boxShadow: `inset 0 1px 0 color-mix(in srgb, ${accent} 12%, transparent)`,
      }}
    >
      {/* Header — always visible, click to toggle */}
      <button
        type="button"
        className="w-full text-left p-3.5 cursor-pointer"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        {/* Two-column layout: left (icon + title + summary), right (big count) */}
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Icon
                className="w-5 h-5 flex-shrink-0"
                style={{ color: accent }}
                weight="duotone"
              />
              <span
                className="flex-1 min-w-0 text-sm font-semibold leading-tight truncate"
                style={{ color: accent }}
              >
                {category.label}
              </span>
            </div>
            {/* Summary below icon+title */}
            <p className="text-xs text-[var(--muted)] mt-1 line-clamp-1 hidden sm:block">
              {category.summary}
            </p>
          </div>
          {/* Big count on the right */}
          <span
            className="text-3xl font-bold tabular-nums flex-shrink-0 min-w-[2ch] text-right leading-none"
            style={{ color: accent }}
          >
            {category.count}
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3.5 pb-3.5 pt-0 flex flex-col gap-2.5 animate-[fadeIn_150ms_ease-out]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {category.places.map((place) => (
              <PlacesToGoCard
                key={place.id}
                card={place}
                accentColor={accent}
              />
            ))}
          </div>
          <div>
            <Link
              href={category.see_all_href}
              className="text-xs font-mono transition-opacity hover:opacity-80"
              style={{ color: accent }}
            >
              See all {category.count} {category.label.toLowerCase()} →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
});

export type { PlacesToGoCategoryTileProps };
