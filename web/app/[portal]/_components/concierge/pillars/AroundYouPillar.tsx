"use client";

import { useMemo, useState } from "react";
import type { AroundYouPillarData, AmbientContext } from "@/lib/concierge/concierge-types";
import { rankEventsForConcierge } from "@/lib/concierge/event-relevance";
import HeroSection from "../sections/HeroSection";
import ConciergeBriefSection from "../sections/ConciergeBriefSection";
import NearbyGrid from "../sections/NearbyGrid";
import InterestFilterBar from "../sections/InterestFilterBar";
import EventBrowser from "../sections/EventBrowser";

interface AroundYouPillarProps {
  data: AroundYouPillarData;
  portalId: string;
  ambient: AmbientContext;
  portalSlug: string;
  portalName: string;
  conciergePhone?: string;
}

export default function AroundYouPillar({
  data,
  portalId,
  ambient,
  portalSlug,
  portalName,
  conciergePhone,
}: AroundYouPillarProps) {
  const [activeInterests, setActiveInterests] = useState<string[]>([]);

  const handleToggle = (interest: string) => {
    setActiveInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const tonightEvents = useMemo(() => {
    const primary = data.tonightEvents.length > 0
      ? data.tonightEvents
      : data.sections.flatMap((section) => section.events);
    return rankEventsForConcierge(primary.slice(0, 12), ambient.dayPart, { minResults: 3 }).slice(0, 8);
  }, [data.tonightEvents, data.sections, ambient.dayPart]);

  const briefPicks = useMemo(() => tonightEvents.slice(0, 3), [tonightEvents]);

  const weatherAnnotation = useMemo(() => {
    if (!ambient.hasWeather) return null;
    if (ambient.weatherSignal === "rain") return "Rain expected - indoor venues recommended.";
    if (ambient.weatherSignal === "cold") return "Cold weather ahead - cozy spots highlighted.";
    if (ambient.weatherSignal === "hot") return "Hot forecast - indoor and shaded venues prioritized.";
    return null;
  }, [ambient.hasWeather, ambient.weatherSignal]);

  return (
    <div className="space-y-8 md:space-y-10">
      <HeroSection
        greeting={ambient.greeting}
        heroPhoto={ambient.heroPhoto}
        portalName={portalName}
        conciergePhone={conciergePhone}
      />

      <ConciergeBriefSection
        portalId={portalId}
        portalSlug={portalSlug}
        dayPart={ambient.dayPart}
        events={briefPicks}
        conciergePhone={conciergePhone}
        weatherAnnotation={weatherAnnotation}
      />

      <NearbyGrid
        destinations={data.destinations}
        portalSlug={portalSlug}
        portalName={portalName}
        weatherModifiers={ambient.weatherModifiers}
      />

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
            activeInterests={activeInterests.length > 0 ? activeInterests : undefined}
            weatherAnnotation={weatherAnnotation}
          />
        </div>
      )}
    </div>
  );
}
