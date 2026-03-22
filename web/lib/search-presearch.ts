/**
 * Shared pre-search types and constants.
 * Client-safe — no server-only imports.
 *
 * These are used by:
 *  - /api/search/instant (server, pre-search response)
 *  - useInstantSearch hook (client, fallback + type sharing)
 *  - PreSearchState component (client, rendering)
 */

export interface PreSearchPopularEvent {
  id: string;
  title: string;
  venueName: string | null;
  startDate: string | null;
  startTime: string | null;
  isFree: boolean;
  imageUrl: string | null;
  href: string;
}

export interface PreSearchPayload {
  trending: string[];
  popularNow: PreSearchPopularEvent[];
}

/**
 * Curated trending searches shown immediately on the client (slow-connection
 * fallback) while the API fetches portal-specific data.
 */
export const TRENDING_SEARCHES: string[] = [
  "Live Music",
  "Comedy",
  "Free",
  "Rooftop",
  "Late Night",
  "Drag",
  "Jazz",
  "Trivia",
];
