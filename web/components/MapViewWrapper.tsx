"use client";

import dynamic from "next/dynamic";
import { useMapEvents } from "@/lib/hooks/useMapEvents";
import type { EventWithLocation } from "@/lib/search";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[var(--night)] rounded-lg flex items-center justify-center border border-[var(--twilight)]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--neon-cyan)] mx-auto mb-2"></div>
        <p className="text-[var(--muted)] font-mono text-sm">Loading map...</p>
      </div>
    </div>
  ),
});

interface Props {
  // If events are provided directly, use them (e.g., happening-now page)
  events?: EventWithLocation[];
  userLocation?: { lat: number; lng: number } | null;
  // If no events provided, fetch using these params
  portalId?: string;
  portalExclusive?: boolean;
}

export default function MapViewWrapper({ events: providedEvents, userLocation, portalId, portalExclusive }: Props) {
  // Only use the hook if events aren't provided directly
  const { events: fetchedEvents, isLoading } = useMapEvents({
    portalId,
    portalExclusive,
    enabled: !providedEvents, // Skip fetching if events are provided
  });

  // Use provided events if available, otherwise use fetched events
  const events = providedEvents || fetchedEvents;
  const loading = !providedEvents && isLoading;

  if (loading && events.length === 0) {
    return (
      <div className="w-full h-full bg-[var(--night)] rounded-lg flex items-center justify-center border border-[var(--twilight)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--neon-cyan)] mx-auto mb-2"></div>
          <p className="text-[var(--muted)] font-mono text-sm">Loading events...</p>
        </div>
      </div>
    );
  }

  return <MapView events={events} userLocation={userLocation} />;
}
