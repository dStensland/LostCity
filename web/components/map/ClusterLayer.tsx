"use client";

import { Source, Layer } from "react-map-gl";
import type { CircleLayer, SymbolLayer } from "react-map-gl";
import type { GeoJSON } from "geojson";
import type mapboxgl from "mapbox-gl";

// Cluster circle — solid fill with white border and dark outer ring
const clusterLayer: CircleLayer = {
  id: "clusters",
  type: "circle",
  source: "events",
  filter: ["has", "point_count"],
  paint: {
    "circle-color": [
      "step",
      ["get", "point_count"],
      "#E8556A", // < 10: warm coral (more saturated)
      10,
      "#D946A8", // 10-30: magenta-pink
      30,
      "#C026D3", // 30+: vivid purple
    ],
    "circle-radius": [
      "step",
      ["get", "point_count"],
      14,  // < 10: 28px diameter
      10,
      18,  // 10-30: 36px diameter
      30,
      22,  // 30+: 44px diameter
    ],
    "circle-stroke-width": 2.5,
    "circle-stroke-color": "rgba(255, 255, 255, 0.95)",
    "circle-opacity": 1,
  },
};

// Dark ring behind the white border for extra pop
const clusterOuterRing: CircleLayer = {
  id: "cluster-outer-ring",
  type: "circle",
  source: "events",
  filter: ["has", "point_count"],
  paint: {
    "circle-color": "transparent",
    "circle-radius": [
      "step",
      ["get", "point_count"],
      17,
      10,
      21,
      30,
      25,
    ],
    "circle-stroke-width": 1,
    "circle-stroke-color": "rgba(0, 0, 0, 0.3)",
    "circle-opacity": 1,
  },
};

// Cluster count text — white and bold for contrast
const clusterCountLayer: SymbolLayer = {
  id: "cluster-count",
  type: "symbol",
  source: "events",
  filter: ["has", "point_count"],
  layout: {
    "text-field": ["get", "point_count_abbreviated"],
    "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
    "text-size": [
      "step",
      ["get", "point_count"],
      13,
      10,
      14,
      30,
      16,
    ],
    "text-allow-overlap": true,
  },
  paint: {
    "text-color": "#ffffff",
    "text-halo-color": "rgba(0, 0, 0, 0.3)",
    "text-halo-width": 1,
  },
};

// Mapbox match expression: category → 7-family pin color
// Must stay in sync with MAP_PIN_FAMILY_LOOKUP in category-config.ts
// Brighter colors for dark map — synced with MAP_PIN_FAMILY_LOOKUP in category-config.ts
const categoryColorMatch: mapboxgl.Expression = [
  "match",
  ["get", "category"],
  // Rose — music, dance, nightlife
  "music", "#FB7185", "dance", "#FB7185", "nightlife", "#FB7185",
  "nightclub", "#FB7185", "lgbtq", "#FB7185", "music_venue", "#FB7185",
  "club", "#FB7185", "record_store", "#FB7185",
  // Vivid Orange — food & drink
  "food_drink", "#FF9C52", "bar", "#FF9C52", "restaurant", "#FF9C52",
  "brewery", "#FF9C52", "cooking", "#FF9C52", "cooking_school", "#FF9C52",
  "coffee_shop", "#FF9C52", "distillery", "#FF9C52", "winery", "#FF9C52",
  "food_hall", "#FF9C52", "farmers_market", "#FF9C52", "sports_bar", "#FF9C52",
  // Amber — entertainment & attractions
  "comedy", "#FCD34D", "comedy_club", "#FCD34D", "festival", "#FCD34D",
  "markets", "#FCD34D", "attraction", "#FCD34D", "hotel", "#FCD34D",
  "eatertainment", "#FCD34D",
  // Mint — community & wellness
  "community", "#34D399", "fitness", "#34D399", "fitness_center", "#34D399",
  "wellness", "#34D399", "outdoors", "#34D399", "outdoor", "#34D399",
  "park", "#34D399", "garden", "#34D399", "yoga", "#34D399",
  "community_center", "#34D399",
  // Cyan — sports & screen
  "sports", "#22D3EE", "sports_venue", "#22D3EE", "film", "#22D3EE",
  "cinema", "#22D3EE", "tours", "#22D3EE", "arena", "#22D3EE",
  "convention_center", "#22D3EE",
  // Bright Violet — arts & learning
  "art", "#A78BFA", "theater", "#A78BFA", "gallery", "#A78BFA",
  "museum", "#A78BFA", "learning", "#A78BFA", "words", "#A78BFA",
  "religious", "#A78BFA", "church", "#A78BFA", "library", "#A78BFA",
  "bookstore", "#A78BFA", "college", "#A78BFA", "university", "#A78BFA",
  "studio", "#A78BFA",
  // Default — coral
  "#F87171",
];

// Unclustered point — shown when zoomed past clusterMaxZoom
const unclusteredPointLayer: CircleLayer = {
  id: "unclustered-point",
  type: "circle",
  source: "events",
  filter: ["!", ["has", "point_count"]],
  paint: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    "circle-color": categoryColorMatch as any,
    "circle-radius": 8,
    "circle-stroke-width": 2,
    "circle-stroke-color": "rgba(255, 255, 255, 0.9)",
    "circle-opacity": 1,
  },
};

interface ClusterLayerProps {
  data: GeoJSON;
  onClusterClick: (clusterId: number, lng: number, lat: number) => void;
}

export default function ClusterLayer({ data, onClusterClick: _onClusterClick }: ClusterLayerProps) {
  return (
    <Source
      id="events"
      type="geojson"
      data={data}
      cluster
      clusterMaxZoom={15}
      clusterRadius={50}
    >
      <Layer {...clusterOuterRing} />
      <Layer {...clusterLayer} />
      <Layer {...clusterCountLayer} />
      <Layer {...unclusteredPointLayer} />
    </Source>
  );
}
