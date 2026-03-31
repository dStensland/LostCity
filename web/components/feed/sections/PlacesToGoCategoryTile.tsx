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
import { PlacesToGoCard } from "./PlacesToGoCard";
import type { PlacesToGoCategory } from "@/lib/places-to-go/types";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
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
  const IconComponent = CATEGORY_ICONS[category.key] ?? Compass;

  return (
    <div
      className={`rounded-lg border transition-all ${
        isExpanded ? "col-span-2 sm:col-span-3 lg:col-span-4" : ""
      }`}
      style={{
        backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)`,
        borderColor: `color-mix(in srgb, ${accent} 20%, transparent)`,
      }}
    >
      {/* Header — always visible, click to toggle */}
      <button
        type="button"
        className="w-full text-left p-3 cursor-pointer"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <IconComponent
                weight="duotone"
                className="w-4 h-4 flex-shrink-0"
                style={{ color: accent }}
              />
              <span className="text-sm font-semibold leading-tight" style={{ color: accent }}>
                {category.label}
              </span>
            </div>
            <p className="text-xs text-[var(--soft)] mt-0.5 line-clamp-2">
              {category.summary}
            </p>
          </div>
          <span
            className="text-xl font-bold tabular-nums flex-shrink-0"
            style={{ color: accent }}
          >
            {category.count}
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 space-y-2 animate-[fadeIn_150ms_ease-out]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {category.places.map((place) => (
              <PlacesToGoCard
                key={place.id}
                card={place}
                accentColor={accent}
              />
            ))}
          </div>
          <div className="pt-1">
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
