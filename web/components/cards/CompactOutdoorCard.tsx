"use client";

import { memo } from "react";
import Link from "next/link";
import { Tree, Star } from "@phosphor-icons/react";
import Dot from "@/components/ui/Dot";
import type { DiscoveryPlaceEntity } from "@/lib/types/discovery";

const OUTDOOR_ACCENT = "#00D9A0";
const ICON_BG = `${OUTDOOR_ACCENT}1A`; // 10% opacity

const COMMITMENT_LABELS: Record<string, string> = {
  hour: "~1 hr",
  halfday: "Half day",
  fullday: "Full day",
  weekend: "Weekend",
};

const SEASON_LABELS: Record<string, string> = {
  spring: "Spring",
  summer: "Summer",
  fall: "Fall",
  winter: "Winter",
  year_round: "Year-round",
};

interface CompactOutdoorCardProps {
  entity: DiscoveryPlaceEntity;
  portalSlug: string;
}

function formatRating(rating: number | null): string | null {
  if (rating === null) return null;
  return rating.toFixed(1);
}

function formatDistance(km: number | null): string | null {
  if (km === null) return null;
  const miles = km * 0.621371;
  if (miles < 0.1) return "nearby";
  return `${miles.toFixed(1)}mi`;
}

export const CompactOutdoorCard = memo(function CompactOutdoorCard({
  entity,
  portalSlug,
}: CompactOutdoorCardProps) {
  const href = `/${portalSlug}?spot=${entity.slug}`;
  const rating = formatRating(entity.google_rating);
  const distance = formatDistance(entity.distance_km);
  const commitmentLabel = entity.commitment_tier
    ? COMMITMENT_LABELS[entity.commitment_tier] ?? entity.commitment_tier
    : null;
  const primarySeason =
    entity.best_seasons && entity.best_seasons.length > 0
      ? SEASON_LABELS[entity.best_seasons[0]] ?? entity.best_seasons[0]
      : null;
  const typeLabel = entity.place_type.replace(/_/g, " ");

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-card border border-[var(--twilight)] bg-[var(--night)] p-3 hover:bg-[var(--dusk)] transition-colors"
    >
      {/* Icon box */}
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: ICON_BG }}
      >
        <Tree size={18} color={OUTDOOR_ACCENT} weight="duotone" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Row 1: name + rating */}
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-[var(--cream)]">
            {entity.name}
          </span>
          {rating && (
            <span className="flex items-center gap-0.5 flex-shrink-0">
              <Star size={10} color="#FFD93D" weight="fill" />
              <span className="font-mono text-2xs text-[var(--muted)]">
                {rating}
              </span>
            </span>
          )}
        </div>

        {/* Row 2: commitment tier + season badges */}
        {(commitmentLabel || primarySeason) && (
          <div className="flex items-center gap-1 mt-0.5">
            {commitmentLabel && (
              <span
                className="inline-flex items-center rounded px-1.5 py-0.5 font-mono text-2xs"
                style={{
                  backgroundColor: `${OUTDOOR_ACCENT}20`,
                  color: OUTDOOR_ACCENT,
                }}
              >
                {commitmentLabel}
              </span>
            )}
            {primarySeason && (
              <span
                className="inline-flex items-center rounded px-1.5 py-0.5 font-mono text-2xs"
                style={{
                  backgroundColor: "rgba(255, 217, 61, 0.15)",
                  color: "#FFD93D",
                }}
              >
                {primarySeason}
              </span>
            )}
          </div>
        )}

        {/* Row 3: type + distance */}
        <div className="flex items-center gap-1.5 text-2xs mt-0.5">
          <span className="capitalize text-[var(--muted)]">{typeLabel}</span>
          {distance && (
            <>
              <Dot />
              <span className="font-mono text-[var(--muted)]">{distance}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
});

export type { CompactOutdoorCardProps };
