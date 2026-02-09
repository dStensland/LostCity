import Link from "next/link";
import type { Spot } from "@/lib/spots-constants";
import { formatPriceLevel } from "@/lib/spots-constants";
import { formatCompactCount } from "@/lib/formats";
import CategoryIcon, { getCategoryLabel } from "./CategoryIcon";
import { EventsBadge } from "./Badge";
import VenueTagBadges from "./VenueTagBadges";
import { getSpotReflectionClass } from "@/lib/card-utils";

// Tag data that can be passed from parent (batch-loaded) to avoid N+1 queries
export type SpotTagData = {
  tag_id: string;
  tag_label: string;
  tag_group: string;
  score: number;
};

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
  const reflectionClass = getSpotReflectionClass(venueType);

  // Calculate distance if we have user location and spot coordinates
  const distance = showDistance && spot.lat && spot.lng
    ? calculateDistance(showDistance.lat, showDistance.lng, spot.lat, spot.lng)
    : null;
  const followerCount = spot.follower_count ?? 0;
  const recommendationCount = spot.recommendation_count ?? 0;
  const hasSocialProof = followerCount > 0 || recommendationCount > 0;

  return (
    <Link
      href={portalSlug ? `/${portalSlug}?spot=${spot.slug}` : `/spots/${spot.slug}`}
      scroll={false}
      data-category={venueType}
      data-accent="category"
      className={`event-item animate-fade-in ${staggerClass} group card-atmospheric glow-accent reflection-accent ${reflectionClass}`}
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
              return (
                <span
                  key={tag.tag_id}
                  data-tag-group={tag.tag_group}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.55rem] font-mono bg-accent-15 text-accent"
                >
                  {tag.tag_label}
                </span>
              );
            })}
          </div>
        ) : (
          <VenueTagBadges venueId={spot.id} maxTags={3} />
        )}

        {/* Social proof row */}
        {hasSocialProof && (
          <div className="flex items-center gap-2 mt-2 flex-wrap text-[0.6rem] font-mono text-[var(--muted)]">
            {followerCount > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--twilight)]/40 text-[var(--soft)]">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {formatCompactCount(followerCount)} followers
              </span>
            )}
            {recommendationCount > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--twilight)]/40 text-[var(--soft)]">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l2.7 5.5L21 9.2l-4.5 4.3L17.6 20 12 17l-5.6 3 1.1-6.5L3 9.2l6.3-.7L12 3z" />
                </svg>
                {formatCompactCount(recommendationCount)} recommended
              </span>
            )}
          </div>
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
