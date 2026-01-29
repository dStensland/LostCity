"use client";

import { useEffect, useMemo, useState, memo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import Link from "next/link";
import type { EventWithLocation } from "@/lib/search";
import type { Spot } from "@/lib/spots";
import { getMapTiles } from "@/lib/map-config";
import { usePortal } from "@/lib/portal-context";
import { CATEGORY_CONFIG } from "./CategoryIcon";
import { formatTime } from "@/lib/formats";

// Fix for default marker icons in Leaflet with webpack
import "leaflet/dist/leaflet.css";

// Icon cache to prevent recreation on every render
const iconCache = new Map<string, L.DivIcon>();
const clusterIconCache = new Map<number, L.DivIcon>();

// SVG paths for category and spot type icons (simplified for map markers)
const ICON_PATHS: Record<string, string> = {
  // Event categories
  music: "M9 18V5l12-2v13M6 18a3 3 0 100-6 3 3 0 000 6zM18 16a3 3 0 100-6 3 3 0 000 6z",
  film: "M7 4v16M17 4v16M3 8h18M3 12h18M3 16h18M4 20h16c.55 0 1-.45 1-1V5c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v14c0 .55.45 1 1 1z",
  comedy: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01",
  theater: "M4 3h16v4c0 4-3.5 7-8 7S4 11 4 7V3zM12 14v4M8 21h8",
  art: "M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5zM2 2l7.586 7.586",
  sports: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07",
  food_drink: "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z",
  nightlife: "M17 8l4-4H3l4 4M12 4v16M9 20h6",
  community: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  fitness: "M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z",
  family: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  meetup: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z",
  words: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  learning: "M12 14l9-5-9-5-9 5 9 5zM12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z",
  dance: "M9 18V5l12-2v13M6 18a3 3 0 100-6 3 3 0 000 6zM18 16a3 3 0 100-6 3 3 0 000 6z",
  tours: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z",
  religious: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  markets: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z",
  wellness: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  gaming: "M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z",
  outdoors: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",

  // Spot types (venue types)
  music_venue: "M9 18V5l12-2v13M6 18a3 3 0 100-6 3 3 0 000 6zM18 16a3 3 0 100-6 3 3 0 000 6z",
  bar: "M17 8l4-4H3l4 4M12 4v16M9 20h6",
  restaurant: "M3 2l2.5 18h13L21 2M12 2v6m0 0c-1.5 0-3 1-3 3s1.5 3 3 3 3-1 3-3-1.5-3-3-3z",
  coffee_shop: "M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3",
  brewery: "M17 8l4-4H3l4 4M12 4v16M9 20h6",
  gallery: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  club: "M17 8l4-4H3l4 4M12 4v16M9 20h6",
  arena: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM12 2v20M2 12h20",
  comedy_club: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01",
  museum: "M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3",
  convention_center: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  games: "M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z",
  bookstore: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  library: "M8 14v3M12 14v3M16 14v3M3 21h18M3 10h18M3 7l9-4 9 4",
  cinema: "M7 4v16M17 4v16M3 8h18M3 12h18M3 16h18M4 20h16c.55 0 1-.45 1-1V5c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v14c0 .55.45 1 1 1z",
  park: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  garden: "M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 10c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zM12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42",
  venue: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z",
  food_hall: "M3 2l2.5 18h13L21 2M12 2v6m0 0c-1.5 0-3 1-3 3s1.5 3 3 3 3-1 3-3-1.5-3-3-3z",
  farmers_market: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z",
};

// Theme-aware styles for Leaflet popups
const getMapStyles = (isLight: boolean) => `
  .leaflet-container {
    background: ${isLight ? '#F3F4F6' : '#0F0F14'} !important;
  }
  .leaflet-popup-content-wrapper {
    background: var(--dusk, ${isLight ? '#F9FAFB' : '#18181F'});
    border: 1px solid var(--twilight, ${isLight ? '#E5E7EB' : '#252530'});
    border-radius: 8px;
    box-shadow: 0 4px 6px -1px ${isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.4)'};
    padding: 0;
  }
  .leaflet-popup-content {
    margin: 0 !important;
  }
  .leaflet-popup-tip {
    background: var(--dusk, ${isLight ? '#F9FAFB' : '#18181F'});
    border-left: 1px solid var(--twilight, ${isLight ? '#E5E7EB' : '#252530'});
    border-bottom: 1px solid var(--twilight, ${isLight ? '#E5E7EB' : '#252530'});
  }
  .leaflet-popup-close-button {
    color: var(--muted, ${isLight ? '#6b7280' : '#8B8B94'}) !important;
    top: 4px !important;
    right: 4px !important;
  }
  .leaflet-popup-close-button:hover {
    color: var(--cream, ${isLight ? '#1a1a1a' : '#FAFAF9'}) !important;
  }
  .leaflet-control-attribution {
    background: var(--night, ${isLight ? '#F3F4F6' : '#0F0F14'}) !important;
    color: var(--muted, ${isLight ? '#6b7280' : '#8B8B94'}) !important;
  }
  .leaflet-control-attribution a {
    color: var(--soft, ${isLight ? '#4b5563' : '#A1A1AA'}) !important;
  }

  /* Marker styles - minimal transitions to prevent jitter */
  .neon-marker {
    cursor: pointer;
  }
  .neon-marker:hover {
    z-index: 1000 !important;
  }

  /* Live event pulse animation - subtle */
  @keyframes marker-pulse {
    0%, 100% {
      box-shadow: 0 0 6px var(--marker-color);
    }
    50% {
      box-shadow: 0 0 12px var(--marker-color), 0 0 20px var(--marker-color);
    }
  }
  .marker-live {
    animation: marker-pulse 2s ease-in-out infinite;
  }

  /* Enhanced popup styling */
  .leaflet-popup-content-wrapper {
    border-radius: 12px !important;
    overflow: hidden;
  }
  .leaflet-popup-content {
    min-width: 240px;
  }
  .leaflet-popup-close-button {
    width: 24px !important;
    height: 24px !important;
    font-size: 18px !important;
    padding: 4px !important;
  }

  /* User location marker pulse */
  @keyframes user-pulse {
    0%, 100% {
      box-shadow: 0 0 10px var(--neon-cyan), 0 0 20px var(--neon-cyan);
    }
    50% {
      box-shadow: 0 0 15px var(--neon-cyan), 0 0 30px var(--neon-cyan), 0 0 45px var(--neon-cyan);
    }
  }
  .user-location-marker > div {
    animation: user-pulse 2s ease-in-out infinite;
  }

  /* Cluster marker styles - no transitions to prevent jitter */
  .custom-cluster {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px !important;
    height: 40px !important;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--coral) 0%, var(--neon-magenta) 100%);
    border: 3px solid rgba(255, 255, 255, 0.9);
    box-shadow: 0 0 15px rgba(232, 145, 45, 0.4), 0 2px 8px rgba(0,0,0,0.3);
    font-family: var(--font-mono);
    font-size: 14px;
    font-weight: bold;
    color: var(--void);
  }
  .custom-cluster:hover {
    z-index: 1000 !important;
  }
  .custom-cluster-large {
    width: 50px !important;
    height: 50px !important;
    font-size: 16px;
  }
`;

// Default map pin icon when no category icon found
const DEFAULT_ICON_PATH = "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z";

// Neon marker with glow effect and category icon - uses caching to prevent jitter
const createNeonIcon = (color: string, iconType: string | null, isLive: boolean = false): L.DivIcon => {
  // Create a cache key from the parameters
  const cacheKey = `${color}-${iconType || 'default'}-${isLive}`;

  // Return cached icon if available
  const cached = iconCache.get(cacheKey);
  if (cached) return cached;

  // Try to get icon path, normalize to lowercase for matching
  const normalizedType = iconType?.toLowerCase().replace(/-/g, "_");
  const iconPath = normalizedType && ICON_PATHS[normalizedType]
    ? ICON_PATHS[normalizedType]
    : DEFAULT_ICON_PATH;

  const icon = L.divIcon({
    className: `neon-marker ${isLive ? "marker-live" : ""}`,
    html: `<div style="
      --marker-color: ${color};
      background-color: ${color};
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.9);
      box-shadow: 0 0 6px ${color}80;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: none; stroke: rgba(0,0,0,0.8); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;">
        <path d="${iconPath}"/>
      </svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });

  // Cache for reuse
  iconCache.set(cacheKey, icon);
  return icon;
};

// Get category color from config or fallback
const getCategoryColor = (iconType: string | null): string => {
  if (!iconType) return "#E855A0"; // Neon magenta fallback
  // Normalize to lowercase and replace hyphens with underscores for matching
  const normalizedType = iconType.toLowerCase().replace(/-/g, "_");
  const config = CATEGORY_CONFIG[normalizedType as keyof typeof CATEGORY_CONFIG];
  return config?.color || "#E855A0"; // Neon magenta fallback
};

// Create custom cluster icon with caching
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createClusterIcon = (cluster: any): L.DivIcon => {
  const count = cluster.getChildCount();

  // Cache by count to avoid recreation
  const cached = clusterIconCache.get(count);
  if (cached) return cached;

  const sizeClass = count > 50 ? "custom-cluster-large" : "";
  const icon = L.divIcon({
    html: `<div class="custom-cluster ${sizeClass}">${count}</div>`,
    className: "",
    iconSize: L.point(40, 40, true),
  });

  clusterIconCache.set(count, icon);
  return icon;
};

// Map resize helper
function MapResizer() {
  const map = useMap();

  useEffect(() => {
    // Invalidate size after mount
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [map]);

  return null;
}

interface Props {
  events: EventWithLocation[];
  spots?: Spot[];
  userLocation?: { lat: number; lng: number } | null;
  // View radius in miles for GPS mode - will constrain map to this radius around user
  viewRadius?: number;
}

// Memoized single event marker to prevent re-renders
interface EventMarkerProps {
  event: EventWithLocation;
  portalSlug: string;
}

const EventMarker = memo(function EventMarker({ event, portalSlug }: EventMarkerProps) {
  const iconType = event.venue?.venue_type || event.category || null;
  const color = getCategoryColor(iconType);
  const isLive = event.is_live || false;

  return (
    <Marker
      position={[event.venue!.lat!, event.venue!.lng!]}
      icon={createNeonIcon(color, iconType, isLive)}
    >
      <Popup className="dark-popup">
        <div
          className="min-w-[240px] p-4 rounded-lg"
          style={{
            borderLeft: `4px solid ${color}`,
            background: `linear-gradient(135deg, ${color}08 0%, transparent 50%)`,
          }}
        >
          {/* Category badge */}
          <div className="flex items-center justify-between mb-2">
            {event.category && (
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[0.55rem] font-mono font-medium uppercase tracking-wide rounded"
                style={{
                  backgroundColor: `${color}20`,
                  color: color,
                }}
              >
                {event.category.replace(/_/g, " ")}
              </span>
            )}
            {isLive && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[0.55rem] font-mono font-medium bg-[var(--neon-red)]/20 text-[var(--neon-red)] rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--neon-red)] animate-pulse" />
                LIVE
              </span>
            )}
          </div>

          {/* Title */}
          <Link
            href={`/${portalSlug}?event=${event.id}`}
            scroll={false}
            className="block font-medium text-sm text-[var(--cream)] hover:text-[var(--coral)] transition-colors line-clamp-2 mb-2"
          >
            {event.title}
          </Link>

          {/* Venue name */}
          <div className="flex items-center gap-1.5 text-[0.7rem] text-[var(--soft)] mb-1">
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <span className="truncate">{event.venue?.name}</span>
          </div>

          {/* Time and neighborhood */}
          <div className="flex items-center gap-1.5 font-mono text-[0.65rem] text-[var(--muted)]">
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[var(--cream)]">
              {formatTime(event.start_time)}
            </span>
            {event.venue?.neighborhood && (
              <>
                <span className="opacity-40">·</span>
                <span className="truncate">{event.venue.neighborhood}</span>
              </>
            )}
          </div>

          {/* Price badge */}
          <div className="mt-3 flex items-center gap-2">
            {event.is_free ? (
              <span className="inline-block px-2 py-0.5 text-[0.6rem] font-mono font-medium bg-[var(--neon-green)]/20 text-[var(--neon-green)] rounded">
                FREE
              </span>
            ) : event.price_min !== null && (
              <span className="inline-block px-2 py-0.5 text-[0.6rem] font-mono font-medium bg-[var(--gold)]/20 text-[var(--gold)] rounded">
                ${event.price_min}{event.price_max && event.price_max !== event.price_min ? `–$${event.price_max}` : "+"}
              </span>
            )}
            <Link
              href={`/${portalSlug}?event=${event.id}`}
              scroll={false}
              className="ml-auto text-[0.6rem] font-mono text-[var(--coral)] hover:underline"
            >
              View details →
            </Link>
          </div>
        </div>
      </Popup>
    </Marker>
  );
});

// Memoized markers container - only re-renders when events array changes
interface EventMarkersProps {
  events: EventWithLocation[];
  portalSlug: string;
}

const EventMarkers = memo(function EventMarkers({ events, portalSlug }: EventMarkersProps) {
  return (
    <MarkerClusterGroup
      chunkedLoading
      iconCreateFunction={createClusterIcon}
      maxClusterRadius={50}
      spiderfyOnMaxZoom={true}
      showCoverageOnHover={false}
      animate={true}
      animateAddingMarkers={false}
      disableClusteringAtZoom={16}
      zoomToBoundsOnClick={true}
      spiderfyDistanceMultiplier={1.5}
    >
      {events.map((event) => (
        <EventMarker key={event.id} event={event} portalSlug={portalSlug} />
      ))}
    </MarkerClusterGroup>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if events array length or IDs change
  if (prevProps.events.length !== nextProps.events.length) return false;
  if (prevProps.portalSlug !== nextProps.portalSlug) return false;
  // Check if event IDs are the same (shallow comparison)
  for (let i = 0; i < prevProps.events.length; i++) {
    if (prevProps.events[i].id !== nextProps.events[i].id) return false;
  }
  return true;
});

// Memoized single spot marker to prevent re-renders
interface SpotMarkerProps {
  spot: Spot;
  portalSlug: string;
}

const SpotMarker = memo(function SpotMarker({ spot, portalSlug }: SpotMarkerProps) {
  const iconType = spot.venue_type || "venue";
  const color = getCategoryColor(iconType);

  return (
    <Marker
      position={[spot.lat!, spot.lng!]}
      icon={createNeonIcon(color, iconType, false)}
    >
      <Popup className="dark-popup">
        <div
          className="min-w-[200px] p-4 rounded-lg"
          style={{
            borderLeft: `4px solid ${color}`,
            background: `linear-gradient(135deg, ${color}08 0%, transparent 50%)`,
          }}
        >
          {/* Venue type badge */}
          <div className="flex items-center justify-between mb-2">
            {spot.venue_type && (
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[0.55rem] font-mono font-medium uppercase tracking-wide rounded"
                style={{
                  backgroundColor: `${color}20`,
                  color: color,
                }}
              >
                {spot.venue_type.replace(/_/g, " ")}
              </span>
            )}
            <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[0.55rem] font-mono font-medium bg-[var(--neon-green)]/20 text-[var(--neon-green)] rounded">
              OPEN
            </span>
          </div>

          {/* Name */}
          <Link
            href={`/${portalSlug}/spots/${spot.slug}`}
            className="block font-medium text-sm text-[var(--cream)] hover:text-[var(--coral)] transition-colors line-clamp-2 mb-2"
          >
            {spot.name}
          </Link>

          {/* Address */}
          {spot.address && (
            <div className="flex items-center gap-1.5 text-[0.7rem] text-[var(--soft)] mb-1">
              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              <span className="truncate">{spot.address}</span>
            </div>
          )}

          {/* Neighborhood */}
          {spot.neighborhood && (
            <div className="flex items-center gap-1.5 font-mono text-[0.65rem] text-[var(--muted)]">
              <span className="truncate">{spot.neighborhood}</span>
            </div>
          )}

          {/* View link */}
          <div className="mt-3">
            <Link
              href={`/${portalSlug}/spots/${spot.slug}`}
              className="text-[0.6rem] font-mono text-[var(--coral)] hover:underline"
            >
              View details →
            </Link>
          </div>
        </div>
      </Popup>
    </Marker>
  );
});

// Memoized spots markers container
interface SpotMarkersProps {
  spots: Spot[];
  portalSlug: string;
}

const SpotMarkers = memo(function SpotMarkers({ spots, portalSlug }: SpotMarkersProps) {
  return (
    <MarkerClusterGroup
      chunkedLoading
      iconCreateFunction={createClusterIcon}
      maxClusterRadius={50}
      spiderfyOnMaxZoom={true}
      showCoverageOnHover={false}
      animate={true}
      animateAddingMarkers={false}
      disableClusteringAtZoom={16}
      zoomToBoundsOnClick={true}
      spiderfyDistanceMultiplier={1.5}
    >
      {spots.map((spot) => (
        <SpotMarker key={spot.id} spot={spot} portalSlug={portalSlug} />
      ))}
    </MarkerClusterGroup>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if spots array length or IDs change
  if (prevProps.spots.length !== nextProps.spots.length) return false;
  if (prevProps.portalSlug !== nextProps.portalSlug) return false;
  for (let i = 0; i < prevProps.spots.length; i++) {
    if (prevProps.spots[i].id !== nextProps.spots[i].id) return false;
  }
  return true;
});

export default function MapView({ events, spots = [], userLocation, viewRadius }: Props) {
  const { portal } = usePortal();
  const isLightTheme = (portal.branding?.theme_mode as string) === "light";
  const mapTiles = getMapTiles(isLightTheme);
  const mapStyles = getMapStyles(isLightTheme);

  const [mounted, setMounted] = useState(false);
  const [localUserLocation, setLocalUserLocation] = useState<{ lat: number; lng: number } | null>(userLocation || null);

  // All hooks must be called before any early returns
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR hydration pattern
    setMounted(true);
  }, []);

  useEffect(() => {
    if (userLocation) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync external prop to local state
      setLocalUserLocation(userLocation);
    }
  }, [userLocation]);

  // Filter events with valid coordinates
  const mappableEvents = useMemo(
    () => events.filter((e) => e.venue?.lat && e.venue?.lng),
    [events]
  );

  // Filter spots with valid coordinates
  const mappableSpots = useMemo(
    () => spots.filter((s) => s.lat && s.lng),
    [spots]
  );

  // Pick an active spot (venue with most events) as fallback center
  const activeSpotCenter = useMemo((): [number, number] | null => {
    if (mappableEvents.length === 0) return null;

    // Count events per venue
    const venueCounts = new Map<string, { count: number; lat: number; lng: number; name: string }>();
    mappableEvents.forEach((e) => {
      if (e.venue?.lat && e.venue?.lng) {
        const key = `${e.venue.lat},${e.venue.lng}`;
        const existing = venueCounts.get(key);
        if (existing) {
          existing.count++;
        } else {
          venueCounts.set(key, { count: 1, lat: e.venue.lat, lng: e.venue.lng, name: e.venue.name || "" });
        }
      }
    });

    // Find venue with most events
    let maxCount = 0;
    let activeLat = 0;
    let activeLng = 0;
    let found = false;

    venueCounts.forEach((venue) => {
      if (venue.count > maxCount) {
        maxCount = venue.count;
        activeLat = venue.lat;
        activeLng = venue.lng;
        found = true;
      }
    });

    return found ? [activeLat, activeLng] : null;
  }, [mappableEvents]);

  // Default Atlanta center (Ponce City Market area - active hub)
  const ATLANTA_DEFAULT: [number, number] = [33.7725, -84.3655];

  // Use user location, or active spot, or Atlanta default
  const mapCenter: [number, number] = localUserLocation
    ? [localUserLocation.lat, localUserLocation.lng]
    : activeSpotCenter || ATLANTA_DEFAULT;

  // Calculate zoom level based on view radius
  // Approximate: zoom 14 = ~1mi, 13 = ~2mi, 12 = ~5mi, 11 = ~10mi, 10 = ~20mi
  const getZoomForRadius = (radiusMiles: number): number => {
    if (radiusMiles <= 1) return 14;
    if (radiusMiles <= 2) return 13;
    if (radiusMiles <= 5) return 12;
    if (radiusMiles <= 10) return 11;
    return 10;
  };

  // Zoom level: use viewRadius if provided, otherwise defaults
  const defaultZoom = localUserLocation && viewRadius
    ? getZoomForRadius(viewRadius)
    : localUserLocation
      ? 11
      : (activeSpotCenter ? 13 : 12);

  // Calculate bounds from both events and spots (but don't auto-fit if user has location with radius)
  const allMarkerCoords: [number, number][] = [
    ...mappableEvents.map((e) => [e.venue!.lat!, e.venue!.lng!] as [number, number]),
    ...mappableSpots.map((s) => [s.lat!, s.lng!] as [number, number]),
  ];

  const bounds =
    allMarkerCoords.length > 0 && !localUserLocation
      ? L.latLngBounds(allMarkerCoords)
      : null;

  // Early return AFTER all hooks
  if (!mounted) {
    return (
      <div className="w-full h-full bg-[var(--night)] rounded-lg flex items-center justify-center border border-[var(--twilight)]">
        <p className="text-[var(--muted)] font-mono text-sm">Loading map...</p>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: mapStyles }} />
      <div className="w-full h-full rounded-lg overflow-hidden border border-[var(--twilight)] relative bg-[var(--void)]">
        <MapContainer
          center={mapCenter}
          zoom={defaultZoom}
          bounds={!localUserLocation && bounds ? bounds : undefined}
          boundsOptions={{ padding: [50, 50] }}
          className="w-full h-full"
          style={{ background: 'var(--void)' }}
          scrollWheelZoom={true}
          zoomAnimation={true}
          fadeAnimation={true}
          markerZoomAnimation={true}
          zoomSnap={0.5}
          zoomDelta={0.5}
          wheelPxPerZoomLevel={120}
        >
          <MapResizer />
          <TileLayer
            attribution={mapTiles.attribution}
            url={mapTiles.url}
          />
          <EventMarkers events={mappableEvents} portalSlug={portal.slug} />
          {mappableSpots.length > 0 && (
            <SpotMarkers spots={mappableSpots} portalSlug={portal.slug} />
          )}
          {/* User location marker */}
          {localUserLocation && (
            <Marker
              position={[localUserLocation.lat, localUserLocation.lng]}
              icon={L.divIcon({
                className: "user-location-marker",
                html: `<div style="
                  width: 16px;
                  height: 16px;
                  background: var(--neon-cyan);
                  border: 3px solid white;
                  border-radius: 50%;
                  box-shadow: 0 0 10px var(--neon-cyan), 0 0 20px var(--neon-cyan);
                "></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              })}
            />
          )}
        </MapContainer>
        {mappableEvents.length === 0 && mappableSpots.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--void)]/80">
            <p className="text-[var(--muted)] font-mono text-sm">Nothing to see here. Literally.</p>
          </div>
        )}
      </div>
    </>
  );
}
