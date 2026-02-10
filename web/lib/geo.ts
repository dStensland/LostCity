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
 * Get proximity tier based on distance in km.
 * - walkable: < 1.2km (~15 min walk) — show everything
 * - close: 1.2-3km — filter to notable venues
 * - destination: 3km+ — marquee only
 */
export function getProximityTier(distanceKm: number): ProximityTier {
  if (distanceKm < 1.2) return "walkable";
  if (distanceKm < 3) return "close";
  return "destination";
}

/**
 * Get walking time in minutes from distance in km.
 * Assumes 5 km/h average walking speed.
 */
export function getWalkingMinutes(distanceKm: number): number {
  return Math.round((distanceKm / WALK_SPEED_KMH) * 60);
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
