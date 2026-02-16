/**
 * Geo utilities for distance calculations
 */

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
