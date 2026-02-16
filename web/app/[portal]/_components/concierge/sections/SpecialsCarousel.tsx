"use client";

import type { Destination } from "@/lib/concierge/concierge-types";
import HotelSection from "../../hotel/HotelSection";
import HotelCarousel from "../../hotel/HotelCarousel";
import HotelDestinationCard from "../../hotel/HotelDestinationCard";

interface SpecialsCarouselProps {
  destinations: Destination[];
  portalSlug: string;
}

export default function SpecialsCarousel({ destinations, portalSlug }: SpecialsCarouselProps) {
  const activeSpecials = destinations
    .filter((d) => d.special_state === "active_now" || d.special_state === "starting_soon")
    .sort((a, b) => {
      if (a.special_state === "active_now" && b.special_state !== "active_now") return -1;
      if (b.special_state === "active_now" && a.special_state !== "active_now") return 1;
      return a.distance_km - b.distance_km;
    })
    .slice(0, 8);

  if (activeSpecials.length === 0) {
    return (
      <div className="text-center py-10 rounded-xl border border-dashed border-[var(--hotel-sand)] bg-[var(--hotel-cream)]/50">
        <svg className="mx-auto w-8 h-8 text-[var(--hotel-sand)] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm font-body font-medium text-[var(--hotel-charcoal)] mb-1">No live specials right now</p>
        <p className="text-xs font-body text-[var(--hotel-stone)]">
          Check back this evening for happy hours and deals nearby.
        </p>
      </div>
    );
  }

  return (
    <div className="relative -mx-4 md:-mx-6 px-4 md:px-6 py-8 bg-gradient-to-br from-[var(--hotel-cream)] to-[var(--hotel-sand)]/30 rounded-2xl">
      <HotelSection
        id="specials"
        title="Live Deals Nearby"
        subtitle="Active specials and happy hours within walking distance"
      >
        <HotelCarousel>
          {activeSpecials.map((dest) => (
            <div key={dest.venue.id} className="snap-start shrink-0 w-[280px] md:w-[320px]">
              <HotelDestinationCard
                destination={dest}
                portalSlug={portalSlug}
                variant="live"
              />
            </div>
          ))}
        </HotelCarousel>
      </HotelSection>
    </div>
  );
}
