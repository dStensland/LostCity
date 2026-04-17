"use client";

import { memo } from "react";
import CategoryIcon from "@/components/CategoryIcon";
import { getCategoryColor } from "@/lib/category-config";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import { formatPriceLevel, type SpotType, SPOT_TYPES } from "@/lib/spots-constants";
import Dot from "@/components/ui/Dot";
import type { PlaceGoogleDetails, PlaceDiningDetails } from "@/lib/types/places";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSpotTypeLabel(spotTypes: unknown, spotType: unknown): string {
  const types = Array.isArray(spotTypes) ? (spotTypes as string[]) : [];
  const typeStr =
    types.length > 0
      ? types[0]
      : typeof spotType === "string"
        ? spotType
        : null;
  if (!typeStr) return "Place";
  return (
    SPOT_TYPES[typeStr as SpotType]?.label ??
    typeStr.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function getPrimaryType(spotTypes: unknown, spotType: unknown): string {
  const types = Array.isArray(spotTypes) ? (spotTypes as string[]) : [];
  if (types.length > 0) return types[0];
  return typeof spotType === "string" ? spotType : "other";
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PlaceIdentityV2Props {
  spot: Record<string, unknown>;
  diningData?: PlaceDiningDetails | null;
  googleData?: PlaceGoogleDetails | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PlaceIdentityV2 = memo(function PlaceIdentityV2({
  spot,
  diningData,
  googleData,
}: PlaceIdentityV2Props) {
  const primaryType = getPrimaryType(spot.spot_types, spot.spot_type);
  const typeLabel = getSpotTypeLabel(spot.spot_types, spot.spot_type);
  const priceDisplay = formatPriceLevel(
    typeof spot.price_level === "number" ? spot.price_level : null,
  );

  const accentColor = getCategoryColor(primaryType);
  const accentClass = createCssVarClass("--accent-color", accentColor, "accent");

  // Cuisine sub-type from dining data
  const cuisineLabel =
    diningData?.cuisine && diningData.cuisine.length > 0
      ? diningData.cuisine[0]
      : null;

  // Rating
  const rating = googleData?.rating ?? null;
  const ratingCount = googleData?.rating_count ?? null;

  // Neighborhood / city fallback
  const locationLabel =
    typeof spot.neighborhood === "string" && spot.neighborhood
      ? spot.neighborhood
      : typeof spot.city === "string"
        ? spot.city
        : null;

  return (
    <div className="px-4 pt-4 pb-3 lg:px-8 lg:pt-6 lg:pb-4 space-y-2">
      {/* Type badge row */}
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs border bg-accent-15 border-accent-40 ${
          accentClass?.className ?? ""
        }`}
      >
        <ScopedStyles css={accentClass?.css} />
        <CategoryIcon type={primaryType} size={12} glow="subtle" />
        <span className="font-mono font-medium uppercase tracking-widest text-accent">
          {typeLabel}
        </span>
      </span>

      {/* Name */}
      <h1 className="text-2xl lg:text-3xl font-bold text-[var(--cream)] leading-tight">
        {typeof spot.name === "string" ? spot.name : ""}
      </h1>

      {/* Meta row: neighborhood · cuisine · price level */}
      <p className="text-sm text-[var(--soft)] flex items-center gap-1.5 flex-wrap">
        {locationLabel}
        {cuisineLabel && (
          <>
            <Dot />
            <span>{cuisineLabel}</span>
          </>
        )}
        {priceDisplay && (
          <>
            <Dot />
            <span className="text-[var(--muted)]">{priceDisplay}</span>
          </>
        )}
      </p>

      {/* Rating row */}
      {rating != null && (
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-[var(--gold)]">
            ★ {rating}
          </span>
          {ratingCount != null && (
            <span className="text-xs text-[var(--muted)]">
              ({ratingCount.toLocaleString()})
            </span>
          )}
        </span>
      )}
    </div>
  );
});

export type { PlaceIdentityV2Props };
