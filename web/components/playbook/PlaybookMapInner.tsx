"use client";

/**
 * PlaybookMapInner — The actual Mapbox map for the playbook editor.
 *
 * This file is intentionally separate so it can be dynamically imported
 * (ssr: false) to keep the 1.6MB mapbox-gl bundle out of the shared chunk.
 *
 * Do NOT import this file directly. Use the dynamic wrapper in PlaybookEditor.
 */

import { useState, useEffect, useMemo, useRef } from "react";
import Map, { Marker, Source, Layer, NavigationControl, type MapRef } from "react-map-gl";
import { MAPBOX_TOKEN, DARK_STYLE } from "@/lib/map-config";
import MapPin from "@/components/map/MapPin";
import { Star } from "@phosphor-icons/react";
import {
  getItemCoords,
  type ItineraryItem,
  type LocalItineraryItem,
} from "@/lib/itinerary-utils";
import {
  ROUTE_GLOW_LAYER,
  ROUTE_LINE_LAYER,
  getItemCategory,
} from "@/lib/playbook-shared";

interface Props {
  items: (ItineraryItem | LocalItineraryItem)[];
  className?: string;
}

export default function PlaybookMapInner({ items, className = "" }: Props) {
  const [mounted, setMounted] = useState(false);
  const mapRef = useRef<MapRef>(null);

  useEffect(() => {
    // @ts-expect-error - Dynamic CSS import for Mapbox GL
    import("mapbox-gl/dist/mapbox-gl.css").then(() => setMounted(true));
  }, []);

  const coords = useMemo(
    () =>
      items
        .map((item) => getItemCoords(item))
        .filter((c): c is { lat: number; lng: number } => c !== null),
    [items],
  );

  const center = useMemo(() => {
    if (coords.length === 0) return { lat: 33.7725, lng: -84.3655 };
    const avgLat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
    const avgLng = coords.reduce((s, c) => s + c.lng, 0) / coords.length;
    return { lat: avgLat, lng: avgLng };
  }, [coords]);

  // Re-center map when items change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || coords.length === 0) return;
    if (coords.length === 1) {
      map.flyTo({ center: [coords[0].lng, coords[0].lat], zoom: 14, duration: 800 });
    } else {
      const lngs = coords.map((c) => c.lng);
      const lats = coords.map((c) => c.lat);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 60, duration: 800 },
      );
    }
  }, [coords]);

  const routeGeoJson = useMemo(
    () => ({
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: coords.map((c) => [c.lng, c.lat]),
      },
    }),
    [coords],
  );

  if (!mounted) {
    return (
      <div className={`${className} relative overflow-hidden`} style={{ background: "var(--void)" }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} relative overflow-hidden`}>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={DARK_STYLE}
        initialViewState={{ longitude: center.lng, latitude: center.lat, zoom: 13 }}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {coords.length >= 2 && (
          <Source id="route" type="geojson" data={routeGeoJson}>
            <Layer {...ROUTE_GLOW_LAYER} />
            <Layer {...ROUTE_LINE_LAYER} />
          </Source>
        )}

        {items.map((item, idx) => {
          const c = getItemCoords(item);
          if (!c) return null;
          const isAnchor = idx === 0;
          const category = getItemCategory(item);

          return isAnchor ? (
            <Marker key={item.id} longitude={c.lng} latitude={c.lat} anchor="center">
              <div
                className="flex items-center justify-center rounded-full cursor-pointer"
                style={{
                  width: 34,
                  height: 34,
                  background: "rgba(255, 217, 61, 0.12)",
                  border: "2.5px solid rgba(255, 217, 61, 0.6)",
                  color: "var(--gold)",
                  boxShadow: "0 0 24px rgba(255, 217, 61, 0.3)",
                }}
              >
                <Star size={14} weight="fill" />
              </div>
            </Marker>
          ) : (
            <Marker key={item.id} longitude={c.lng} latitude={c.lat} anchor="bottom">
              <MapPin category={category} />
            </Marker>
          );
        })}
      </Map>
    </div>
  );
}
