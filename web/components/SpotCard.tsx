import Link from "next/link";
import type { Spot } from "@/lib/spots";
import { formatPriceLevel } from "@/lib/spots";
import CategoryIcon, { getCategoryLabel } from "./CategoryIcon";

interface Props {
  spot: Spot;
  index?: number;
  showDistance?: { lat: number; lng: number };
}

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(miles: number): string {
  if (miles < 0.1) return "< 0.1 mi";
  if (miles < 1) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export default function SpotCard({ spot, index = 0, showDistance }: Props) {
  // Stagger animation class
  const staggerClass = index < 10 ? `stagger-${index + 1}` : "";
  const priceDisplay = formatPriceLevel(spot.price_level);
  const spotType = spot.spot_type || "music_venue";

  // Calculate distance if we have user location and spot coordinates
  const distance = showDistance && spot.lat && spot.lng
    ? calculateDistance(showDistance.lat, showDistance.lng, spot.lat, spot.lng)
    : null;

  return (
    <Link
      href={`/spots/${spot.slug}`}
      className={`event-item animate-fade-in ${staggerClass} group`}
    >
      {/* Icon column */}
      <div className="w-10 flex-shrink-0 flex items-center justify-center">
        <CategoryIcon type={spotType} size={24} />
      </div>

      {/* Content column */}
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-[var(--cream)] leading-snug line-clamp-1 group-hover:text-[var(--coral)] transition-colors">
          {spot.name}
        </h3>
        <p className="font-serif text-sm text-[var(--soft)] mt-0.5">
          {getCategoryLabel(spotType)}
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
          {distance !== null && (
            <span className="font-mono text-xs font-medium text-[var(--coral)]">
              {formatDistance(distance)}
            </span>
          )}
          {priceDisplay && (
            <span className="font-mono text-xs font-medium text-[var(--muted)]">
              {priceDisplay}
            </span>
          )}
          {spot.event_count !== undefined && spot.event_count > 0 && (
            <span className="font-mono text-xs text-[var(--cat-community)]">
              {spot.event_count} upcoming
            </span>
          )}
        </div>
      </div>

      {/* Right column - desktop only */}
      <div className="hidden sm:flex items-center gap-4">
        {distance !== null && (
          <span className="font-mono text-xs font-medium text-[var(--coral)] whitespace-nowrap">
            {formatDistance(distance)}
          </span>
        )}
        {priceDisplay && (
          <span className="font-mono text-sm font-medium text-[var(--muted)]">
            {priceDisplay}
          </span>
        )}
        {spot.event_count !== undefined && spot.event_count > 0 && (
          <span className="font-mono text-xs text-[var(--cat-community)] whitespace-nowrap">
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
