"use client";

/**
 * SpecialCard — displays a venue special with state badge, time info,
 * and quick actions. Follows the existing card system (dark theme,
 * accent colors, Phosphor icons).
 */

import Link from "next/link";
import { memo } from "react";
import { Tag, Clock, Lightning } from "@phosphor-icons/react";
import CategoryIcon from "./CategoryIcon";
import type { CityPulseSpecialItem } from "@/lib/city-pulse/types";

interface SpecialCardProps {
  special: CityPulseSpecialItem["special"];
  portalSlug: string;
}

function SpecialCardComponent({ special, portalSlug }: SpecialCardProps) {
  const isActive = special.state === "active_now";
  const badgeColor = isActive ? "var(--neon-green)" : "var(--neon-amber)";
  const badgeLabel = isActive
    ? "Active now"
    : special.starts_in_minutes
      ? `Starts in ${special.starts_in_minutes}m`
      : "Starting soon";

  return (
    <Link
      href={
        portalSlug
          ? `/${portalSlug}?spot=${special.venue.slug}`
          : `/spots/${special.venue.slug}`
      }
      scroll={false}
      className="group card-atmospheric surface-raised rounded-xl border border-subtle shadow-card-sm hover:shadow-card-md card-hover-lift block"
    >
      <div className="px-3 py-3 flex gap-3">
        {/* Icon */}
        <div className="w-10 flex-shrink-0 flex items-center justify-center">
          <CategoryIcon
            type={special.venue.venue_type || "venue"}
            size={22}
          />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Venue name */}
          <p className="text-[0.7rem] font-mono text-[var(--soft)] truncate">
            {special.venue.name}
            {special.venue.neighborhood && (
              <span className="text-[var(--twilight)]">
                {" "}
                &middot; {special.venue.neighborhood}
              </span>
            )}
          </p>

          {/* Special title */}
          <h4 className="font-semibold text-[var(--text-primary)] leading-tight line-clamp-1 mt-0.5 group-hover:text-[var(--coral)] transition-colors">
            {special.title}
          </h4>

          {/* Meta row: type + state badge */}
          <div className="flex items-center gap-2 mt-1.5">
            {/* Type badge */}
            <span className="inline-flex items-center gap-1 text-[0.6rem] font-mono text-[var(--muted)]">
              <Tag weight="fill" className="w-3 h-3" />
              {formatSpecialType(special.type)}
            </span>

            {/* State badge */}
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[0.58rem] font-mono font-medium"
              style={{
                color: badgeColor,
                backgroundColor: `color-mix(in srgb, ${badgeColor} 12%, transparent)`,
                borderColor: `color-mix(in srgb, ${badgeColor} 25%, transparent)`,
                borderWidth: "1px",
              }}
            >
              {isActive ? (
                <Lightning weight="fill" className="w-2.5 h-2.5" />
              ) : (
                <Clock weight="fill" className="w-2.5 h-2.5" />
              )}
              {badgeLabel}
            </span>

            {/* Price note */}
            {special.price_note && (
              <span className="text-[0.6rem] font-mono text-[var(--gold)]">
                {special.price_note}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function formatSpecialType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const SpecialCard = memo(SpecialCardComponent);
export default SpecialCard;
