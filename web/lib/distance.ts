/**
 * Client-safe distance utilities.
 * Pure math — no Node.js imports, safe for "use client" components.
 */

const KM_TO_MILES = 0.621371;

/**
 * Haversine formula — returns distance in kilometers.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Haversine formula — returns distance in miles.
 */
export function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  return haversineKm(lat1, lng1, lat2, lng2) * KM_TO_MILES;
}

/**
 * Convert km to miles.
 */
export function kmToMiles(km: number): number {
  return km * KM_TO_MILES;
}

/**
 * Format a distance in miles for display.
 */
export function formatDistanceMiles(miles: number): string {
  if (miles < 0.1) return "< 0.1 mi";
  if (miles < 1) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}
