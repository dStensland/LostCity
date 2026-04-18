"use client";

import AroundHereSection, {
  type NearbyDestination,
  type RelatedEvent,
} from "@/components/detail/AroundHereSection";
import { buildSpotUrl } from "@/lib/entity-urls";
import type { SectionProps } from "@/lib/detail/types";

export function NearbySection({ data, portalSlug }: SectionProps) {
  let venueEvents: RelatedEvent[] = [];
  let nearbyEvents: RelatedEvent[] = [];
  let destinations: NearbyDestination[] = [];
  let venueName: string | undefined;
  let neighborhood: string | null = null;
  let venueType: string | null = null;

  switch (data.entityType) {
    case "event": {
      const e = data.payload.event;
      nearbyEvents = data.payload.nearbyEvents as RelatedEvent[];
      const nearby = data.payload.nearbyDestinations as Record<string, NearbyDestination[]>;
      destinations = Object.values(nearby).flat().slice(0, 8);
      neighborhood = e.venue?.neighborhood ?? null;
      venueType = e.venue?.place_type ?? null;
      break;
    }
    case "place": {
      const spot = data.payload.spot as Record<string, unknown>;
      venueEvents = data.payload.upcomingEvents as RelatedEvent[];
      const nearby = data.payload.nearbyDestinations as Record<string, NearbyDestination[]>;
      destinations = Object.values(nearby).flat().slice(0, 8);
      venueName = spot.name as string | undefined;
      neighborhood = spot.neighborhood as string | null;
      venueType = (spot.place_type || spot.spot_type) as string | null;
      break;
    }
    default:
      break;
  }

  const hasContent =
    venueEvents.length > 0 || nearbyEvents.length > 0 || destinations.length > 0;
  if (!hasContent) return null;

  const handleSpotClick = (slug: string) => {
    window.location.href = buildSpotUrl(slug, portalSlug, "canonical");
  };

  const handleEventClick = (id: number) => {
    window.location.href = `/${portalSlug}/events/${id}`;
  };

  return (
    <AroundHereSection
      venueEvents={venueEvents}
      nearbyEvents={nearbyEvents}
      destinations={destinations}
      venueName={venueName}
      neighborhood={neighborhood}
      portalSlug={portalSlug}
      venueType={venueType}
      onSpotClick={handleSpotClick}
      onEventClick={handleEventClick}
    />
  );
}
