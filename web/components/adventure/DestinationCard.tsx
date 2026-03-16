"use client";

import { memo } from "react";
import Link from "next/link";
import Image from "@/components/SmartImage";
import { Check } from "@phosphor-icons/react";
import { ADV } from "@/lib/adventure-tokens";

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: ADV.OLIVE,
  moderate: ADV.TERRACOTTA,
  hard: ADV.DARK,
};

// ---- Types ---------------------------------------------------------------

export interface DestinationCardProps {
  name: string;
  slug: string;
  imageUrl: string | null;
  commitmentTier: string;
  difficultyLevel: string;
  driveTimeMinutes: number;
  summary: string;
  weatherFitTags?: string[];
  portalSlug: string;
  visited?: boolean;
  onMarkVisited?: (slug: string) => void;
}

const COMMITMENT_LABELS: Record<string, string> = {
  hour: "1 HR",
  halfday: "HALF DAY",
  fullday: "FULL DAY",
  weekend: "WEEKEND",
};

const WEATHER_TAG_LABELS: Record<string, string> = {
  "after-rain": "After Rain",
  "cool-weather": "Cool Weather",
  "leaf-season": "Leaf Season",
  "clear-day": "Clear Day",
  "summer-friendly": "Summer",
  "sunrise-friendly": "Sunrise",
  "heat-exposed": "Heat Exposed",
  "dry-weather": "Dry Weather",
  "all-season": "All Season",
};

// ---- Component -----------------------------------------------------------

export const DestinationCard = memo(function DestinationCard({
  name,
  slug,
  imageUrl,
  commitmentTier,
  difficultyLevel,
  driveTimeMinutes,
  summary,
  weatherFitTags = [],
  portalSlug,
  visited = false,
  onMarkVisited,
}: DestinationCardProps) {
  const commitmentLabel = COMMITMENT_LABELS[commitmentTier] ?? commitmentTier.toUpperCase();
  const visibleTags = weatherFitTags
    .map((tag) => WEATHER_TAG_LABELS[tag] ?? tag)
    .filter(Boolean)
    .slice(0, 3);

  return (
    <div
      className="relative overflow-hidden"
      style={{ border: `2px solid ${ADV.DARK}`, borderRadius: 0, backgroundColor: ADV.CARD }}
    >
      {/* Hero image */}
      <Link href={`/${portalSlug}/spots/${slug}`} className="block relative h-40 overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ backgroundColor: `${ADV.STONE}18` }}
          />
        )}

        {/* Commitment badge — top left */}
        <div className="absolute top-0 left-0">
          <span
            className="block px-2.5 py-1 text-xs font-bold text-white"
            style={{
              letterSpacing: "0.1em",
              backgroundColor: ADV.TERRACOTTA,
              borderRadius: 0,
            }}
          >
            {commitmentLabel}
          </span>
        </div>

        {/* Difficulty badge — top right */}
        <div className="absolute top-0 right-0">
          <span
            className="block px-2.5 py-1 text-xs font-bold text-white uppercase"
            style={{
              letterSpacing: "0.1em",
              backgroundColor: DIFFICULTY_COLORS[difficultyLevel] ?? ADV.STONE,
              borderRadius: 0,
            }}
          >
            {difficultyLevel}
          </span>
        </div>

        {/* Visited overlay */}
        {visited && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: `${ADV.OLIVE}CC` }}
          >
            <Check size={32} weight="bold" color="#FFFFFF" />
          </div>
        )}
      </Link>

      {/* Card body */}
      <div className="p-4">
        {/* Metadata row */}
        <div
          className="flex items-center gap-3 mb-2 text-xs font-bold uppercase"
          style={{
            letterSpacing: "0.1em",
            color: ADV.STONE,
          }}
        >
          <span>{driveTimeMinutes} MIN DRIVE</span>
        </div>

        {/* Name */}
        <Link
          href={`/${portalSlug}/spots/${slug}`}
          className="block mb-2 font-bold leading-tight hover:underline line-clamp-2"
          style={{
            fontSize: "1.0625rem",
            color: ADV.DARK,
          }}
        >
          {name}
        </Link>

        {/* Summary — 2-line clamp */}
        <p
          className="text-sm leading-relaxed mb-3"
          style={{
            color: ADV.STONE,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {summary}
        </p>

        {/* Weather fit tags */}
        {visibleTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs font-bold uppercase"
                style={{
                  letterSpacing: "0.08em",
                  backgroundColor: "transparent",
                  color: ADV.STONE,
                  border: `1px solid #D1CCC5`,
                  borderRadius: 0,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Mark visited action */}
        {onMarkVisited && (
          <button
            type="button"
            onClick={() => onMarkVisited(slug)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase transition-colors"
            style={{
              letterSpacing: "0.1em",
              border: `2px solid ${ADV.DARK}`,
              borderRadius: 0,
              backgroundColor: visited ? ADV.OLIVE : "transparent",
              color: visited ? "#FFFFFF" : ADV.STONE,
            }}
          >
            <Check size={12} weight="bold" />
            {visited ? "Visited" : "Mark Visited"}
          </button>
        )}
      </div>
    </div>
  );
});
