"use client";

import { memo } from "react";
import { Globe, BookOpen, Phone, InstagramLogo } from "@phosphor-icons/react";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import { formatPriceLevel, type SpotType, SPOT_TYPES } from "@/lib/spots-constants";
import { QuickActionLink } from "@/components/detail/QuickActionLink";
import DirectionsDropdown from "@/components/DirectionsDropdown";
import Dot from "@/components/ui/Dot";
import type { PlaceGoogleDetails, PlaceDiningDetails } from "@/lib/types/places";
import type { PlaceProfile } from "@/lib/types/places";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSpotTypeLabel(spotTypes: unknown): string {
  const types = Array.isArray(spotTypes) ? (spotTypes as string[]) : [];
  if (types.length === 0) return "Place";
  const first = types[0] as SpotType;
  return SPOT_TYPES[first]?.label ?? first.replace(/_/g, " ");
}

function getPrimaryType(spotTypes: unknown, spotType: unknown): string {
  const types = Array.isArray(spotTypes) ? (spotTypes as string[]) : [];
  if (types.length > 0) return types[0];
  return typeof spotType === "string" ? spotType : "other";
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface PlaceIdentityProps {
  spot: Record<string, unknown>;
  diningData?: PlaceDiningDetails | null;
  googleData?: PlaceGoogleDetails | null;
  placeProfile?: PlaceProfile | null;
  portalSlug: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const PlaceIdentity = memo(function PlaceIdentity({
  spot,
  diningData,
  googleData,
}: PlaceIdentityProps) {
  const primaryType = getPrimaryType(spot.spot_types, spot.spot_type);
  const typeLabel = getSpotTypeLabel(spot.spot_types);
  const priceDisplay = formatPriceLevel(
    typeof spot.price_level === "number" ? spot.price_level : null
  );
  const badgeColor = getCategoryColor(primaryType);
  const badgeClass = createCssVarClass("--accent-color", badgeColor, "accent");

  return (
    <div className="space-y-2">
      {/* Type badge */}
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs border bg-accent-15 border-accent-40 ${
          badgeClass?.className ?? ""
        }`}
      >
        <ScopedStyles css={badgeClass?.css} />
        <CategoryIcon type={primaryType} size={12} glow="subtle" />
        <span className="font-mono font-medium uppercase tracking-widest text-accent">
          {typeLabel}
        </span>
      </span>

      {/* Name */}
      <h1 className="text-2xl font-bold text-[var(--cream)] leading-tight">
        {typeof spot.name === "string" ? spot.name : ""}
      </h1>

      {/* Neighborhood + Price level + Rating */}
      <p className="text-sm text-[var(--soft)] flex items-center gap-1.5 flex-wrap">
        {typeof spot.neighborhood === "string"
          ? spot.neighborhood
          : typeof spot.city === "string"
            ? spot.city
            : null}
        {priceDisplay && (
          <>
            <Dot />
            <span className="text-[var(--muted)]">{priceDisplay}</span>
          </>
        )}
      </p>

      {/* Google rating */}
      {googleData?.rating && (
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-[var(--gold)]">
            ★ {googleData.rating}
          </span>
          {googleData.rating_count && (
            <span className="text-xs text-[var(--muted)]">
              ({googleData.rating_count.toLocaleString()})
            </span>
          )}
        </span>
      )}

      {/* Quick actions grid */}
      <div className="grid grid-cols-4 gap-1 pt-1">
        {diningData?.reservation_url ? (
          <a
            href={diningData.reservation_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center gap-1 py-2 min-h-[44px] bg-[var(--coral)] text-[var(--void)] hover:brightness-110 rounded-lg text-xs font-mono font-medium transition-all focus-ring"
          >
            <BookOpen size={16} weight="light" aria-hidden="true" />
            Reserve
          </a>
        ) : typeof spot.website === "string" && spot.website ? (
          <QuickActionLink
            href={spot.website}
            icon={<Globe size={16} weight="light" aria-hidden="true" />}
            label="Website"
            compact
          />
        ) : null}

        {diningData?.menu_url && (
          <QuickActionLink
            href={diningData.menu_url}
            icon={<BookOpen size={16} weight="light" aria-hidden="true" />}
            label="Menu"
            compact
          />
        )}

        {typeof spot.instagram === "string" && spot.instagram && (
          <QuickActionLink
            href={`https://instagram.com/${(spot.instagram as string).replace("@", "")}`}
            icon={<InstagramLogo size={16} weight="light" aria-hidden="true" />}
            label="Instagram"
            compact
          />
        )}

        {typeof spot.phone === "string" && spot.phone && (
          <QuickActionLink
            href={`tel:${spot.phone}`}
            icon={<Phone size={16} weight="light" aria-hidden="true" />}
            label="Call"
            external={false}
            compact
          />
        )}

        {typeof spot.address === "string" && spot.address && (
          <DirectionsDropdown
            venueName={typeof spot.name === "string" ? spot.name : ""}
            address={spot.address}
            city={typeof spot.city === "string" ? spot.city : ""}
            state={typeof spot.state === "string" ? spot.state : ""}
            compact
          />
        )}
      </div>
    </div>
  );
});

export type { PlaceIdentityProps };
