"use client";

import type { Portal } from "@/lib/portal-context";
import type { PlannerPillarData } from "@/lib/concierge/concierge-types";
import ItineraryBuilder from "@/components/itinerary/ItineraryBuilder";
import EventBrowser from "../sections/EventBrowser";

interface PlannerPillarProps {
  data: PlannerPillarData;
  portal: Portal;
}

export default function PlannerPillar({ data, portal }: PlannerPillarProps) {
  return (
    <div className="space-y-12">
      {/* Itinerary builder */}
      <ItineraryBuilder portal={portal} />

      {/* Event suggestions for adding to itinerary */}
      <EventBrowser
        sections={data.sections}
        portalSlug={portal.slug}
        dayOfWeek={new Date().getDay()}
        expanded
      />
    </div>
  );
}
