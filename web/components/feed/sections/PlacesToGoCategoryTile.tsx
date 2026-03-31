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

function getCategoryIcon(key: string): PhosphorIcon {
  return CATEGORY_ICONS[key] ?? Compass;
}

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
  const Icon = getCategoryIcon(category.key);

  return (
    <div
      className={`rounded-[10px] border transition-all ${
        isExpanded ? "col-span-2 sm:col-span-3 lg:col-span-4" : ""
      }`}
      style={{
        backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)`,
        borderColor: `color-mix(in srgb, ${accent} 19%, transparent)`,
      }}
    >
      {/* Header — always visible, click to toggle */}
      <button
        type="button"
        className="w-full text-left p-3.5 pb-3 cursor-pointer"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        {/* Icon + title + count — all on one line */}
        <div className="flex items-center gap-1.5">
          <Icon
            className="w-[18px] h-[18px] flex-shrink-0"
            style={{ color: accent }}
            weight="light"
          />
          <span
            className="flex-1 min-w-0 text-sm font-semibold leading-tight truncate"
            style={{ color: accent }}
          >
            {category.label}
          </span>
          <span
            className="font-mono text-xs font-semibold tabular-nums flex-shrink-0 leading-none"
            style={{ color: accent }}
          >
            {category.count}
          </span>
        </div>
        {/* Summary below */}
        <p className="text-xs text-[var(--soft)] mt-1.5 line-clamp-1">
          {category.summary}
        </p>
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
