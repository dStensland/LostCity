"use client";

import { memo } from "react";
import Link from "next/link";
import { ForkKnife, Coffee, Star } from "@phosphor-icons/react";
import Dot from "@/components/ui/Dot";
import type { DiscoveryPlaceEntity } from "@/lib/types/discovery";
import {
  formatRating,
  formatCloseTime,
  formatDistance,
} from "@/lib/utils/place-formatters";

const DINING_ACCENT = "#FF6B7A";
const ICON_BG = `${DINING_ACCENT}1A`; // 10% opacity

interface CompactDiningCardProps {
  entity: DiscoveryPlaceEntity;
  portalSlug: string;
}

function formatPriceLevel(level: number | null): string | null {
  if (level === null) return null;
  return "$".repeat(Math.min(level, 4));
}

export const CompactDiningCard = memo(function CompactDiningCard({
  entity,
  portalSlug,
}: CompactDiningCardProps) {
  const href = `/${portalSlug}?spot=${entity.slug}`;
  const isCoffee = entity.place_type === "coffee_shop";
  const rating = entity.google_rating != null ? formatRating(entity.google_rating) : null;
  const price = formatPriceLevel(entity.price_level);
  const distance = entity.distance_km != null ? formatDistance(entity.distance_km) : null;
  const closeTime = entity.closes_at ? formatCloseTime(entity.closes_at) : null;
  const cuisineLabel =
    entity.cuisine && entity.cuisine.length > 0
      ? entity.cuisine[0]
      : entity.place_type
          ? entity.place_type.charAt(0).toUpperCase() + entity.place_type.slice(1).replace(/_/g, " ")
          : "";

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
        {isCoffee ? (
          <Coffee size={18} color={DINING_ACCENT} weight="duotone" />
        ) : (
          <ForkKnife size={18} color={DINING_ACCENT} weight="duotone" />
        )}
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

        {/* Row 2: cuisine · price */}
        <div className="flex items-center gap-1 text-2xs text-[var(--muted)]">
          <span className="capitalize">{cuisineLabel}</span>
          {price && (
            <>
              <Dot />
              <span className="font-mono">{price}</span>
            </>
          )}
        </div>

        {/* Row 3: open badge + neighborhood + distance */}
        <div className="flex items-center gap-1.5 text-2xs mt-0.5">
          {entity.is_open ? (
            <span className="flex items-center gap-1 text-[#00D9A0]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00D9A0]" />
              <span>
                {closeTime ? `Open · Closes ${closeTime}` : "Open"}
              </span>
            </span>
          ) : (
            <span className="text-[var(--muted)]">Closed</span>
          )}
          {entity.neighborhood && (
            <>
              <Dot />
              <span className="text-[var(--muted)] truncate">
                {entity.neighborhood}
              </span>
            </>
          )}
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

export type { CompactDiningCardProps };
