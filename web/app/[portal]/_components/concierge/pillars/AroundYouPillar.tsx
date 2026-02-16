"use client";

import { useState, useMemo } from "react";
import type { AroundYouPillarData, AmbientContext } from "@/lib/concierge/concierge-types";
import HeroSection from "../sections/HeroSection";
import SpecialsCarousel from "../sections/SpecialsCarousel";
import NearbyGrid from "../sections/NearbyGrid";
import InterestFilterBar from "../sections/InterestFilterBar";
import EventBrowser from "../sections/EventBrowser";
import HotelSection from "../../hotel/HotelSection";
import HotelCarousel from "../../hotel/HotelCarousel";
import HotelEventCard from "../../hotel/HotelEventCard";

interface AroundYouPillarProps {
  data: AroundYouPillarData;
  ambient: AmbientContext;
  portalSlug: string;
  portalName: string;
}

export default function AroundYouPillar({ data, ambient, portalSlug, portalName }: AroundYouPillarProps) {
  const tonightEvents = data.tonightEvents.slice(0, 8);
  const [activeInterests, setActiveInterests] = useState<string[]>([]);

  const handleToggle = (interest: string) => {
    setActiveInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const weatherAnnotation = useMemo(() => {
    if (!ambient.hasWeather) return null;
    if (ambient.weatherSignal === "rain") return "Rain expected - indoor venues recommended";
    if (ambient.weatherSignal === "cold") return "Cold weather ahead - cozy spots highlighted";
    if (ambient.weatherSignal === "hot") return "Hot forecast - indoor and shaded venues prioritized";
    return null;
  }, [ambient.hasWeather, ambient.weatherSignal]);

  return (
    <div className="space-y-12">
      {/* Hero */}
      <HeroSection
        greeting={ambient.greeting}
        quickActions={ambient.quickActions}
        heroPhoto={ambient.heroPhoto}
        portalName={portalName}
      />

      {/* Live specials */}
      <SpecialsCarousel
        destinations={data.liveDestinations.length > 0 ? data.liveDestinations : data.destinations}
        portalSlug={portalSlug}
      />

      {/* Tonight events */}
      {tonightEvents.length > 0 && (
        <HotelSection
          id="tonight"
          title="Tonight"
          subtitle="Top events happening today, curated by proximity and quality"
        >
          <HotelCarousel>
            {tonightEvents.map((event) => (
              <div key={event.id} className="snap-start shrink-0 w-[300px] md:w-[340px]">
                <HotelEventCard event={event} portalSlug={portalSlug} />
              </div>
            ))}
          </HotelCarousel>
        </HotelSection>
      )}

      {/* Nearby destinations with weather modifier ranking */}
      <NearbyGrid
        destinations={data.destinations}
        portalSlug={portalSlug}
        portalName={portalName}
        weatherModifiers={ambient.weatherModifiers}
      />

      {/* Coming up — browse by interest */}
      {data.sections.length > 0 && (
        <div className="space-y-2">
          <InterestFilterBar
            activeInterests={activeInterests}
            onToggle={handleToggle}
          />
          <EventBrowser
            sections={data.sections}
            portalSlug={portalSlug}
            dayOfWeek={data.dayOfWeek}
            expanded
            activeInterests={activeInterests.length > 0 ? activeInterests : undefined}
            weatherAnnotation={weatherAnnotation}
          />
        </div>
      )}
    </div>
  );
}
