"use client";

import PlaceEventsSection from "@/components/detail/PlaceEventsSection";
import { buildEventUrl } from "@/lib/entity-urls";
import type { SectionProps } from "@/lib/detail/types";

export function EventsAtVenueSection({ data, portalSlug }: SectionProps) {
  let venueName = "";
  let events: unknown[] = [];

  switch (data.entityType) {
    case "place": {
      const spot = data.payload.spot as Record<string, unknown>;
      venueName = (spot.name as string) || "This Venue";
      events = data.payload.upcomingEvents ?? [];
      break;
    }
    case "org": {
      venueName = data.payload.organization.name;
      events = data.payload.events ?? [];
      break;
    }
    default:
      return null;
  }

  if (!events || events.length === 0) return null;

  const handleEventClick = (id: number) => {
    window.location.href = buildEventUrl(id, portalSlug, "canonical");
  };

  return (
    <PlaceEventsSection
      venueName={venueName}
      events={events as Parameters<typeof PlaceEventsSection>[0]["events"]}
      onEventClick={handleEventClick}
    />
  );
}
