"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Source, Marker, useMap } from "react-map-gl";
import type { GeoJSON } from "geojson";
import MapPin from "./MapPin";
import ClusterPin from "./ClusterPin";

interface VisibleCluster {
  id: number; // cluster_id
  lng: number;
  lat: number;
  count: number;
}

interface VisiblePoint {
  id: number; // event/spot id
  lng: number;
  lat: number;
  category: string | null;
  isLive: boolean;
  itemType: "event" | "spot";
}

interface ClusterLayerProps {
  data: GeoJSON;
  onClusterClick: (clusterId: number, lng: number, lat: number) => void;
  onPointClick?: (id: number, itemType: "event" | "spot") => void;
  selectedItemId?: number | null;
  hoveredItemId?: number | null;
}

export default function ClusterLayer({
  data,
  onClusterClick,
  onPointClick,
  selectedItemId,
  hoveredItemId,
}: ClusterLayerProps) {
  const { current: map } = useMap();
  const [clusters, setClusters] = useState<VisibleCluster[]>([]);
  const [points, setPoints] = useState<VisiblePoint[]>([]);
  const rafRef = useRef<number>(0);

  const updateFeatures = useCallback(() => {
    const m = map?.getMap();
    if (!m) return;

    // Check if source is loaded
    const source = m.getSource("events");
    if (!source) return;

    // Query all features from the source that are currently rendered
    // We use querySourceFeatures for the geojson source with clustering
    const features = m.querySourceFeatures("events");

    const newClusters: VisibleCluster[] = [];
    const newPoints: VisiblePoint[] = [];
    const seenClusters = new Set<number>();
    const seenPoints = new Set<number>();

    for (const f of features) {
      const props = f.properties;
      if (!props) continue;

      const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;

      if (props.cluster) {
        const clusterId = props.cluster_id as number;
        if (seenClusters.has(clusterId)) continue;
        seenClusters.add(clusterId);
        newClusters.push({
          id: clusterId,
          lng,
          lat,
          count: props.point_count as number,
        });
      } else {
        const pointId = props.id as number;
        if (seenPoints.has(pointId)) continue;
        seenPoints.add(pointId);
        newPoints.push({
          id: pointId,
          lng,
          lat,
          category: (props.category as string) || null,
          isLive: props.isLive === true || props.isLive === "true",
          itemType: (props.itemType as "event" | "spot") || "event",
        });
      }
    }

    setClusters(newClusters);
    setPoints(newPoints);
  }, [map]);

  // Debounced update on map events
  const scheduleUpdate = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(updateFeatures);
  }, [updateFeatures]);

  useEffect(() => {
    const m = map?.getMap();
    if (!m) return;

    // Update on various map events
    m.on("moveend", scheduleUpdate);
    m.on("zoomend", scheduleUpdate);
    m.on("sourcedata", scheduleUpdate);

    // Initial update
    scheduleUpdate();

    return () => {
      m.off("moveend", scheduleUpdate);
      m.off("zoomend", scheduleUpdate);
      m.off("sourcedata", scheduleUpdate);
      cancelAnimationFrame(rafRef.current);
    };
  }, [map, scheduleUpdate]);

  return (
    <>
      {/* Source with clustering enabled — no Layer elements needed */}
      <Source
        id="events"
        type="geojson"
        data={data}
        cluster
        clusterMaxZoom={15}
        clusterRadius={50}
      />

      {/* Cluster markers — pin shape with count */}
      {clusters.map((c) => (
        <Marker
          key={`cluster-${c.id}`}
          longitude={c.lng}
          latitude={c.lat}
          anchor="bottom"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            onClusterClick(c.id, c.lng, c.lat);
          }}
        >
          <ClusterPin count={c.count} />
        </Marker>
      ))}

      {/* Unclustered point markers — same MapPin as individual mode */}
      {points.map((p) => (
        <Marker
          key={`point-${p.id}`}
          longitude={p.lng}
          latitude={p.lat}
          anchor="bottom"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            onPointClick?.(p.id, p.itemType);
          }}
        >
          <MapPin
            category={p.category}
            isLive={p.isLive}
            isSelected={p.id === selectedItemId}
            isHovered={p.id === hoveredItemId}
          />
        </Marker>
      ))}
    </>
  );
}
