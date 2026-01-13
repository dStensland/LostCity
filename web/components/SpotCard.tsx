import Link from "next/link";
import type { Spot } from "@/lib/spots";
import { SPOT_TYPES, type SpotType, formatPriceLevel, getSpotTypeLabel } from "@/lib/spots";

interface Props {
  spot: Spot;
  index?: number;
}

export default function SpotCard({ spot, index = 0 }: Props) {
  // Stagger animation class
  const staggerClass = index < 10 ? `stagger-${index + 1}` : "";

  // Get primary spot type info
  const primaryType = spot.spot_type as SpotType | null;
  const typeInfo = primaryType ? SPOT_TYPES[primaryType] : null;
  const priceDisplay = formatPriceLevel(spot.price_level);

  return (
    <Link
      href={`/spots/${spot.slug}`}
      className={`event-item animate-fade-in ${staggerClass} group`}
    >
      {/* Icon column */}
      <div className="text-2xl w-8 flex-shrink-0">
        {typeInfo?.icon || "📍"}
      </div>

      {/* Content column */}
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-[var(--cream)] leading-snug line-clamp-1 group-hover:text-[var(--coral)] transition-colors">
          {spot.name}
        </h3>
        <p className="font-serif text-sm text-[var(--soft)] mt-0.5">
          {getSpotTypeLabel(spot.spot_type)}
          {spot.neighborhood && (
            <span className="text-[var(--muted)]"> · {spot.neighborhood}</span>
          )}
        </p>

        {/* Description */}
        {spot.short_description && (
          <p className="text-sm text-[var(--muted)] mt-1.5 line-clamp-1">
            {spot.short_description}
          </p>
        )}

        {/* Meta row - mobile */}
        <div className="flex items-center gap-3 mt-2 sm:hidden">
          {priceDisplay && (
            <span className="font-mono text-xs font-medium text-[var(--muted)]">
              {priceDisplay}
            </span>
          )}
          {spot.event_count !== undefined && spot.event_count > 0 && (
            <span className="font-mono text-xs text-[var(--cat-music)]">
              {spot.event_count} upcoming
            </span>
          )}
        </div>
      </div>

      {/* Right column - desktop only */}
      <div className="hidden sm:flex items-center gap-4">
        {priceDisplay && (
          <span className="font-mono text-sm font-medium text-[var(--muted)]">
            {priceDisplay}
          </span>
        )}
        {spot.event_count !== undefined && spot.event_count > 0 && (
          <span className="font-mono text-xs text-[var(--cat-music)] whitespace-nowrap">
            {spot.event_count} upcoming
          </span>
        )}
        {/* Arrow indicator */}
        <div className="w-5 h-5 flex items-center justify-center text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors">
          <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
