import { formatSmartDate } from "@/lib/formats";
import { parseISO, isToday } from "date-fns";

/**
 * Get reflection CSS class for event categories
 */
export function getReflectionClass(category: string | null): string {
  if (!category) return "";
  const reflectionMap: Record<string, string> = {
    music: "reflect-music",
    comedy: "reflect-comedy",
    art: "reflect-art",
    theater: "reflect-theater",
    film: "reflect-film",
    community: "reflect-community",
    food_drink: "reflect-food",
    food: "reflect-food",
    sports: "reflect-sports",
    fitness: "reflect-fitness",
    nightlife: "reflect-nightlife",
    family: "reflect-family",
  };
  return reflectionMap[category] || "";
}

/**
 * Get reflection CSS class for spot/venue types
 */
export function getSpotReflectionClass(spotType: string): string {
  const reflectionMap: Record<string, string> = {
    music_venue: "reflect-music",
    comedy_club: "reflect-comedy",
    art_gallery: "reflect-art",
    theater: "reflect-theater",
    movie_theater: "reflect-film",
    community_space: "reflect-community",
    restaurant: "reflect-food",
    bar: "reflect-nightlife",
    sports_venue: "reflect-sports",
    fitness_studio: "reflect-fitness",
    nightclub: "reflect-nightlife",
    family_venue: "reflect-family",
  };
  return reflectionMap[spotType] || "";
}

/**
 * Get smart date label (Today, Tomorrow, Sat May 17, etc.)
 */
export function getSmartDateLabel(dateStr: string): string {
  return formatSmartDate(dateStr).label;
}

/**
 * Ticketing platform domains
 */
export const TICKETING_DOMAINS = [
  "eventbrite.com",
  "ticketmaster.com",
  "axs.com",
  "dice.fm",
  "seetickets.us",
  "etix.com",
  "ticketweb.com",
  "showclix.com",
  "ticketfly.com",
  "universe.com",
  "resident-advisor.net",
  "songkick.com",
];

/**
 * Reservation platform domains
 */
export const RESERVATION_DOMAINS = [
  "resy.com",
  "opentable.com",
  "tock.com",
  "exploretock.com",
  "sevenrooms.com",
  "toasttab.com",
];

/**
 * Check if URL is a ticketing platform
 */
export function isTicketingUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return TICKETING_DOMAINS.some((domain) => hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * Check if URL is a reservation platform
 */
export function isReservationUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return RESERVATION_DOMAINS.some((domain) => hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * Get appropriate label for link-out button
 */
export function getLinkOutLabel({
  url,
  hasTicketUrl,
  isExternal,
}: {
  url: string;
  hasTicketUrl: boolean;
  isExternal: boolean;
}): string {
  if (isReservationUrl(url)) return "Reserve";
  if (isTicketingUrl(url)) return "Tickets";
  if (!isExternal) return "Details";
  return hasTicketUrl ? "Tickets" : "Details";
}

/**
 * Get feed-specific event status (live or soon)
 * Simpler than the full getEventStatus in formats.ts
 */
export function getFeedEventStatus(
  date: string,
  time: string | null
): "live" | "soon" | null {
  if (!time) return null;

  const eventDate = parseISO(date);
  if (!isToday(eventDate)) return null;

  const [hours, minutes] = time.split(":").map(Number);
  const eventDateTime = new Date();
  eventDateTime.setHours(hours, minutes, 0, 0);
  const now = Date.now();

  if (eventDateTime > new Date()) {
    const minutesUntil = Math.round(
      (eventDateTime.getTime() - now) / (1000 * 60)
    );
    if (minutesUntil <= 30) {
      return "soon";
    }
  } else {
    const minutesAgo = Math.round(
      (now - eventDateTime.getTime()) / (1000 * 60)
    );
    if (minutesAgo <= 120) {
      return "live";
    }
  }
  return null;
}
