"use client";

/**
 * NeighborhoodMap — Choropleth map showing neighborhood activity levels.
 *
 * Fetches GeoJSON boundaries from /api/neighborhoods/boundaries, enriches each
 * feature with activityScore from the parent, and renders a fill + line layer
 * using MapLibre GL via react-map-gl/maplibre.
 *
 * Custom neighborhood labels replace CARTO's default place labels to avoid
 * duplicates and to show contextual activity data (events today/this week).
 *
 * Do NOT import this file directly. Use NeighborhoodMapWrapper (ssr: false).
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Map, {
  Source,
  Layer,
  NavigationControl,
  type MapRef,
  type MapLayerMouseEvent,
} from "react-map-gl/maplibre";
import {
  MAPLIBRE_DARK_STYLE,
  ATLANTA_CENTER,
  DEFAULT_ZOOM,
} from "@/lib/map-config";
import {
  type NeighborhoodActivity,
  NEIGHBORHOOD_COLORS,
  getNeighborhoodColor,
} from "@/lib/neighborhood-colors";

export type { NeighborhoodActivity } from "@/lib/neighborhood-colors";
export { getNeighborhoodColor } from "@/lib/neighborhood-colors";

interface Props {
  activityData: NeighborhoodActivity[];
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
}

// Build a lookup map keyed by lowercase name for fast, case-insensitive matching
function buildActivityIndex(
  activityData: NeighborhoodActivity[],
): globalThis.Map<string, NeighborhoodActivity> {
  const index: globalThis.Map<string, NeighborhoodActivity> = new globalThis.Map();
  for (const item of activityData) {
    index.set(item.name.toLowerCase(), item);
  }
  return index;
}

/**
 * Returns contextual subtext shown beneath the neighborhood label.
 *
 * Three tiers based on activity score:
 * - Quiet  (< 15): no subtext — the ghosted label IS the signal
 * - Active (15–60): single strongest signal only
 * - Hot    (> 60): up to 2 signals separated by bullet
 */
function getLabelSubtext(activity: NeighborhoodActivity | undefined): string {
  if (!activity) return "";

  const score = activity.activityScore;

  // Quiet neighborhoods: name only, no subtext
  if (score < 15) {
    // Exception: show spot count if no events but venues exist
    if (activity.venueCount > 0 && score > 0) return `${activity.venueCount} spots`;
    return "";
  }

  // Build ranked signal list — strongest first
  const signals: string[] = [];
  if (activity.activeHangsCount > 0) signals.push(`${activity.activeHangsCount} out now`);
  if (activity.eventsTodayCount > 0) signals.push(`${activity.eventsTodayCount} today`);
  else if (activity.eventsWeekCount > 0) signals.push(`${activity.eventsWeekCount} this week`);
  if (activity.goingCount > 0) signals.push(`${activity.goingCount} going`);

  if (signals.length === 0) {
    if (activity.venueCount > 0) return `${activity.venueCount} spots`;
    return "";
  }

  // Active: single signal. Hot: up to 2.
  const maxSignals = score > 60 ? 2 : 1;
  return signals.slice(0, maxSignals).join("  •  ");
}

/** Compute the centroid (average of ring vertices) for a polygon outer ring. */
function ringCentroid(ring: number[][]): [number, number] {
  const n = ring.length > 1 ? ring.length - 1 : ring.length; // skip closing dup
  let sLng = 0, sLat = 0;
  for (let i = 0; i < n; i++) { sLng += ring[i][0]; sLat += ring[i][1]; }
  return [sLng / n, sLat / n];
}

/** Get centroid from the largest polygon part of any Polygon/MultiPolygon. */
function featureCentroid(geometry: GeoJSON.Geometry): [number, number] {
  if (geometry.type === "Polygon") {
    return ringCentroid(geometry.coordinates[0]);
  }
  if (geometry.type === "MultiPolygon") {
    let best: number[][] = geometry.coordinates[0][0];
    for (const poly of geometry.coordinates) {
      if (poly[0].length > best.length) best = poly[0];
    }
    return ringCentroid(best);
  }
  return [ATLANTA_CENTER.longitude, ATLANTA_CENTER.latitude];
}

// Colors and type re-exported from @/lib/neighborhood-colors

const FILL_LAYER_ID = "neighborhood-fill";

// Atlanta bounding box — prevents panning too far from the city
const ATLANTA_BOUNDS: [[number, number], [number, number]] = [
  [-84.65, 33.55],
  [-84.15, 34.05],
];

