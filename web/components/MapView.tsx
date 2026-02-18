"use client";

import { useEffect, useMemo, useState, useCallback, memo, useRef } from "react";
import Map, { Marker, Popup, NavigationControl, GeolocateControl } from "react-map-gl";
import type { MapRef } from "react-map-gl";
import Link from "next/link";
import type { EventWithLocation } from "@/lib/search";
import type { Spot } from "@/lib/spots-constants";
import { MAPBOX_TOKEN, getMapStyle, ATLANTA_CENTER, DEFAULT_ZOOM } from "@/lib/map-config";
import { usePortal } from "@/lib/portal-context";
import MapPin from "@/components/map/MapPin";
import ClusterPin from "@/components/map/ClusterPin";
import MapPopupCard from "@/components/map/MapPopupCard";
import MobileMapSheet from "@/components/map/MobileMapSheet";
import UserLocationDot from "@/components/map/UserLocationDot";
import styles from "@/components/map/MapView.module.css";

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

interface MarkerPoint {
  id: number;
  itemType: "event" | "spot";
  lng: number;
  lat: number;
  category: string | null;
  isLive: boolean;
}

type RenderMarker =
  | { kind: "point"; key: string; point: MarkerPoint }
  | { kind: "cluster"; key: string; lng: number; lat: number; count: number };

function toFiniteCoordinate(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function getEventCoordinates(event: EventWithLocation): [number, number] | null {
  const lat = toFiniteCoordinate(event.venue?.lat);
  const lng = toFiniteCoordinate(event.venue?.lng);
  if (lat == null || lng == null) return null;
  return [lng, lat];
}

function getSpotCoordinates(spot: Spot): [number, number] | null {
  const lat = toFiniteCoordinate(spot.lat);
  const lng = toFiniteCoordinate(spot.lng);
  if (lat == null || lng == null) return null;
  return [lng, lat];
}

function getZoomForRadius(radiusMiles: number): number {
  if (radiusMiles <= 1) return 14;
  if (radiusMiles <= 2) return 13;
  if (radiusMiles <= 5) return 12;
  if (radiusMiles <= 10) return 11;
  return 10;
}

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
  const coords = getEventCoordinates(event);
  if (!coords) return null;

  return (
    <Marker
      longitude={coords[0]}
      latitude={coords[1]}
      anchor="bottom"
      onClick={(e) => {
        e.originalEvent.stopPropagation();
        onClick(event);
      }}
    >
      <MapPin
        category={event.venue?.venue_type || event.category || null}
        isLive={event.is_live || false}
        isSelected={isSelected}
        isHovered={isHovered}
      />
    </Marker>
  );
});

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
  const coords = getSpotCoordinates(spot);
  if (!coords) return null;

  return (
    <Marker
      longitude={coords[0]}
      latitude={coords[1]}
      anchor="bottom"
      onClick={(e) => {
        e.originalEvent.stopPropagation();
        onClick(spot);
      }}
    >
      <MapPin
        category={spot.venue_type || "venue"}
        isSelected={isSelected}
        isHovered={isHovered}
      />
    </Marker>
  );
});

