"use client";

import { memo } from "react";
import Link from "next/link";
import { getZineIcon } from "./PlacesToGoIcons";
import { PlacesToGoCard } from "./PlacesToGoCard";
import type { PlacesToGoCategory } from "@/lib/places-to-go/types";

// Alternate rotation directions based on a stable hash of the category key.
// This gives a "hand-placed" feel without layout-breaking transforms on the tile itself.
function keyRotationIndex(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % 3; // 0, 1, or 2
}

const ICON_ROW_ROTATIONS = ["-1.5deg", "1deg", "-0.8deg"] as const;
const COUNT_ROTATIONS = ["1.2deg", "-0.9deg", "0.7deg"] as const;

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
  const ZineIcon = getZineIcon(category.key);
  const rotIndex = keyRotationIndex(category.key);
  const iconRowRotate = ICON_ROW_ROTATIONS[rotIndex];
  const countRotate = COUNT_ROTATIONS[rotIndex];

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
            {/* Icon + title row — slightly rotated, hand-placed feel */}
            <div
              className="flex items-center gap-1.5"
              style={{ transform: `rotate(${iconRowRotate})`, transformOrigin: "left center" }}
            >
              <ZineIcon
                className="w-5 h-5 flex-shrink-0"
                style={{ color: accent }}
              />
              <span
                className="text-xs font-bold uppercase tracking-wider leading-tight"
                style={{ color: accent }}
              >
                {category.label}
              </span>
            </div>
            {/* Summary — italic, like a handwritten annotation */}
            <p className="text-xs text-[var(--soft)] mt-0.5 line-clamp-2 italic">
              {category.summary}
            </p>
          </div>
          {/* Count — bigger, bolder, slightly counter-rotated from the title */}
          <span
            className="text-2xl font-bold tabular-nums flex-shrink-0 leading-none"
            style={{
              color: accent,
              transform: `rotate(${countRotate})`,
              transformOrigin: "center center",
              display: "inline-block",
            }}
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
