import Link from "next/link";
import type { Spot } from "@/lib/spots";
import { formatPriceLevel } from "@/lib/spots";
import CategoryIcon, { getCategoryLabel, getCategoryColor } from "./CategoryIcon";
import { EventsBadge } from "./Badge";
import VenueTagBadges from "./VenueTagBadges";
import { VENUE_TAG_GROUPS } from "@/lib/venue-tags";
import type { VenueTagGroup } from "@/lib/types";

// Tag data that can be passed from parent (batch-loaded) to avoid N+1 queries
export type SpotTagData = {
  tag_id: string;
  tag_label: string;
  tag_group: string;
  score: number;
};

// Get reflection color class based on spot type
function getReflectionClass(spotType: string): string {
  const reflectionMap: Record<string, string> = {
    music_venue: "reflect-music",
    comedy_club: "reflect-comedy",
    art_gallery: "reflect-art",
    theater: "reflect-theater",
    movie_theater: "reflect-film",
    community_space: "reflect-community",
    restaurant: "reflect-food",
    bar: "reflect-nightlife",
    sports_venue: "reflect-sports",
    fitness_studio: "reflect-fitness",
    nightclub: "reflect-nightlife",
    family_venue: "reflect-family",
  };
  return reflectionMap[spotType] || "";
}

interface Props {
  spot: Spot;
  index?: number;
  showDistance?: { lat: number; lng: number };
  portalSlug?: string;
  /** Pre-loaded tags to avoid N+1 fetching - pass from batch-loaded API response */
  tags?: SpotTagData[];
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

export default function SpotCard({ spot, index = 0, showDistance, portalSlug, tags }: Props) {
  // Stagger animation class
  const staggerClass = index < 10 ? `stagger-${index + 1}` : "";
  const priceDisplay = formatPriceLevel(spot.price_level);
  const venueType = spot.venue_type || "music_venue";
  const categoryColor = getCategoryColor(venueType);
  const reflectionClass = getReflectionClass(venueType);

  // Calculate distance if we have user location and spot coordinates
  const distance = showDistance && spot.lat && spot.lng
    ? calculateDistance(showDistance.lat, showDistance.lng, spot.lat, spot.lng)
    : null;

  return (
    <Link
      href={portalSlug ? `/${portalSlug}?spot=${spot.slug}` : `/spots/${spot.slug}`}
      scroll={false}
      className={`event-item animate-fade-in ${staggerClass} group card-atmospheric ${reflectionClass}`}
      style={{
        "--glow-color": categoryColor,
        "--reflection-color": `color-mix(in srgb, ${categoryColor} 15%, transparent)`,
      } as React.CSSProperties}
    >
      {/* Icon column */}
      <div className="w-10 flex-shrink-0 flex items-center justify-center">
        <CategoryIcon type={venueType} size={24} />
      </div>

      {/* Content column */}
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-[var(--cream)] leading-snug line-clamp-2 sm:line-clamp-1 group-hover:text-[var(--coral)] transition-colors">
          {spot.name}
        </h3>
        <p className="font-serif text-sm text-[var(--soft)] mt-0.5">
          {getCategoryLabel(venueType)}
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

        {/* Community tags - use pre-loaded tags if available, otherwise fetch (N+1 fallback) */}
        {tags && tags.length > 0 ? (
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {tags.slice(0, 3).map((tag) => {
              const groupConfig = VENUE_TAG_GROUPS[tag.tag_group as VenueTagGroup];
              const color = groupConfig?.color || "var(--cream)";
              return (
                <span
                  key={tag.tag_id}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.55rem] font-mono"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
                    color: color,
                  }}
                >
                  {tag.tag_label}
                </span>
              );
            })}
          </div>
        ) : (
          <VenueTagBadges venueId={spot.id} maxTags={3} />
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
            <EventsBadge count={spot.event_count} />
          )}
        </div>
      </div>

      {/* Right column - desktop only */}
      <div className="hidden sm:flex items-center gap-3">
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
        {/* Event count badge - always far right */}
        {spot.event_count !== undefined && spot.event_count > 0 && (
          <EventsBadge count={spot.event_count} />
        )}
        {/* Arrow indicator - desktop only (hidden on touch devices via CSS) */}
        <div className="w-5 h-5 items-center justify-center text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors hidden md:flex desktop-hover-only">
          <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
