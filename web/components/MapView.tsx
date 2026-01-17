"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import type { EventWithLocation } from "@/lib/search";
import { DARK_MAP_TILES } from "@/lib/map-config";
import { CATEGORY_CONFIG } from "./CategoryIcon";

// Fix for default marker icons in Leaflet with webpack
import "leaflet/dist/leaflet.css";

// Dark theme styles for Leaflet popups with neon enhancements
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

  /* Neon marker styles */
  .neon-marker {
    transition: transform 0.2s ease;
  }
  .neon-marker:hover {
    transform: scale(1.2);
    z-index: 1000 !important;
  }

  /* Live event pulse animation */
  @keyframes marker-pulse {
    0%, 100% {
      box-shadow: 0 0 8px var(--marker-color), 0 0 16px var(--marker-color);
    }
    50% {
      box-shadow: 0 0 16px var(--marker-color), 0 0 32px var(--marker-color);
    }
  }
  .marker-live {
    animation: marker-pulse 2s ease-in-out infinite;
  }
`;

// Neon marker with glow effect
const createNeonIcon = (color: string, isLive: boolean = false) =>
  L.divIcon({
    className: `neon-marker ${isLive ? "marker-live" : ""}`,
    html: `<div style="
      --marker-color: ${color};
      background-color: ${color};
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.9);
      box-shadow: 0 0 8px ${color}, 0 0 16px ${color}50;
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
  });

// Get category color from config or fallback
const getCategoryColor = (category: string | null): string => {
  if (!category) return "#6B7280";
  const config = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG];
  return config?.color || "#6B7280";
};

// Map controls component for fullscreen
function MapControls({ isFullscreen, onToggleFullscreen }: { isFullscreen: boolean; onToggleFullscreen: () => void }) {
  const map = useMap();

  // Handle resize when fullscreen changes
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [isFullscreen, map]);

  return null;
}

interface Props {
  events: EventWithLocation[];
}

export default function MapView({ events }: Props) {
  const [mounted, setMounted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Client-side hydration pattern
    setMounted(true);
  }, []);

  // Handle escape key to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFullscreen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
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
      <div
        ref={containerRef}
        className={`
          rounded-lg overflow-hidden border border-[var(--twilight)] relative
          ${isFullscreen
            ? "fixed inset-0 z-50 rounded-none border-none"
            : "w-full h-[600px]"
          }
        `}
      >
        {/* Fullscreen toggle button */}
        <button
          onClick={toggleFullscreen}
          className="absolute top-3 right-3 z-[1000] p-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg hover:bg-[var(--twilight)] transition-colors"
          title={isFullscreen ? "Exit fullscreen (Esc)" : "Enter fullscreen"}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? (
            <svg className="w-5 h-5 text-[var(--cream)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-[var(--cream)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          )}
        </button>

        <MapContainer
          center={atlantaCenter}
          zoom={12}
          bounds={bounds || undefined}
          boundsOptions={{ padding: [50, 50] }}
          className="w-full h-full"
          scrollWheelZoom={true}
        >
          <MapControls isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} />
          <TileLayer
            attribution={DARK_MAP_TILES.attribution}
            url={DARK_MAP_TILES.url}
          />
          {mappableEvents.map((event) => {
            const color = getCategoryColor(event.category || null);
            const isLive = event.is_live || false;

            return (
              <Marker
                key={event.id}
                position={[event.venue!.lat!, event.venue!.lng!]}
                icon={createNeonIcon(color, isLive)}
              >
                <Popup className="dark-popup">
                  <div className="min-w-[200px] p-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Link
                        href={`/events/${event.id}`}
                        className="font-serif text-[var(--coral)] hover:text-[var(--rose)] transition-colors flex-1"
                      >
                        {event.title}
                      </Link>
                      {isLive && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[0.55rem] font-mono font-medium bg-[var(--neon-red)]/20 text-[var(--neon-red)] rounded">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--neon-red)] animate-pulse" />
                          LIVE
                        </span>
                      )}
                    </div>
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
            );
          })}
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
