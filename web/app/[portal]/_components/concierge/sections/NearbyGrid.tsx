"use client";

import type { Destination } from "@/lib/concierge/concierge-types";
import HotelSection from "../../hotel/HotelSection";
import HotelCarousel from "../../hotel/HotelCarousel";
import HotelDestinationCard from "../../hotel/HotelDestinationCard";

interface NearbyGridProps {
  destinations: Destination[];
  portalSlug: string;
  portalName: string;
  /** Weather modifiers to re-rank destinations */
  weatherModifiers?: { indoor: number; outdoor: number; rooftop: number; cozy: number };
}

export default function NearbyGrid({ destinations, portalSlug, portalName, weatherModifiers }: NearbyGridProps) {
  let walkable = destinations
    .filter((d) => d.proximity_tier === "walkable" || d.proximity_tier === "close");

  // Apply weather modifier re-ranking if provided
  if (weatherModifiers) {
    walkable = applyWeatherRanking(walkable, weatherModifiers);
  }

  walkable = walkable.slice(0, 8);

  if (walkable.length === 0) {
    return (
      <div className="text-center py-10 rounded-xl border border-dashed border-[var(--hotel-sand)] bg-[var(--hotel-cream)]/50">
        <svg className="mx-auto w-8 h-8 text-[var(--hotel-sand)] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </svg>
        <p className="text-sm font-body font-medium text-[var(--hotel-charcoal)] mb-1">No walkable spots found</p>
        <p className="text-xs font-body text-[var(--hotel-stone)]">
          We&apos;re still mapping this area. More destinations coming soon.
        </p>
      </div>
    );
  }

  return (
    <HotelSection
      id="nearby"
      title={`Steps from ${portalName}`}
      subtitle="Walkable destinations near the hotel"
    >
      <HotelCarousel>
        {walkable.map((dest) => (
          <div key={dest.venue.id} className="snap-start shrink-0 w-[280px] md:w-[320px]">
            <HotelDestinationCard destination={dest} portalSlug={portalSlug} />
          </div>
        ))}
      </HotelCarousel>
    </HotelSection>
  );
}

function applyWeatherRanking(
  destinations: Destination[],
  modifiers: { indoor: number; outdoor: number; rooftop: number; cozy: number }
): Destination[] {
  return [...destinations].sort((a, b) => {
    const scoreA = getWeatherAdjustedScore(a, modifiers);
    const scoreB = getWeatherAdjustedScore(b, modifiers);
    return scoreB - scoreA;
  });
}

function getWeatherAdjustedScore(
  dest: Destination,
  modifiers: { indoor: number; outdoor: number; rooftop: number; cozy: number }
): number {
  let score = 0;
  const venueType = dest.venue.venue_type?.toLowerCase() || "";

  // Base proximity score
  if (dest.proximity_tier === "walkable") score += 1;
  else if (dest.proximity_tier === "close") score += 0.6;
  else score += 0.3;

  // Special state bonus
  if (dest.special_state === "active_now") score += 0.5;
  else if (dest.special_state === "starting_soon") score += 0.2;

  // Weather adjustments based on venue type
  const outdoorTypes = ["park", "garden", "farmers_market"];
  const rooftopIndicators = ["rooftop"];
  const cozyIndicators = ["coffee_shop", "bookstore", "bar"];

  if (outdoorTypes.includes(venueType)) {
    score += modifiers.outdoor;
  } else if (rooftopIndicators.includes(venueType)) {
    score += modifiers.rooftop;
  } else if (cozyIndicators.includes(venueType)) {
    score += modifiers.cozy;
  } else {
    score += modifiers.indoor;
  }

  return score;
}
