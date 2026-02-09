"use client";

import { useEffect, useMemo, useState, useCallback, memo, useRef } from "react";
import Map, { Marker, Popup, NavigationControl, GeolocateControl } from "react-map-gl";
import type { MapRef, MapMouseEvent } from "react-map-gl";
import Link from "next/link";
import type { EventWithLocation } from "@/lib/search";
import type { Spot } from "@/lib/spots-constants";
import { MAPBOX_TOKEN, getMapStyle, ATLANTA_CENTER, DEFAULT_ZOOM } from "@/lib/map-config";
import { usePortal } from "@/lib/portal-context";
import MapPin from "@/components/map/MapPin";
import MapPopupCard from "@/components/map/MapPopupCard";
import MobileMapSheet from "@/components/map/MobileMapSheet";
import UserLocationDot from "@/components/map/UserLocationDot";
import ClusterLayer from "@/components/map/ClusterLayer";

import "mapbox-gl/dist/mapbox-gl.css";

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface Props {
  events: EventWithLocation[];
  spots?: Spot[];
  userLocation?: { lat: number; lng: number } | null;
  viewRadius?: number;
  centerPoint?: { lat: number; lng: number; radius?: number } | null;
  fitAllMarkers?: boolean;
  isFetching?: boolean;
  showMobileSheet?: boolean;
  onBoundsChange?: (bounds: MapBounds) => void;
  selectedItemId?: number | null;
  hoveredItemId?: number | null;
  onItemSelect?: (item: { type: "event" | "spot"; id: number } | null) => void;
}

// Zoom level for a given radius in miles
function getZoomForRadius(radiusMiles: number): number {
  if (radiusMiles <= 1) return 14;
  if (radiusMiles <= 2) return 13;
  if (radiusMiles <= 5) return 12;
  if (radiusMiles <= 10) return 11;
  return 10;
}

// Check if viewport is mobile width
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

// Build GeoJSON FeatureCollection from events and spots (for cluster layer)
function buildMarkerGeoJSON(events: EventWithLocation[], spots: Spot[]) {
  const eventFeatures = events.map((e) => ({
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [e.venue!.lng!, e.venue!.lat!],
    },
    properties: {
      id: e.id,
      title: e.title,
      category: e.category,
      venueType: e.venue?.venue_type || null,
      venueName: e.venue?.name || null,
      neighborhood: e.venue?.neighborhood || null,
      startTime: e.start_time || null,
      isAllDay: e.is_all_day || false,
      isLive: e.is_live || false,
      isFree: e.is_free || false,
      priceMin: e.price_min,
      priceMax: e.price_max,
      itemType: "event" as const,
    },
  }));

  const spotFeatures = spots.map((s) => ({
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [s.lng!, s.lat!],
    },
    properties: {
      id: s.id,
      title: s.name,
      category: s.venue_type || "venue",
      venueType: s.venue_type || null,
      venueName: s.name,
      neighborhood: s.neighborhood || null,
      startTime: null,
      isAllDay: false,
      isLive: false,
      isFree: false,
      priceMin: null,
      priceMax: null,
      itemType: "spot" as const,
    },
  }));

  return {
    type: "FeatureCollection" as const,
    features: [...eventFeatures, ...spotFeatures],
  };
}

// Memoized event marker
const EventMapMarker = memo(function EventMapMarker({
  event,
  onClick,
  isSelected,
  isHovered,
}: {
  event: EventWithLocation;
  onClick: (event: EventWithLocation) => void;
  isSelected?: boolean;
  isHovered?: boolean;
}) {
  const iconType = event.venue?.venue_type || event.category || null;
  const isLive = event.is_live || false;

  return (
    <Marker
      longitude={event.venue!.lng!}
      latitude={event.venue!.lat!}
      anchor="bottom"
      onClick={(e) => {
        e.originalEvent.stopPropagation();
        onClick(event);
      }}
    >
      <MapPin category={iconType} isLive={isLive} isSelected={isSelected} isHovered={isHovered} />
    </Marker>
  );
});

