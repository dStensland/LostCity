/**
 * Client-safe utilities for itinerary builder
 * Types and pure functions — no server imports
 */

// ============================================================================
// TYPES
// ============================================================================

export type ItineraryItemType = "event" | "venue" | "custom";

export interface ItineraryItem {
  id: string;
  itinerary_id: string;
  item_type: ItineraryItemType;
  event_id: number | null;
  venue_id: number | null;
  custom_title: string | null;
  custom_description: string | null;
  custom_address: string | null;
  custom_lat: number | null;
  custom_lng: number | null;
  position: number;
  start_time: string | null; // HH:MM format
  duration_minutes: number;
  walk_distance_meters: number | null;
  walk_time_minutes: number | null;
  notes: string | null;
  // Joined data (from events/venues tables)
  event?: {
    id: number;
    title: string;
    start_date: string;
    start_time: string | null;
    image_url: string | null;
    venue_name: string | null;
    category: string | null;
    lat: number | null;
    lng: number | null;
  };
  venue?: {
    id: number;
    slug: string;
    name: string;
    image_url: string | null;
    neighborhood: string | null;
    venue_type: string | null;
    lat: number | null;
    lng: number | null;
  };
}

export interface Itinerary {
  id: string;
  user_id: string | null;
  portal_id: string;
  title: string;
  date: string | null;
  description: string | null;
  is_public: boolean;
  share_token: string | null;
  created_at: string;
  updated_at: string;
  items?: ItineraryItem[];
}

export interface CreateItineraryInput {
  portal_id: string;
  title?: string;
  date?: string;
  description?: string;
}

export interface AddItineraryItemInput {
  item_type: ItineraryItemType;
  event_id?: number;
  venue_id?: number;
  custom_title?: string;
  custom_description?: string;
  custom_address?: string;
  custom_lat?: number;
  custom_lng?: number;
  start_time?: string;
  duration_minutes?: number;
  notes?: string;
}

export interface ReorderItemsInput {
  item_ids: string[];
}

// localStorage shape for anonymous itineraries
export interface LocalItinerary {
  id: string; // client-generated UUID
  portal_id: string;
  title: string;
  date: string | null;
  description: string | null;
  items: LocalItineraryItem[];
  created_at: string;
  updated_at: string;
}

export interface LocalItineraryItem {
  id: string; // client-generated UUID
  item_type: ItineraryItemType;
  event_id: number | null;
  venue_id: number | null;
  custom_title: string | null;
  custom_description: string | null;
  custom_address: string | null;
  custom_lat: number | null;
  custom_lng: number | null;
  position: number;
  start_time: string | null;
  duration_minutes: number;
  walk_distance_meters: number | null;
  walk_time_minutes: number | null;
  notes: string | null;
  // Cached display data for events/venues
  event_title?: string;
  event_image?: string | null;
  venue_name?: string;
  venue_image?: string | null;
}

// ============================================================================
// HAVERSINE WALK TIME CALCULATION
// ============================================================================

const EARTH_RADIUS_M = 6_371_000;
const AVG_WALK_SPEED_MPS = 1.34; // ~3 mph average walking speed

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Calculate distance in meters between two lat/lng points using Haversine formula
 */
export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

/**
 * Estimate walk time in minutes from distance in meters
 * Adds 20% buffer for real-world walking (crosswalks, turns, etc.)
 */
export function estimateWalkMinutes(distanceMeters: number): number {
  const rawMinutes = distanceMeters / AVG_WALK_SPEED_MPS / 60;
  return Math.ceil(rawMinutes * 1.2); // 20% buffer
}

/**
 * Format walk time for display
 */
export function formatWalkTime(minutes: number | null): string {
  if (minutes === null || minutes <= 0) return "";
  if (minutes <= 1) return "1 min walk";
  return `${minutes} min walk`;
}

/**
 * Format walk distance for display
 */
export function formatWalkDistance(meters: number | null): string {
  if (meters === null || meters <= 0) return "";
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Format time string (HH:MM) for display
 */
export function formatItineraryTime(time: string | null): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes)) return "";
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
}

/**
 * Get the display title for an itinerary item
 */
export function getItemTitle(item: ItineraryItem | LocalItineraryItem): string {
  if (item.item_type === "custom") {
    return item.custom_title || "Custom Stop";
  }
  if (item.item_type === "event") {
    if ("event" in item && item.event) return item.event.title;
    if ("event_title" in item && item.event_title) return item.event_title;
    return "Event";
  }
  if (item.item_type === "venue") {
    if ("venue" in item && item.venue) return item.venue.name;
    if ("venue_name" in item && item.venue_name) return item.venue_name;
    return "Venue";
  }
  return "Stop";
}

/**
 * Get coordinates for an itinerary item (for walk time calculation)
 */
export function getItemCoords(
  item: ItineraryItem | LocalItineraryItem
): { lat: number; lng: number } | null {
  if (item.custom_lat != null && item.custom_lng != null) {
    return { lat: item.custom_lat, lng: item.custom_lng };
  }
  if ("event" in item && item.event?.lat != null && item.event?.lng != null) {
    return { lat: item.event.lat, lng: item.event.lng };
  }
  if ("venue" in item && item.venue?.lat != null && item.venue?.lng != null) {
    return { lat: item.venue.lat, lng: item.venue.lng };
  }
  return null;
}

// ============================================================================
// localStorage HELPERS
// ============================================================================

const ITINERARY_STORAGE_KEY = "lostcity_itineraries";

export function getLocalItineraries(portalId: string): LocalItinerary[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${ITINERARY_STORAGE_KEY}_${portalId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalItineraries(
  portalId: string,
  itineraries: LocalItinerary[]
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${ITINERARY_STORAGE_KEY}_${portalId}`,
      JSON.stringify(itineraries)
    );
  } catch {
    // Storage full or unavailable
  }
}

export function clearLocalItineraries(portalId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${ITINERARY_STORAGE_KEY}_${portalId}`);
}

/**
 * Generate a client-side UUID (crypto.randomUUID fallback)
 */
export function generateClientId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
