/**
 * Geo utilities for distance calculations and polygon-based neighborhood resolution
 */

import { readFileSync } from "fs";
import { join } from "path";
import { normalizeNeighborhoodName } from "@/config/neighborhoods";

/**
 * Convert degrees to radians
 */
function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Haversine formula for distance calculation between two points
 * Returns distance in kilometers
 */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get distance between two points in miles
 */
export function getDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const km = haversineDistanceKm(lat1, lng1, lat2, lng2);
  return km * 0.621371; // Convert km to miles
}

/**
 * Check if a point is within a given radius (in miles) of another point
 */
export function isWithinRadius(
  centerLat: number,
  centerLng: number,
  pointLat: number,
  pointLng: number,
  radiusMiles: number
): boolean {
  const distance = getDistanceMiles(centerLat, centerLng, pointLat, pointLng);
  return distance <= radiusMiles;
}

// ============================================================================
// PROXIMITY TIERS — for hotel/portal distance-based content curation
// ============================================================================

export type ProximityTier = "walkable" | "close" | "destination";

const WALK_SPEED_KMH = 5;

/**
 * Urban grid walking multiplier. Haversine gives straight-line distance,
 * but real walking routes average 1.3x longer due to street grids,
 * intersections, and detours. Validated against OSRM routing for Atlanta.
 */
const WALK_ROUTE_MULTIPLIER = 1.3;

/**
 * Estimate realistic walking distance from straight-line (haversine) distance.
 * Applies a 1.3x urban grid multiplier validated against OSRM routing data.
 */
export function estimateWalkingDistanceKm(haversineKm: number): number {
  return haversineKm * WALK_ROUTE_MULTIPLIER;
}

/**
 * Get proximity tier based on haversine distance in km.
 * Applies walking route multiplier before classifying.
 * - walkable: < 1.2km walking (~15 min) — show everything
 * - close: 1.2-3km walking — filter to notable venues
 * - destination: 3km+ walking — marquee only
 */
export function getProximityTier(distanceKm: number): ProximityTier {
  const walkKm = estimateWalkingDistanceKm(distanceKm);
  if (walkKm < 1.2) return "walkable";
  if (walkKm < 3) return "close";
  return "destination";
}

/**
 * Get walking time in minutes from haversine distance in km.
 * Applies walking route multiplier, then 5 km/h pace.
 */
export function getWalkingMinutes(distanceKm: number): number {
  const walkKm = estimateWalkingDistanceKm(distanceKm);
  return Math.round((walkKm / WALK_SPEED_KMH) * 60);
}

/**
 * Human-readable proximity label.
 * "4 min walk", "18 min walk", "Short ride", "12 min drive"
 */
export function getProximityLabel(distanceKm: number): string {
  const walkMin = getWalkingMinutes(distanceKm);
  if (walkMin <= 15) return `${walkMin} min walk`;
  if (walkMin <= 30) return `${walkMin} min walk`;
  // Assume ~30 km/h average driving in the city
  const driveMin = Math.max(5, Math.round((distanceKm / 30) * 60));
  if (driveMin <= 10) return "Short ride";
  return `${driveMin} min drive`;
}

// ============================================================================
// POLYGON-BASED NEIGHBORHOOD RESOLUTION
// ============================================================================

interface BoundaryFeature {
  type: "Feature";
  properties: { name: string; centroid: [number, number] };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
}

interface BoundaryCollection {
  type: "FeatureCollection";
  features: BoundaryFeature[];
}

let cachedBoundaries: BoundaryCollection | null = null;

function loadBoundaries(): BoundaryCollection {
  if (cachedBoundaries) return cachedBoundaries;
  const filePath = join(process.cwd(), "data", "neighborhood-boundaries.json");
  cachedBoundaries = JSON.parse(readFileSync(filePath, "utf-8")) as BoundaryCollection;
  return cachedBoundaries;
}

/**
 * Ray-casting point-in-polygon test for a single ring.
 * Coordinates are [lng, lat] pairs (GeoJSON convention).
 */
function pointInRing(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][1], yi = ring[i][0];
    const xj = ring[j][1], yj = ring[j][0];
    if ((yi > lng) !== (yj > lng) && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygon(lat: number, lng: number, coords: number[][][]): boolean {
  // First ring is exterior, rest are holes
  if (!pointInRing(lat, lng, coords[0])) return false;
  for (let i = 1; i < coords.length; i++) {
    if (pointInRing(lat, lng, coords[i])) return false; // Inside a hole
  }
  return true;
}

function pointInMultiPolygon(lat: number, lng: number, coords: number[][][][]): boolean {
  return coords.some((poly) => pointInPolygon(lat, lng, poly));
}

/**
 * Resolve a lat/lng to a canonical neighborhood name using polygon boundaries.
 * Tries polygon containment first, falls back to nearest centroid within 3km.
 * Returns null if point is outside all boundaries.
 */
export function resolveNeighborhood(lat: number, lng: number): string | null {
  const boundaries = loadBoundaries();

  // Try polygon containment
  for (const feature of boundaries.features) {
    const { geometry, properties } = feature;
    const match =
      geometry.type === "Polygon"
        ? pointInPolygon(lat, lng, geometry.coordinates as number[][][])
        : pointInMultiPolygon(lat, lng, geometry.coordinates as number[][][][]);
    if (match) {
      return normalizeNeighborhoodName(properties.name);
    }
  }

  // Fallback: nearest centroid within 3km
  let nearest: { name: string; dist: number } | null = null;
  for (const feature of boundaries.features) {
    const [cLng, cLat] = feature.properties.centroid;
    const dist = haversineDistanceKm(lat, lng, cLat, cLng);
    if (dist < 3 && (!nearest || dist < nearest.dist)) {
      nearest = { name: feature.properties.name, dist };
    }
  }

  return nearest ? normalizeNeighborhoodName(nearest.name) : null;
}