// Memoized spot marker
const SpotMapMarker = memo(function SpotMapMarker({
  spot,
  onClick,
  isSelected,
  isHovered,
}: {
  spot: Spot;
  onClick: (spot: Spot) => void;
  isSelected?: boolean;
  isHovered?: boolean;
}) {
  const iconType = spot.venue_type || "venue";

  return (
    <Marker
      longitude={spot.lng!}
      latitude={spot.lat!}
      anchor="bottom"
      onClick={(e) => {
        e.originalEvent.stopPropagation();
        onClick(spot);
      }}
    >
      <MapPin category={iconType} isSelected={isSelected} isHovered={isHovered} />
    </Marker>
  );
});

export default function MapView({ events, spots = [], userLocation, viewRadius, centerPoint, fitAllMarkers, isFetching, showMobileSheet = true, onBoundsChange, selectedItemId, hoveredItemId, onItemSelect }: Props) {
  const { portal } = usePortal();
  const isLightTheme = (portal.branding?.theme_mode as string) === "light";
  const mapStyle = getMapStyle(isLightTheme);
  const isMobile = useIsMobile();
  const mapRef = useRef<MapRef>(null);

  const [mounted, setMounted] = useState(false);
  const [localUserLocation, setLocalUserLocation] = useState<{ lat: number; lng: number } | null>(userLocation || null);
  const [selectedEvent, setSelectedEvent] = useState<EventWithLocation | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [initialFitDone, setInitialFitDone] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (userLocation) {
      setLocalUserLocation(userLocation);
    }
  }, [userLocation]);

  // Sync external selectedItemId to internal popup state (from drawer clicks)
  useEffect(() => {
    if (selectedItemId == null) return;
    // Check if it's already the selected item
    if (selectedEvent?.id === selectedItemId || selectedSpot?.id === selectedItemId) return;
    // Try to find and select the event or spot
    const event = events.find((e) => e.id === selectedItemId && e.venue?.lat && e.venue?.lng);
    if (event) {
      setSelectedSpot(null);
      setSelectedEvent(event);
      // Pan map to the item
      mapRef.current?.flyTo({ center: [event.venue!.lng!, event.venue!.lat!], duration: 500 });
      return;
    }
    const spot = spots.find((s) => s.id === selectedItemId && s.lat && s.lng);
    if (spot) {
      setSelectedEvent(null);
      setSelectedSpot(spot);
      mapRef.current?.flyTo({ center: [spot.lng!, spot.lat!], duration: 500 });
    }
  }, [selectedItemId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter events/spots with valid coordinates
  const mappableEvents = useMemo(
    () => events.filter((e) => e.venue?.lat && e.venue?.lng),
    [events]
  );

  const mappableSpots = useMemo(
    () => spots.filter((s) => s.lat && s.lng),
    [spots]
  );

  // Pick active spot center (venue with most events) as fallback
  const activeSpotCenter = useMemo((): { lat: number; lng: number } | null => {
    if (mappableEvents.length === 0) return null;
    const venueCounts = new globalThis.Map<string, { count: number; lat: number; lng: number }>();
    mappableEvents.forEach((e) => {
      if (e.venue?.lat && e.venue?.lng) {
        const key = `${e.venue.lat},${e.venue.lng}`;
        const existing = venueCounts.get(key);
        if (existing) existing.count++;
        else venueCounts.set(key, { count: 1, lat: e.venue.lat, lng: e.venue.lng });
      }
    });
    let maxCount = 0;
    let result: { lat: number; lng: number } | null = null;
    venueCounts.forEach((venue: { count: number; lat: number; lng: number }) => {
      if (venue.count > maxCount) {
        maxCount = venue.count;
        result = { lat: venue.lat, lng: venue.lng };
      }
    });
    return result;
  }, [mappableEvents]);

  // Compute initial view state
  const initialViewState = useMemo(() => {
    if (localUserLocation && viewRadius) {
      return {
        latitude: localUserLocation.lat,
        longitude: localUserLocation.lng,
        zoom: getZoomForRadius(viewRadius),
      };
    }
    if (localUserLocation) {
      return {
        latitude: localUserLocation.lat,
        longitude: localUserLocation.lng,
        zoom: 11,
      };
    }
    if (activeSpotCenter) {
      return {
        latitude: activeSpotCenter.lat,
        longitude: activeSpotCenter.lng,
        zoom: 13,
      };
    }
    return {
      latitude: ATLANTA_CENTER.latitude,
      longitude: ATLANTA_CENTER.longitude,
      zoom: DEFAULT_ZOOM,
    };
  }, [localUserLocation, viewRadius, activeSpotCenter]);

  // Emit current map bounds to parent
  const emitBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map || !onBoundsChange) return;
    const b = map.getBounds();
    if (!b) return;
    onBoundsChange({
      north: b.getNorth(),
      south: b.getSouth(),
      east: b.getEast(),
      west: b.getWest(),
    });
  }, [onBoundsChange]);

  // Fit map to markers/bounds after initial load
  const handleMapLoad = useCallback(() => {
    if (initialFitDone) return;
    const map = mapRef.current;
    if (!map) return;

    // GPS nearby mode
    if (localUserLocation && viewRadius) {
      setInitialFitDone(true);
      // Emit initial bounds after a tick (map needs to settle)
      setTimeout(emitBounds, 100);
      return; // Already centered via initialViewState
    }

    // Fit all markers mode
    if (fitAllMarkers) {
      const coords = [
        ...mappableEvents.map((e) => [e.venue!.lng!, e.venue!.lat!] as [number, number]),
        ...mappableSpots.map((s) => [s.lng!, s.lat!] as [number, number]),
      ];
      if (coords.length > 0) {
        const bounds = coords.reduce(
          (acc, [lng, lat]) => ({
            minLng: Math.min(acc.minLng, lng),
            maxLng: Math.max(acc.maxLng, lng),
            minLat: Math.min(acc.minLat, lat),
            maxLat: Math.max(acc.maxLat, lat),
          }),
          { minLng: Infinity, maxLng: -Infinity, minLat: Infinity, maxLat: -Infinity }
        );
        map.fitBounds(
          [[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]],
          { padding: 50, maxZoom: 14, duration: 800 }
        );
      }
      setInitialFitDone(true);
      return;
    }

    // Neighborhood mode
    if (centerPoint) {
      const neighborhoodRadius = centerPoint.radius || 1500;
      const earthRadius = 6371000;
      const latDelta = (neighborhoodRadius / earthRadius) * (180 / Math.PI);
      const lngDelta = (neighborhoodRadius / (earthRadius * Math.cos((centerPoint.lat * Math.PI) / 180))) * (180 / Math.PI);

      // Start with neighborhood bounds, extend to include markers
      let minLng = centerPoint.lng - lngDelta;
      let maxLng = centerPoint.lng + lngDelta;
      let minLat = centerPoint.lat - latDelta;
      let maxLat = centerPoint.lat + latDelta;

      [...mappableEvents, ...mappableSpots].forEach((item) => {
        const lat = "venue" in item ? item.venue?.lat : (item as Spot).lat;
        const lng = "venue" in item ? item.venue?.lng : (item as Spot).lng;
        if (lat && lng) {
          minLng = Math.min(minLng, lng);
          maxLng = Math.max(maxLng, lng);
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
        }
      });

      map.fitBounds(
        [[minLng, minLat], [maxLng, maxLat]],
        { padding: 40, maxZoom: 16, duration: 800 }
      );
      setInitialFitDone(true);
      return;
    }

    // Fit to all markers if no user location
    if (!localUserLocation) {
      const coords = [
        ...mappableEvents.map((e) => [e.venue!.lng!, e.venue!.lat!] as [number, number]),
        ...mappableSpots.map((s) => [s.lng!, s.lat!] as [number, number]),
      ];
      if (coords.length > 1) {
        const bounds = coords.reduce(
          (acc, [lng, lat]) => ({
            minLng: Math.min(acc.minLng, lng),
            maxLng: Math.max(acc.maxLng, lng),
            minLat: Math.min(acc.minLat, lat),
            maxLat: Math.max(acc.maxLat, lat),
          }),
          { minLng: Infinity, maxLng: -Infinity, minLat: Infinity, maxLat: -Infinity }
        );
        map.fitBounds(
          [[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]],
          { padding: 50, maxZoom: 14, duration: 800 }
        );
      }
    }
    setInitialFitDone(true);
  }, [initialFitDone, localUserLocation, viewRadius, fitAllMarkers, centerPoint, mappableEvents, mappableSpots, emitBounds]);

  // Handle cluster click — zoom to expansion zoom
  const handleClusterClick = useCallback((clusterId: number, lng: number, lat: number) => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("events");
    if (source && "getClusterExpansionZoom" in source) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (source as any).getClusterExpansionZoom(clusterId, (err: Error | null, zoom: number) => {
        if (!err) {
          map.easeTo({ center: [lng, lat], zoom, duration: 500 });
        }
      });
    }
  }, []);

  const handleEventClick = useCallback((event: EventWithLocation) => {
    setSelectedSpot(null);
    setSelectedEvent(event);
    onItemSelect?.({ type: "event", id: event.id });
  }, [onItemSelect]);

  const handleSpotClick = useCallback((spot: Spot) => {
    setSelectedEvent(null);
    setSelectedSpot(spot);
    onItemSelect?.({ type: "spot", id: spot.id });
  }, [onItemSelect]);

  // Cluster layer click handler
  const handleMapClick = useCallback((e: MapMouseEvent) => {
    const map = mapRef.current;
    if (!map) return;

    // Check for cluster click
    const clusterFeatures = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
    if (clusterFeatures.length > 0) {
      const clusterId = clusterFeatures[0].properties?.cluster_id;
      if (clusterId !== undefined) {
        const [lng, lat] = (clusterFeatures[0].geometry as GeoJSON.Point).coordinates;
        handleClusterClick(clusterId, lng, lat);
        return;
      }
    }

    // Check for unclustered point click
    const pointFeatures = map.queryRenderedFeatures(e.point, { layers: ["unclustered-point"] });
    if (pointFeatures.length > 0) {
      const props = pointFeatures[0].properties;
      if (props?.itemType === "event") {
        const event = mappableEvents.find((ev) => ev.id === props.id);
        if (event) { handleEventClick(event); return; }
      } else if (props?.itemType === "spot") {
        const spot = mappableSpots.find((s) => s.id === props.id);
        if (spot) { handleSpotClick(spot); return; }
      }
    }

    // Click on empty space -> dismiss selection
    setSelectedEvent(null);
    setSelectedSpot(null);
  }, [handleClusterClick, mappableEvents, mappableSpots, handleEventClick, handleSpotClick]);

  const handleClosePopup = useCallback(() => {
    setSelectedEvent(null);
    setSelectedSpot(null);
    onItemSelect?.(null);
  }, [onItemSelect]);

  // Build GeoJSON for cluster source (events + spots when clustering)
  const markerGeoJSON = useMemo(() => buildMarkerGeoJSON(mappableEvents, mappableSpots), [mappableEvents, mappableSpots]);

  // Early return skeleton
  if (!mounted) {
    return (
      <div className="w-full h-full bg-[var(--night)] rounded-lg border border-[var(--twilight)] relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] map-grid-lines" />
        <div className="absolute inset-0 skeleton-shimmer" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[var(--dusk)]/80 backdrop-blur-sm border border-[var(--twilight)]">
            <div className="w-4 h-4 rounded-full border-2 border-[var(--coral)] border-t-transparent animate-spin" />
            <span className="text-[var(--muted)] font-mono text-xs">Loading map</span>
          </div>
        </div>
      </div>
    );
  }

  // Use clusters when total markers would cause overlap
  const totalMarkers = mappableEvents.length + mappableSpots.length;
  const useClusterMode = totalMarkers > 20;

  return (
    <div className="w-full h-full rounded-lg overflow-hidden border border-[var(--twilight)] relative bg-[var(--void)]">
      <style>{`
        @keyframes mapPinPulse {
          0%, 100% { filter: drop-shadow(0 0 6px var(--pin-color, #E855A0)) drop-shadow(0 2px 4px rgba(0,0,0,0.5)); transform: scale(1); }
          50% { filter: drop-shadow(0 0 16px var(--pin-color, #E855A0)) drop-shadow(0 0 6px var(--pin-color, #E855A0)) drop-shadow(0 2px 4px rgba(0,0,0,0.5)); transform: scale(1.08); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes mapPinPulse { 0%, 100% { transform: none; } }
        }
        @keyframes userLocPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.4); opacity: 0.2; }
        }
        .mapboxgl-popup-content {
          background: transparent !important;
          padding: 0 !important;
          box-shadow: none !important;
          border-radius: 12px !important;
        }
        .mapboxgl-popup-tip {
          display: none !important;
        }
        .mapboxgl-popup-close-button {
          color: var(--muted, #8B8B94) !important;
          font-size: 16px !important;
          right: 6px !important;
          top: 6px !important;
          width: 24px !important;
          height: 24px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 6px !important;
          z-index: 10 !important;
        }
        .mapboxgl-popup-close-button:hover {
          color: var(--cream, #FAFAF9) !important;
          background: var(--twilight, #252530) !important;
        }
        .mapboxgl-ctrl-group {
          background: var(--dusk, #18181F) !important;
          border: 1px solid var(--twilight, #252530) !important;
          border-radius: 12px !important;
          overflow: hidden;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.45) !important;
        }
        .mapboxgl-ctrl-group button {
          background: transparent !important;
          border: 0 !important;
          width: 44px !important;
          height: 44px !important;
        }
        .mapboxgl-ctrl-group button + button {
          border-top: 1px solid var(--twilight, #252530) !important;
        }
        .mapboxgl-ctrl-group button .mapboxgl-ctrl-icon {
          filter: ${isLightTheme ? "none" : "invert(1)"};
        }
        .mapboxgl-ctrl-group button:hover .mapboxgl-ctrl-icon {
          filter: ${isLightTheme ? "none" : "invert(1) hue-rotate(340deg) brightness(1.4)"};
        }
        .mapboxgl-ctrl-geolocate {
          background: var(--dusk, #18181F) !important;
          border: 1px solid var(--twilight, #252530) !important;
          border-radius: 12px !important;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.45) !important;
          width: 44px !important;
          height: 44px !important;
        }
        .mapboxgl-ctrl-geolocate .mapboxgl-ctrl-icon {
          filter: ${isLightTheme ? "none" : "invert(1)"};
        }
        .mapboxgl-ctrl-attrib {
          background: var(--night, #0F0F14) !important;
          color: var(--muted, #8B8B94) !important;
        }
        .mapboxgl-ctrl-attrib a {
          color: var(--soft, #A1A1AA) !important;
        }
      `}</style>

      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={initialViewState}
        mapStyle={mapStyle}
        onLoad={handleMapLoad}
        onClick={handleMapClick}
        onMoveEnd={emitBounds}
        reuseMaps
        style={{ width: "100%", height: "100%" }}
        attributionControl={true}
        maxZoom={18}
        minZoom={8}
      >
        <NavigationControl position="top-right" showCompass={true} />
        <GeolocateControl position="top-right" trackUserLocation={false} />

        {/* Cluster layer for all markers when many */}
        {useClusterMode && (
          <ClusterLayer data={markerGeoJSON} onClusterClick={handleClusterClick} />
        )}

        {/* Individual event markers when few */}
        {!useClusterMode &&
          mappableEvents.map((event) => (
            <EventMapMarker
              key={event.id}
              event={event}
              onClick={handleEventClick}
              isSelected={event.id === selectedItemId}
              isHovered={event.id === hoveredItemId}
            />
          ))}

        {/* Individual spot markers when few */}
        {!useClusterMode &&
          mappableSpots.map((spot) => (
            <SpotMapMarker
              key={spot.id}
              spot={spot}
              onClick={handleSpotClick}
              isSelected={spot.id === selectedItemId}
              isHovered={spot.id === hoveredItemId}
            />
          ))}

        {/* User location dot */}
        {localUserLocation && (
          <Marker
            longitude={localUserLocation.lng}
            latitude={localUserLocation.lat}
            anchor="center"
          >
            <UserLocationDot />
          </Marker>
        )}

        {/* Desktop popup for selected event */}
        {!isMobile && selectedEvent && (
          <Popup
            longitude={selectedEvent.venue!.lng!}
            latitude={selectedEvent.venue!.lat!}
            anchor="bottom"
            onClose={handleClosePopup}
            closeOnClick={false}
            offset={[0, -44]}
            maxWidth="320px"
          >
            <MapPopupCard
              type="event"
              id={selectedEvent.id}
              title={selectedEvent.title}
              category={selectedEvent.category}
              venueName={selectedEvent.venue?.name || null}
              neighborhood={selectedEvent.venue?.neighborhood || null}
              startTime={selectedEvent.start_time}
              isAllDay={selectedEvent.is_all_day}
              isLive={selectedEvent.is_live}
              isFree={selectedEvent.is_free}
              priceMin={selectedEvent.price_min}
              priceMax={selectedEvent.price_max}
              portalSlug={portal.slug}
            />
          </Popup>
        )}

        {/* Desktop popup for selected spot */}
        {!isMobile && selectedSpot && (
          <Popup
            longitude={selectedSpot.lng!}
            latitude={selectedSpot.lat!}
            anchor="bottom"
            onClose={handleClosePopup}
            closeOnClick={false}
            offset={[0, -44]}
            maxWidth="300px"
          >
            <MapPopupCard
              type="spot"
              slug={selectedSpot.slug}
              name={selectedSpot.name}
              venueType={selectedSpot.venue_type}
              address={selectedSpot.address}
              neighborhood={selectedSpot.neighborhood}
              portalSlug={portal.slug}
            />
          </Popup>
        )}
      </Map>

      {/* Mobile bottom sheet (only when no external bottom sheet is handling it) */}
      {showMobileSheet && isMobile && (selectedEvent || selectedSpot) && (
        <MobileMapSheet
          event={selectedEvent}
          spot={selectedSpot}
          portalSlug={portal.slug}
          onClose={handleClosePopup}
        />
      )}

      {/* Loading indicator during refetch */}
      {isFetching && mappableEvents.length > 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--dusk)]/90 backdrop-blur-sm border border-[var(--twilight)] shadow-lg">
            <div className="w-3 h-3 rounded-full border-2 border-[var(--coral)] border-t-transparent animate-spin" />
            <span className="text-[var(--muted)] font-mono text-[11px]">Updating</span>
          </div>
        </div>
      )}

      {/* Empty state — floating card at bottom, map stays visible */}
      {!isFetching && mappableEvents.length === 0 && mappableSpots.length === 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-[var(--twilight)]/70 bg-[var(--dusk)]/90 backdrop-blur-sm shadow-lg">
            <svg className="w-5 h-5 text-[var(--coral)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span className="text-[var(--cream)] text-sm whitespace-nowrap">No events found</span>
            <Link
              href={`/${portal.slug}?view=find&type=events&display=map`}
              className="flex-shrink-0 px-2.5 py-1 rounded-full bg-[var(--coral)] text-[var(--void)] text-xs font-mono font-medium hover:bg-[var(--rose)] transition-colors"
            >
              Clear filters
            </Link>
          </div>
        </div>
      )}

      {/* Loading overlay when fetching with no data */}
      {isFetching && mappableEvents.length === 0 && mappableSpots.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[var(--dusk)]/80 backdrop-blur-sm border border-[var(--twilight)]">
            <div className="w-4 h-4 rounded-full border-2 border-[var(--coral)] border-t-transparent animate-spin" />
            <span className="text-[var(--muted)] font-mono text-xs">Loading events</span>
          </div>
        </div>
      )}
    </div>
  );
}