export default function MapView({
  events,
  spots = [],
  userLocation,
  viewRadius,
  centerPoint,
  fitAllMarkers,
  isFetching,
  showMobileSheet = true,
  onBoundsChange,
  selectedItemId,
  hoveredItemId,
  onItemSelect,
}: Props) {
  const { portal } = usePortal();
  const isLightTheme = (portal.branding?.theme_mode as string) === "light";
  const mapStyle = getMapStyle(isLightTheme);
  const isMobile = useIsMobile();
  const mapRef = useRef<MapRef>(null);

  const [mounted, setMounted] = useState(false);
  const [mapSupported, setMapSupported] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [viewTick, setViewTick] = useState(0);
  const [localUserLocation, setLocalUserLocation] = useState<{ lat: number; lng: number } | null>(userLocation || null);
  const [selectedEvent, setSelectedEvent] = useState<EventWithLocation | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [initialFitDone, setInitialFitDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setMounted(true);
    // @ts-expect-error - Dynamic CSS import
    import("mapbox-gl/dist/mapbox-gl.css");
    void import("mapbox-gl")
      .then((mod) => {
        if (cancelled) return;
        const candidate = (mod as { default?: { supported?: (opts?: unknown) => boolean }; supported?: (opts?: unknown) => boolean });
        const supported =
          candidate?.supported ?? candidate?.default?.supported;
        if (typeof supported === "function" && !supported({ failIfMajorPerformanceCaveat: false })) {
          setMapSupported(false);
        }
      })
      .catch(() => {
        // Keep default; onError handler below will catch runtime failures.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (userLocation) {
      setLocalUserLocation(userLocation);
    }
  }, [userLocation]);

  const mappableEvents = useMemo(
    () => events.filter((event) => getEventCoordinates(event) !== null),
    [events]
  );

  const mappableSpots = useMemo(
    () => spots.filter((spot) => getSpotCoordinates(spot) !== null),
    [spots]
  );

  useEffect(() => {
    if (selectedItemId == null) return;
    if (selectedEvent?.id === selectedItemId || selectedSpot?.id === selectedItemId) return;

    const event = mappableEvents.find((item) => item.id === selectedItemId);
    if (event) {
      const coords = getEventCoordinates(event);
      if (!coords) return;
      const map = mapRef.current;
      if (map) {
        map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 14), duration: 520 });
      }
      setSelectedSpot(null);
      setSelectedEvent(event);
      return;
    }

    const spot = mappableSpots.find((item) => item.id === selectedItemId);
    if (spot) {
      const coords = getSpotCoordinates(spot);
      if (!coords) return;
      const map = mapRef.current;
      if (map) {
        map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 14), duration: 520 });
      }
      setSelectedEvent(null);
      setSelectedSpot(spot);
    }
  }, [selectedEvent?.id, selectedSpot?.id, selectedItemId, mappableEvents, mappableSpots]);

  const markerPoints = useMemo<MarkerPoint[]>(() => {
    const eventPoints = mappableEvents.flatMap((event) => {
      const coords = getEventCoordinates(event);
      if (!coords) return [];
      return [{
        id: event.id,
        itemType: "event" as const,
        lng: coords[0],
        lat: coords[1],
        category: event.venue?.venue_type || event.category || null,
        isLive: !!event.is_live,
      }];
    });

    const spotPoints = mappableSpots.flatMap((spot) => {
      const coords = getSpotCoordinates(spot);
      if (!coords) return [];
      return [{
        id: spot.id,
        itemType: "spot" as const,
        lng: coords[0],
        lat: coords[1],
        category: spot.venue_type || "venue",
        isLive: false,
      }];
    });

    return [...eventPoints, ...spotPoints];
  }, [mappableEvents, mappableSpots]);

  const activeSpotCenter = useMemo((): { lat: number; lng: number } | null => {
    if (mappableEvents.length === 0) return null;

    const venueCounts = new globalThis.Map<string, { count: number; lat: number; lng: number }>();

    mappableEvents.forEach((event) => {
      const coords = getEventCoordinates(event);
      if (!coords) return;
      const key = `${coords[1]},${coords[0]}`;
      const existing = venueCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        venueCounts.set(key, { count: 1, lat: coords[1], lng: coords[0] });
      }
    });

    let maxCount = 0;
    let result: { lat: number; lng: number } | null = null;
    venueCounts.forEach((venue) => {
      if (venue.count > maxCount) {
        maxCount = venue.count;
        result = { lat: venue.lat, lng: venue.lng };
      }
    });

    return result;
  }, [mappableEvents]);

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

  const emitBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map || !onBoundsChange) return;
    const bounds = map.getBounds();
    if (!bounds) return;

    onBoundsChange({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    });
  }, [onBoundsChange]);

  const markerCoordinates = useMemo(
    () => markerPoints.map((point) => [point.lng, point.lat] as [number, number]),
    [markerPoints]
  );

  const handleMapLoad = useCallback(() => {
    setMapReady(true);
    setViewTick((value) => value + 1);

    if (initialFitDone) return;

    const map = mapRef.current;
    if (!map) return;

    if (localUserLocation && viewRadius) {
      setInitialFitDone(true);
      setTimeout(emitBounds, 100);
      return;
    }

    if (fitAllMarkers && markerCoordinates.length > 0) {
      const bounds = markerCoordinates.reduce(
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
        { padding: 54, maxZoom: 14, duration: 800 }
      );

      setInitialFitDone(true);
      return;
    }

    if (centerPoint) {
      const neighborhoodRadius = centerPoint.radius || 1500;
      const earthRadius = 6371000;
      const latDelta = (neighborhoodRadius / earthRadius) * (180 / Math.PI);
      const lngDelta = (neighborhoodRadius / (earthRadius * Math.cos((centerPoint.lat * Math.PI) / 180))) * (180 / Math.PI);

      let minLng = centerPoint.lng - lngDelta;
      let maxLng = centerPoint.lng + lngDelta;
      let minLat = centerPoint.lat - latDelta;
      let maxLat = centerPoint.lat + latDelta;

      markerCoordinates.forEach(([lng, lat]) => {
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      });

      map.fitBounds(
        [[minLng, minLat], [maxLng, maxLat]],
        { padding: 44, maxZoom: 16, duration: 800 }
      );

      setInitialFitDone(true);
      return;
    }

    if (!localUserLocation && markerCoordinates.length > 1) {
      const bounds = markerCoordinates.reduce(
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
        { padding: 54, maxZoom: 14, duration: 800 }
      );
    }

    setInitialFitDone(true);
  }, [
    centerPoint,
    emitBounds,
    fitAllMarkers,
    initialFitDone,
    localUserLocation,
    markerCoordinates,
    viewRadius,
  ]);

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

  const handleMapClick = useCallback(() => {
    setSelectedEvent(null);
    setSelectedSpot(null);
    onItemSelect?.(null);
  }, [onItemSelect]);

  const handleClosePopup = useCallback(() => {
    setSelectedEvent(null);
    setSelectedSpot(null);
    onItemSelect?.(null);
  }, [onItemSelect]);

  const markerCount = markerPoints.length;
  const clusterThreshold = isMobile ? 10 : 16;
  const useClusterMode = markerCount >= clusterThreshold;

  const renderMarkers = useMemo<RenderMarker[]>(() => {
    // Force recalculation on map movement tick.
    void viewTick;

    if (!useClusterMode || !mapReady) {
      return markerPoints.map((point) => ({
        kind: "point",
        key: `point-${point.itemType}-${point.id}`,
        point,
      }));
    }

    const map = mapRef.current;
    if (!map) {
      return markerPoints.map((point) => ({
        kind: "point",
        key: `point-${point.itemType}-${point.id}`,
        point,
      }));
    }

    const bounds = map.getBounds();
    if (!bounds) {
      return markerPoints.map((point) => ({
        kind: "point",
        key: `point-${point.itemType}-${point.id}`,
        point,
      }));
    }

    const gridSize = isMobile ? 54 : 60;
    const visiblePoints = markerPoints.filter((point) => bounds.contains([point.lng, point.lat]));
    const buckets = new globalThis.Map<string, MarkerPoint[]>();

    visiblePoints.forEach((point) => {
      const projected = map.project([point.lng, point.lat]);
      const key = `${Math.floor(projected.x / gridSize)}:${Math.floor(projected.y / gridSize)}`;
      const bucket = buckets.get(key);
      if (bucket) bucket.push(point);
      else buckets.set(key, [point]);
    });

    const markers: RenderMarker[] = [];

    buckets.forEach((bucket, bucketKey) => {
      if (bucket.length === 1) {
        const point = bucket[0];
        markers.push({ kind: "point", key: `point-${point.itemType}-${point.id}`, point });
        return;
      }

      const selectedIndex = selectedItemId != null
        ? bucket.findIndex((point) => point.id === selectedItemId)
        : -1;

      const clusterPoints = selectedIndex >= 0
        ? bucket.filter((_, index) => index !== selectedIndex)
        : bucket;

      if (selectedIndex >= 0) {
        const selectedPoint = bucket[selectedIndex];
        markers.push({
          kind: "point",
          key: `point-${selectedPoint.itemType}-${selectedPoint.id}`,
          point: selectedPoint,
        });
      }

      if (clusterPoints.length === 0) return;

      if (clusterPoints.length === 1) {
        const point = clusterPoints[0];
        markers.push({ kind: "point", key: `point-${point.itemType}-${point.id}`, point });
        return;
      }

      const center = clusterPoints.reduce(
        (acc, point) => ({
          lng: acc.lng + point.lng,
          lat: acc.lat + point.lat,
        }),
        { lng: 0, lat: 0 }
      );

      const lng = center.lng / clusterPoints.length;
      const lat = center.lat / clusterPoints.length;
      markers.push({
        kind: "cluster",
        key: `cluster-${bucketKey}-${clusterPoints.length}-${Math.round(lng * 10000)}-${Math.round(lat * 10000)}`,
        lng,
        lat,
        count: clusterPoints.length,
      });
    });

    return markers;
  }, [isMobile, mapReady, markerPoints, selectedItemId, useClusterMode, viewTick]);

  const selectedEventCoords = selectedEvent ? getEventCoordinates(selectedEvent) : null;
  const selectedSpotCoords = selectedSpot ? getSpotCoordinates(selectedSpot) : null;

  if (!mounted || !mapSupported) {
    return (
      <div className="w-full h-full bg-[var(--night)] border border-[var(--twilight)] relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] map-grid-lines" />
        <div className="absolute inset-0 skeleton-shimmer" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[var(--dusk)]/80 backdrop-blur-sm border border-[var(--twilight)]">
            <div className="w-4 h-4 rounded-full border-2 border-[var(--coral)] border-t-transparent animate-spin" />
            <span className="text-[var(--muted)] font-mono text-xs">
              {mounted ? "Map unavailable on this device" : "Loading map"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full overflow-hidden border border-[var(--twilight)] relative bg-[var(--void)] ${styles.mapContainer}`} data-theme={isLightTheme ? "light" : "dark"}>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={initialViewState}
        mapStyle={mapStyle}
        onLoad={handleMapLoad}
        onError={(event) => {
          const message = String((event as { error?: { message?: string } })?.error?.message || "").toLowerCase();
          if (message.includes("not supported")) {
            setMapSupported(false);
          }
        }}
        onClick={handleMapClick}
        onMoveEnd={() => {
          emitBounds();
          setViewTick((value) => value + 1);
        }}
        reuseMaps
        style={{ width: "100%", height: "100%" }}
        attributionControl
        maxZoom={18}
        minZoom={8}
      >
        <NavigationControl position="top-right" showCompass />
        <GeolocateControl position="top-right" trackUserLocation={false} />

        {useClusterMode ? (
          renderMarkers.map((marker) => {
            if (marker.kind === "cluster") {
              return (
                <Marker
                  key={marker.key}
                  longitude={marker.lng}
                  latitude={marker.lat}
                  anchor="bottom"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    const map = mapRef.current;
                    if (!map) return;
                    map.easeTo({
                      center: [marker.lng, marker.lat],
                      zoom: Math.min(16, map.getZoom() + 2),
                      duration: 520,
                    });
                  }}
                >
                  <ClusterPin count={marker.count} />
                </Marker>
              );
            }

            const point = marker.point;
            return (
              <Marker
                key={marker.key}
                longitude={point.lng}
                latitude={point.lat}
                anchor="bottom"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  if (point.itemType === "event") {
                    const event = mappableEvents.find((item) => item.id === point.id);
                    if (event) handleEventClick(event);
                  } else {
                    const spot = mappableSpots.find((item) => item.id === point.id);
                    if (spot) handleSpotClick(spot);
                  }
                }}
              >
                <MapPin
                  category={point.category}
                  isLive={point.isLive}
                  isSelected={point.id === selectedItemId}
                  isHovered={point.id === hoveredItemId}
                />
              </Marker>
            );
          })
        ) : (
          <>
            {mappableEvents.map((event) => (
              <EventMapMarker
                key={`event-${event.id}`}
                event={event}
                onClick={handleEventClick}
                isSelected={event.id === selectedItemId}
                isHovered={event.id === hoveredItemId}
              />
            ))}
            {mappableSpots.map((spot) => (
              <SpotMapMarker
                key={`spot-${spot.id}`}
                spot={spot}
                onClick={handleSpotClick}
                isSelected={spot.id === selectedItemId}
                isHovered={spot.id === hoveredItemId}
              />
            ))}
          </>
        )}

        {localUserLocation && (
          <Marker
            longitude={localUserLocation.lng}
            latitude={localUserLocation.lat}
            anchor="center"
          >
            <UserLocationDot />
          </Marker>
        )}

        {!isMobile && selectedEvent && selectedEventCoords && (
          <Popup
            longitude={selectedEventCoords[0]}
            latitude={selectedEventCoords[1]}
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

        {!isMobile && selectedSpot && selectedSpotCoords && (
          <Popup
            longitude={selectedSpotCoords[0]}
            latitude={selectedSpotCoords[1]}
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
              locationDesignator={selectedSpot.location_designator}
              address={selectedSpot.address}
              neighborhood={selectedSpot.neighborhood}
              portalSlug={portal.slug}
            />
          </Popup>
        )}
      </Map>

      {showMobileSheet && isMobile && (selectedEvent || selectedSpot) && (
        <MobileMapSheet
          event={selectedEvent}
          spot={selectedSpot}
          portalSlug={portal.slug}
          onClose={handleClosePopup}
        />
      )}

      {isFetching && markerCount > 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--dusk)]/90 backdrop-blur-sm border border-[var(--twilight)] shadow-[0_10px_26px_rgba(0,0,0,0.4)]">
            <div className="w-3 h-3 rounded-full border-2 border-[var(--coral)] border-t-transparent animate-spin" />
            <span className="text-[var(--muted)] font-mono text-[11px] uppercase tracking-wider">Updating view</span>
          </div>
        </div>
      )}

      {!isFetching && mappableEvents.length === 0 && mappableSpots.length === 0 && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-10"
          style={{ bottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-[var(--twilight)]/70 bg-[var(--dusk)]/92 backdrop-blur-sm shadow-[0_12px_28px_rgba(0,0,0,0.44)]">
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
