"use client";

import dynamic from "next/dynamic";
import type { EventWithLocation } from "@/lib/search";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] bg-gray-100 rounded-lg flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
        <p className="text-gray-500">Loading map...</p>
      </div>
    </div>
  ),
});

interface Props {
  events: EventWithLocation[];
}

export default function MapViewWrapper({ events }: Props) {
  return <MapView events={events} />;
}
