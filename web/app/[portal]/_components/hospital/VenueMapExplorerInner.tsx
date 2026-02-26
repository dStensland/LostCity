"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Map as MapboxMap, Marker, NavigationControl } from "react-map-gl";
import type { MapRef } from "react-map-gl";
import { ATLANTA_CENTER, MAPBOX_TOKEN, getMapStyle } from "@/lib/map-config";
import type { buildDiscoveryItems } from "@/lib/emory-discovery";
import { getEventFallbackImage } from "@/lib/hospital-art";

function getFallbackImage(item: { kind: string; title: string; subtitle: string }): string {
  if (item.kind === "event") return getEventFallbackImage(null, item.title);
  if (item.kind === "venue") return getEventFallbackImage(null, item.title);
  return getEventFallbackImage("community", item.title);
}

function appendContextParams(
  href: string,
  contextParams: Record<string, string | undefined> | undefined,
): string {
  if (!contextParams) return href;
  if (/^https?:\/\//i.test(href)) return href;

  const contextEntries = Object.entries(contextParams).filter(([, value]) => Boolean(value));
  if (contextEntries.length === 0) return href;

  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  for (const [key, value] of contextEntries) {
    if (!value) continue;
    if (!params.has(key)) params.set(key, value);
  }
  const nextQuery = params.toString();
  return nextQuery ? `${path}?${nextQuery}` : path;
}

type VenueMarkerPoint = {
  key: string;
  title: string;
  subtitle: string;
  detailHref: string;
  mapsHref: string | null;
  lng: number;
  lat: number;
};

type VenueMarker =
  | { kind: "point"; key: string; point: VenueMarkerPoint }
  | { kind: "cluster"; key: string; lng: number; lat: number; count: number };

export type VenueMapExplorerInnerProps = {
  items: ReturnType<typeof buildDiscoveryItems>["venues"];
  savedIds: string[];
  contextParams?: Record<string, string | undefined>;
  onToggleSaved: (id: string) => void;
};

export default function VenueMapExplorerInner({
  items,
  savedIds,
  contextParams,
  onToggleSaved,
}: VenueMapExplorerInnerProps) {
  const t = useTranslations("discovery");
  const mapRef = useRef<MapRef | null>(null);
  const [mounted, setMounted] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [viewTick, setViewTick] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    // @ts-expect-error - dynamic CSS import for map runtime only.
    import("mapbox-gl/dist/mapbox-gl.css");
  }, []);

  const points = useMemo<VenueMarkerPoint[]>(
    () =>
      items.flatMap((item) => {
        if (item.lat === null || item.lng === null) return [];
        return [{
          key: item.key,
          title: item.title,
          subtitle: item.subtitle,
          detailHref: item.detailHref,
          mapsHref: item.mapsHref,
          lat: item.lat,
          lng: item.lng,
        }];
      }),
    [items],
  );

  const mapCenter = useMemo(() => {
    if (points.length === 0) {
      return { lat: ATLANTA_CENTER.latitude, lng: ATLANTA_CENTER.longitude };
    }
    const aggregate = points.reduce(
      (acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }),
      { lat: 0, lng: 0 },
    );
    return {
      lat: aggregate.lat / points.length,
      lng: aggregate.lng / points.length,
    };
  }, [points]);

  const selectedPoint = useMemo(
    () => points.find((point) => point.key === selectedKey) || null,
    [points, selectedKey],
  );

  const renderMarkers = useMemo<VenueMarker[]>(() => {
    void viewTick;
    if (!mapReady || !mapRef.current) {
      return points.map((point) => ({
        kind: "point",
        key: `point-${point.key}`,
        point,
      }));
    }

    const map = mapRef.current;
    const bounds = map.getBounds();
    if (!bounds) {
      return points.map((point) => ({
        kind: "point",
        key: `point-${point.key}`,
        point,
      }));
    }

    const visiblePoints = points.filter((point) => bounds.contains([point.lng, point.lat]));
    const bucketSize = 58;
    const buckets = new globalThis.Map<string, VenueMarkerPoint[]>();

    visiblePoints.forEach((point) => {
      const projected = map.project([point.lng, point.lat]);
      const bucketKey = `${Math.floor(projected.x / bucketSize)}:${Math.floor(projected.y / bucketSize)}`;
      const bucket = buckets.get(bucketKey);
      if (bucket) bucket.push(point);
      else buckets.set(bucketKey, [point]);
    });

    const markers: VenueMarker[] = [];
    buckets.forEach((bucket, key) => {
      if (bucket.length === 1) {
        markers.push({ kind: "point", key: `point-${bucket[0].key}`, point: bucket[0] });
        return;
      }

      const selectedIndex = selectedKey ? bucket.findIndex((point) => point.key === selectedKey) : -1;
      const clusterPoints = selectedIndex >= 0 ? bucket.filter((_, idx) => idx !== selectedIndex) : bucket;

      if (selectedIndex >= 0) {
        const selected = bucket[selectedIndex];
        markers.push({ kind: "point", key: `point-${selected.key}`, point: selected });
      }

      if (clusterPoints.length === 0) return;
      if (clusterPoints.length === 1) {
        markers.push({ kind: "point", key: `point-${clusterPoints[0].key}`, point: clusterPoints[0] });
        return;
      }

      const center = clusterPoints.reduce(
        (acc, point) => ({ lng: acc.lng + point.lng, lat: acc.lat + point.lat }),
        { lng: 0, lat: 0 },
      );
      const lng = center.lng / clusterPoints.length;
      const lat = center.lat / clusterPoints.length;
      markers.push({
        kind: "cluster",
        key: `cluster-${key}-${clusterPoints.length}-${Math.round(lng * 1000)}-${Math.round(lat * 1000)}`,
        lng,
        lat,
        count: clusterPoints.length,
      });
    });

    return markers;
  }, [mapReady, points, selectedKey, viewTick]);

  const handleSelectVenue = useCallback((point: VenueMarkerPoint) => {
    setSelectedKey(point.key);
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: [point.lng, point.lat],
      zoom: Math.max(mapRef.current.getZoom(), 14),
      duration: 480,
    });
  }, []);

  const limitedItems = items.slice(0, 8);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)] gap-2.5">
      <div className="relative overflow-hidden rounded-lg border border-[#d7dce4] bg-[#f8f9fb] min-h-[320px]" aria-label="Interactive map showing venues and organizations">
        {!mounted ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-[#6b7280]">{t("loadingMap")}</p>
          </div>
        ) : points.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <p className="text-sm text-[#6b7280]">{t("noGeocodedVenues")}</p>
          </div>
        ) : (
          <MapboxMap
            ref={mapRef}
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={{
              latitude: mapCenter.lat,
              longitude: mapCenter.lng,
              zoom: points.length > 1 ? 12.2 : 14.2,
            }}
            mapStyle={getMapStyle(true)}
            onLoad={() => setMapReady(true)}
            onMoveEnd={() => setViewTick((value) => value + 1)}
            onClick={() => setSelectedKey(null)}
            style={{ width: "100%", height: "100%" }}
            attributionControl
            maxZoom={18}
            minZoom={9}
            reuseMaps
          >
            <NavigationControl position="top-right" showCompass={false} />
            {renderMarkers.map((marker) => {
              if (marker.kind === "cluster") {
                return (
                  <Marker
                    key={marker.key}
                    longitude={marker.lng}
                    latitude={marker.lat}
                    anchor="center"
                    onClick={(event) => {
                      event.originalEvent.stopPropagation();
                      const map = mapRef.current;
                      if (!map) return;
                      map.flyTo({
                        center: [marker.lng, marker.lat],
                        zoom: Math.min(map.getZoom() + 1.2, 16),
                        duration: 420,
                      });
                    }}
                  >
                    <button
                      type="button"
                      className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-[#1d4ed8] bg-[#2563eb] px-2 text-xs font-semibold text-white shadow-sm"
                      aria-label={`Cluster of ${marker.count} venues`}
                    >
                      {marker.count}
                    </button>
                  </Marker>
                );
              }

              const isSelected = selectedKey === marker.point.key;
              return (
                <Marker
                  key={marker.key}
                  longitude={marker.point.lng}
                  latitude={marker.point.lat}
                  anchor="center"
                  onClick={(event) => {
                    event.originalEvent.stopPropagation();
                    handleSelectVenue(marker.point);
                  }}
                >
                  <button
                    type="button"
                    className={`h-4 w-4 rounded-full border-2 shadow-sm ${isSelected ? "border-[#0f172a] bg-[#16a34a]" : "border-[#1d4ed8] bg-white"}`}
                    aria-label={`Open ${marker.point.title}`}
                  />
                </Marker>
              );
            })}
          </MapboxMap>
        )}

        {selectedPoint && (
          <div className="pointer-events-none absolute bottom-2 left-2 right-2 rounded-lg border border-[#dbe6f8] bg-white/96 px-3 py-2.5 shadow-md">
            <p className="text-sm font-semibold text-[#002f6c]">{selectedPoint.title}</p>
            <p className="text-xs text-[#4b5563]">{selectedPoint.subtitle}</p>
            <div className="mt-1 flex flex-wrap gap-3 pointer-events-auto">
              <Link href={appendContextParams(selectedPoint.detailHref, contextParams)} className="emory-link-btn">{t("open")}</Link>
              {selectedPoint.mapsHref && (
                <a href={selectedPoint.mapsHref} target="_blank" rel="noreferrer" className="emory-link-btn">{t("mapDirections")}</a>
              )}
              <button type="button" onClick={() => onToggleSaved(selectedPoint.key)} className="emory-link-btn">
                {savedIds.includes(selectedPoint.key) ? t("saved") : t("save")}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {limitedItems.map((item) => {
          const hasCoordinates = item.lat !== null && item.lng !== null;
          const isSelected = selectedKey === item.key;
          const thumb = item.imageUrl || getFallbackImage(item);
          return (
            <article
              key={item.key}
              className={`rounded-lg border px-3 py-2.5 shadow-sm ${isSelected ? "border-[#b9d5ff] bg-[#f4f8ff]" : "border-[#d7dce4] bg-white"}`}
            >
              <div className="flex items-start gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!hasCoordinates) return;
                    handleSelectVenue({
                      key: item.key,
                      title: item.title,
                      subtitle: item.subtitle,
                      detailHref: item.detailHref,
                      mapsHref: item.mapsHref,
                      lat: item.lat as number,
                      lng: item.lng as number,
                    });
                  }}
                  className={`h-14 w-16 overflow-hidden rounded-md border border-[#d7dce4] shrink-0 ${hasCoordinates ? "cursor-pointer" : "cursor-default"}`}
                  aria-label={`Preview ${item.title}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumb} alt={item.title} className="h-full w-full object-cover" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!hasCoordinates) return;
                    handleSelectVenue({
                      key: item.key,
                      title: item.title,
                      subtitle: item.subtitle,
                      detailHref: item.detailHref,
                      mapsHref: item.mapsHref,
                      lat: item.lat as number,
                      lng: item.lng as number,
                    });
                  }}
                  className={`text-left ${hasCoordinates ? "cursor-pointer" : "cursor-default"}`}
                >
                  <p className="text-sm font-semibold text-[#002f6c]">{item.title}</p>
                  <p className="mt-0.5 text-xs text-[#4b5563]">{item.subtitle}</p>
                </button>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-3">
                <Link href={appendContextParams(item.detailHref, contextParams)} className="emory-link-btn">{t("open")}</Link>
                {item.mapsHref && (
                  <a href={item.mapsHref} target="_blank" rel="noreferrer" className="emory-link-btn">{t("mapDirections")}</a>
                )}
                <button type="button" onClick={() => onToggleSaved(item.key)} className="emory-link-btn">
                  {savedIds.includes(item.key) ? t("saved") : t("save")}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
