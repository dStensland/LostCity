"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import type { EventWithLocation } from "@/lib/search";

// Fix for default marker icons in Leaflet with webpack
import "leaflet/dist/leaflet.css";

// Custom marker icon
const createIcon = (color: string) =>
  L.divIcon({
    className: "custom-marker",
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });

const categoryColors: Record<string, string> = {
  music: "#3B82F6",
  film: "#8B5CF6",
  comedy: "#F59E0B",
  theater: "#EC4899",
  art: "#10B981",
  sports: "#EF4444",
  food_drink: "#F97316",
  nightlife: "#6366F1",
  community: "#14B8A6",
  fitness: "#84CC16",
  family: "#06B6D4",
};

interface Props {
  events: EventWithLocation[];
}

export default function MapView({ events }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-[600px] bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">Loading map...</p>
      </div>
    );
  }

  // Filter events with valid coordinates
  const mappableEvents = events.filter(
    (e) => e.venue?.lat && e.venue?.lng
  );

  // Atlanta center coordinates
  const atlantaCenter: [number, number] = [33.749, -84.388];

  // Calculate bounds if we have events
  const bounds =
    mappableEvents.length > 0
      ? L.latLngBounds(
          mappableEvents.map((e) => [e.venue!.lat!, e.venue!.lng!] as [number, number])
        )
      : null;

  return (
    <div className="w-full h-[600px] rounded-lg overflow-hidden border border-gray-200">
      <MapContainer
        center={atlantaCenter}
        zoom={12}
        bounds={bounds || undefined}
        boundsOptions={{ padding: [50, 50] }}
        className="w-full h-full"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {mappableEvents.map((event) => (
          <Marker
            key={event.id}
            position={[event.venue!.lat!, event.venue!.lng!]}
            icon={createIcon(categoryColors[event.category || ""] || "#6B7280")}
          >
            <Popup>
              <div className="min-w-[200px]">
                <Link
                  href={`/events/${event.id}`}
                  className="font-semibold text-blue-600 hover:underline block mb-1"
                >
                  {event.title}
                </Link>
                <p className="text-sm text-gray-600 mb-1">
                  {event.venue?.name}
                  {event.venue?.neighborhood && ` • ${event.venue.neighborhood}`}
                </p>
                <p className="text-sm text-gray-500">
                  {format(parseISO(event.start_date), "EEE, MMM d")}
                  {event.start_time && ` at ${event.start_time}`}
                </p>
                {event.is_free && (
                  <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                    Free
                  </span>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {mappableEvents.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80">
          <p className="text-gray-500">No events with map locations</p>
        </div>
      )}
    </div>
  );
}
