"use client";

import ExistingGettingThereSection, {
  type TransitData,
  type WalkableNeighbor,
} from "@/components/GettingThereSection";
import type { SectionProps } from "@/lib/detail/types";

export function GettingThereSection({ data }: SectionProps) {
  let transit: TransitData | null = null;
  let walkableNeighbors: WalkableNeighbor[] = [];

  switch (data.entityType) {
    case "event": {
      const venue = data.payload.event.venue;
      if (venue) transit = venue;
      break;
    }
    case "place": {
      const spot = data.payload.spot as Record<string, unknown>;
      transit = spot as TransitData;
      walkableNeighbors = (data.payload.walkableNeighbors as WalkableNeighbor[]) ?? [];
      break;
    }
    case "series": {
      // Single-venue series: use the first venue's transit data
      const showtimes = data.payload.venueShowtimes;
      if (showtimes?.length === 1 && showtimes[0].venue) {
        transit = showtimes[0].venue as TransitData;
      }
      break;
    }
    case "festival": {
      // Festival: location-level, not venue-level. Render nothing.
      break;
    }
    default:
      break;
  }

  if (!transit) return null;

  return (
    <ExistingGettingThereSection
      transit={transit}
      variant="expanded"
      walkableNeighbors={walkableNeighbors}
    />
  );
}
