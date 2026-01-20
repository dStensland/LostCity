"use client";

import dynamic from "next/dynamic";
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
  events: EventWithLocation[];
  userLocation?: { lat: number; lng: number } | null;
}

export default function MapViewWrapper({ events, userLocation }: Props) {
  return <MapView events={events} userLocation={userLocation} />;
}