export default function NeighborhoodMap({
  activityData,
  selectedSlug,
  onSelect,
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const [mounted, setMounted] = useState(false);
  const [boundaries, setBoundaries] = useState<GeoJSON.FeatureCollection | null>(
    null,
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Load MapLibre CSS then mark ready
  useEffect(() => {
    // @ts-expect-error — Dynamic CSS import for MapLibre GL
    import("maplibre-gl/dist/maplibre-gl.css").then(() => setMounted(true));
  }, []);

  // Fetch neighborhood GeoJSON boundaries once on mount
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    fetch("/api/neighborhoods/boundaries", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Boundaries fetch failed: ${res.status}`);
        return res.json() as Promise<GeoJSON.FeatureCollection>;
      })
      .then((data) => {
        if (!cancelled) setBoundaries(data);
      })
      .catch((err) => {
        if (!cancelled && err.name !== "AbortError") {
          console.error("[NeighborhoodMap] Failed to load boundaries:", err);
        }
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  // Activity index keyed by lowercase name for O(1) lookup
  const activityIndex = useMemo(
    () => buildActivityIndex(activityData),
    [activityData],
  );

  // Enrich GeoJSON features with activityScore, isSelected, isConfigured for fill/line layers
  const enrichedGeoJson = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!boundaries) return null;

    const features = boundaries.features.map((feature) => {
      const rawName: string =
        (feature.properties?.name as string | undefined) ?? "";
      const match = activityIndex.get(rawName.toLowerCase());

      return {
        ...feature,
        properties: {
          ...feature.properties,
          activityScore: match?.activityScore ?? 0,
          isSelected: match ? match.slug === selectedSlug : false,
          isConfigured: match !== undefined,
          color: getNeighborhoodColor(rawName),
        },
      };
    });

    return { ...boundaries, features };
  }, [boundaries, activityIndex, selectedSlug]);

  // Separate Point source for labels — one point per neighborhood at the polygon centroid.
  // This avoids MapLibre creating duplicate labels for each part of MultiPolygon features.
  const labelsGeoJson = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!boundaries) return null;

    const features: GeoJSON.Feature[] = boundaries.features.map((feature) => {
      const rawName: string =
        (feature.properties?.name as string | undefined) ?? "";
      const match = activityIndex.get(rawName.toLowerCase());
      const centroid = featureCentroid(feature.geometry);

      return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: centroid },
        properties: {
          labelName: rawName.toUpperCase(),
          labelSubtext: getLabelSubtext(match),
          activityScore: match?.activityScore ?? 0,
          isSelected: match ? match.slug === selectedSlug : false,
          color: getNeighborhoodColor(rawName),
        },
      };
    });

    return { type: "FeatureCollection" as const, features };
  }, [boundaries, activityIndex, selectedSlug]);

  // ─── Layer 1: Glow — blurred line in the neighborhood's own color for active areas
  const glowLayer = {
    id: "neighborhood-glow",
    type: "line" as const,
    paint: {
      "line-color": ["get", "color"],
      "line-opacity": [
        "interpolate",
        ["linear"],
        ["get", "activityScore"],
        0,   0,
        25,  0.04,
        50,  0.12,
        75,  0.22,
        100, 0.35,
      ],
      "line-width": [
        "interpolate",
        ["linear"],
        ["get", "activityScore"],
        0,   0,
        30,  3,
        60,  6,
        100, 10,
      ],
      "line-blur": [
        "interpolate",
        ["linear"],
        ["get", "activityScore"],
        0,   0,
        30,  3,
        100, 6,
      ],
    },
  };

  // ─── Layer 2: Fill — each neighborhood its own color, opacity = activity
  const fillLayer = {
    id: FILL_LAYER_ID,
    type: "fill" as const,
    paint: {
      "fill-color": ["get", "color"],
      "fill-opacity": [
        "case",
        ["==", ["get", "isConfigured"], false],
        0.04,
        [
          "case",
          ["==", ["get", "isSelected"], true],
          0.45,
          [
            "interpolate",
            ["linear"],
            ["get", "activityScore"],
            0,   0.06,
            15,  0.12,
            30,  0.18,
            50,  0.24,
            75,  0.32,
            100, 0.40,
          ],
        ],
      ],
    },
  };

  // ─── Layer 3: Border — neighborhood color, activity drives visibility
  const lineLayer = {
    id: "neighborhood-line",
    type: "line" as const,
    paint: {
      "line-color": [
        "case",
        ["==", ["get", "isSelected"], true],
        ["get", "color"],
        ["get", "color"],
      ],
      "line-opacity": [
        "case",
        ["==", ["get", "isSelected"], true],
        0.8,
        [
          "interpolate",
          ["linear"],
          ["get", "activityScore"],
          0,   0.10,
          50,  0.25,
          100, 0.45,
        ],
      ],
      "line-width": [
        "case",
        ["==", ["get", "isSelected"], true],
        2.5,
        [
          "interpolate",
          ["linear"],
          ["get", "activityScore"],
          0,   0.3,
          50,  0.6,
          100, 1.2,
        ],
      ],
    },
  };

  // ─── Layer 4: Labels — name larger + bold, subtext smaller, strong dark halo
  const labelLayer = {
    id: "neighborhood-labels",
    type: "symbol" as const,
    layout: {
      "text-field": [
        "format",
        ["get", "labelName"], { "font-scale": 1.1 },
        "\n", {},
        ["get", "labelSubtext"], { "font-scale": 0.68 },
      ],
      "text-size": ["step", ["zoom"], 10, 12, 12, 13, 13],
      "text-font": ["Noto Sans Regular", "Noto Sans Bold"],
      "text-anchor": "center" as const,
      "text-max-width": 10,
      "text-allow-overlap": false,
      "text-padding": 4,
      "text-letter-spacing": 0.08,
      "text-line-height": 1.55,
      "symbol-sort-key": ["-", 100, ["get", "activityScore"]],
    },
    paint: {
      "text-color": [
        "case",
        ["==", ["get", "isSelected"], true],
        ["get", "color"],
        [
          "interpolate",
          ["linear"],
          ["get", "activityScore"],
          0,   "rgba(130, 125, 140, 0.40)",   // ghosted — barely there
          15,  "rgba(185, 182, 195, 0.65)",   // present — readable
          45,  "rgba(225, 222, 232, 0.88)",   // active — confident
          75,  "rgba(252, 250, 255, 1.0)",    // hot — full brightness
        ],
      ],
      "text-halo-color": "rgba(6, 4, 10, 0.95)",
      "text-halo-width": 2.5,
    },
  };

  const handleClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) {
        onSelect(null);
        return;
      }
      const rawName: string =
        (feature.properties?.name as string | undefined) ?? "";
      const match = activityIndex.get(rawName.toLowerCase());
      if (!match) {
        onSelect(null);
        return;
      }
      // Toggle: clicking the already-selected neighborhood deselects it
      onSelect(match.slug === selectedSlug ? null : match.slug);
    },
    [activityIndex, selectedSlug, onSelect],
  );

  const handleMouseMove = useCallback(
    (e: MapLayerMouseEvent) => {
      const canvas = mapRef.current?.getCanvas();
      const feature = e.features?.[0];
      if (feature) {
        const rawName: string =
          (feature.properties?.name as string | undefined) ?? "";
        setHoveredId(rawName);
        if (canvas) canvas.style.cursor = "pointer";
      } else {
        setHoveredId(null);
        if (canvas) canvas.style.cursor = "";
      }
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredId(null);
    const canvas = mapRef.current?.getCanvas();
    if (canvas) canvas.style.cursor = "";
  }, []);

  // Remove CARTO's default place/POI labels on map load to avoid duplicates
  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const style = map.getStyle();
    if (style?.layers) {
      for (const layer of style.layers) {
        // CARTO dark_matter place label layers start with "place_" or "poi_"
        if (layer.id.startsWith("place_") || layer.id.startsWith("poi_")) {
          map.removeLayer(layer.id);
        }
      }
    }
  }, []);

  // Suppress unused variable lint warning — hoveredId is reserved for future
  // hover-highlight layer expressions without a re-render per move
  void hoveredId;

  if (!mounted || !boundaries) {
    return (
      <div className="w-full h-full bg-[var(--night)] flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-[var(--twilight)] border-t-[var(--coral)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        mapStyle={MAPLIBRE_DARK_STYLE}
        initialViewState={{
          longitude: ATLANTA_CENTER.longitude,
          latitude: ATLANTA_CENTER.latitude,
          zoom: DEFAULT_ZOOM,
        }}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
        interactiveLayerIds={[FILL_LAYER_ID]}
        maxBounds={ATLANTA_BOUNDS}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onLoad={handleMapLoad}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {enrichedGeoJson && (
          <Source id="neighborhoods" type="geojson" data={enrichedGeoJson}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- MapLibre GL expressions don't match strict LayerProps types */}
            <Layer {...glowLayer as any} />
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Layer {...fillLayer as any} />
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Layer {...lineLayer as any} />
          </Source>
        )}

        {/* Separate point source for labels — avoids MultiPolygon duplicate placements */}
        {labelsGeoJson && (
          <Source id="neighborhood-labels-src" type="geojson" data={labelsGeoJson}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Layer {...labelLayer as any} />
          </Source>
        )}
      </Map>

      {/* Activity legend */}
      <div className="absolute bottom-4 left-4 bg-[var(--night)]/90 border border-[var(--twilight)] rounded-lg px-3 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {NEIGHBORHOOD_COLORS.slice(0, 6).map((c) => (
              <div key={c} className="w-2 h-2 rounded-full" style={{ backgroundColor: c, opacity: 0.7 }} />
            ))}
          </div>
          <span className="text-2xs font-mono text-[var(--muted)]">
            {(() => {
              const active = activityData.filter(a => a.activityScore >= 15).length;
              return `${active} active · ${activityData.length} total`;
            })()}
          </span>
        </div>
      </div>
    </div>
  );
}
