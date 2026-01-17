"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import type { EventWithLocation } from "@/lib/search";
import { DARK_MAP_TILES } from "@/lib/map-config";

// Fix for default marker icons in Leaflet with webpack
import "leaflet/dist/leaflet.css";

// Dark theme styles for Leaflet popups
const mapStyles = `
  .leaflet-popup-content-wrapper {
    background: var(--dusk);
    border: 1px solid var(--twilight);
    border-radius: 8px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
  }
  .leaflet-popup-tip {
    background: var(--dusk);
    border-left: 1px solid var(--twilight);
    border-bottom: 1px solid var(--twilight);
  }
  .leaflet-popup-close-button {
    color: var(--muted) !important;
  }
  .leaflet-popup-close-button:hover {
    color: var(--cream) !important;
  }
  .leaflet-control-attribution {
    background: var(--night) !important;
    color: var(--muted) !important;
  }
  .leaflet-control-attribution a {
    color: var(--soft) !important;
  }
`;

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Client-side hydration pattern
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-[600px] bg-[var(--night)] rounded-lg flex items-center justify-center border border-[var(--twilight)]">
        <p className="text-[var(--muted)] font-mono text-sm">Loading map...</p>
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
    <>
      <style dangerouslySetInnerHTML={{ __html: mapStyles }} />
      <div className="w-full h-[600px] rounded-lg overflow-hidden border border-[var(--twilight)]">
        <MapContainer
        center={atlantaCenter}
        zoom={12}
        bounds={bounds || undefined}
        boundsOptions={{ padding: [50, 50] }}
        className="w-full h-full"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution={DARK_MAP_TILES.attribution}
          url={DARK_MAP_TILES.url}
        />
        {mappableEvents.map((event) => (
          <Marker
            key={event.id}
            position={[event.venue!.lat!, event.venue!.lng!]}
            icon={createIcon(categoryColors[event.category || ""] || "#6B7280")}
          >
            <Popup className="dark-popup">
              <div className="min-w-[200px] p-1">
                <Link
                  href={`/events/${event.id}`}
                  className="font-serif text-[var(--coral)] hover:text-[var(--rose)] block mb-1 transition-colors"
                >
                  {event.title}
                </Link>
                <p className="font-mono text-xs text-[var(--muted)] mb-1">
                  {event.venue?.name}
                  {event.venue?.neighborhood && ` · ${event.venue.neighborhood}`}
                </p>
                <p className="font-mono text-xs text-[var(--soft)]">
                  {format(parseISO(event.start_date), "EEE, MMM d")}
                  {event.start_time && ` at ${event.start_time}`}
                </p>
                {event.is_free && (
                  <span className="inline-block mt-1.5 px-2 py-0.5 text-[0.6rem] font-mono font-medium bg-[var(--neon-green)]/20 text-[var(--neon-green)] rounded">
                    FREE
                  </span>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {mappableEvents.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--void)]/80">
          <p className="text-[var(--muted)] font-mono text-sm">No events with map locations</p>
        </div>
      )}
    </div>
    </>
  );
}
