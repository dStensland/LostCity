import { formatTimeSplit } from "@/lib/formats";
import { MAPBOX_TOKEN } from "@/lib/map-config";

// Shared prefetch set — prevents duplicate event detail prefetches across all verticals.
// Bounded to 100 entries to prevent unbounded growth in long sessions.
const MAX_PREFETCH_CACHE = 100;
const prefetchedUrls = new Set<string>();

export function prefetchEventDetail(eventId: number, portalId?: string) {
  const url = portalId
    ? `/api/events/${eventId}?portal_id=${portalId}`
    : `/api/events/${eventId}`;
  if (prefetchedUrls.has(url)) return;
  if (prefetchedUrls.size >= MAX_PREFETCH_CACHE) {
    const first = prefetchedUrls.values().next().value;
    if (first !== undefined) prefetchedUrls.delete(first);
  }
  prefetchedUrls.add(url);
  fetch(url, { priority: "low" } as RequestInit).catch(() => {
    prefetchedUrls.delete(url);
  });
}

export function venueMapUrl(lat: number, lng: number): string {
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-s+ff6b7a(${lng},${lat})/${lng},${lat},15,0/80x120@2x?access_token=${MAPBOX_TOKEN}`;
}

export function formatShowtime(time: string | null): string {
  if (!time) return "TBA";
  const parts = formatTimeSplit(time);
  if (parts.time === "TBA") return "TBA";
  return `${parts.time}${parts.period ? ` ${parts.period}` : ""}`;
}

export function toLocalIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
