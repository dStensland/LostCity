"use client";

import { useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GroupedVenueExhibition {
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
    image_url: string | null;
  };
  exhibitions: {
    id: string; // UUID
    title: string;
    opening_date: string | null;
    closing_date: string | null;
  }[];
}

interface ShowVenueData {
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
    image_url: string | null;
  };
  shows: {
    id: number;
    title: string;
    start_time: string | null;
    price_min: number | null;
    image_url: string | null;
    is_free: boolean;
  }[];
}

// ── Raw API shapes ────────────────────────────────────────────────────────────

interface RawExhibition {
  id: string;
  title: string;
  opening_date: string | null;
  closing_date: string | null;
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
    image_url: string | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

interface ExhibitionsApiResponse {
  exhibitions: RawExhibition[];
}

interface ShowsApiResponse {
  venues: ShowVenueData[];
  today_count?: number;
  this_week_count?: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 10_000;

// ── useVenueExhibitions ───────────────────────────────────────────────────────

/**
 * Fetches current exhibitions, groups them by venue, and returns data shaped
 * for VenueExhibitionCard. Venues are sorted by exhibition count (most first).
 */
export function useVenueExhibitions(portalSlug: string): {
  venues: GroupedVenueExhibition[];
  loading: boolean;
} {
  const [venues, setVenues] = useState<GroupedVenueExhibition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const url = `/api/exhibitions?portal=${encodeURIComponent(portalSlug)}&showing=current&limit=50`;

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ExhibitionsApiResponse>;
      })
      .then((data) => {
        if (controller.signal.aborted) return;

        // Group exhibitions by venue.id
        const venueMap = new Map<
          number,
          GroupedVenueExhibition
        >();

        for (const exhibition of data.exhibitions ?? []) {
          if (!exhibition.venue?.id) continue;

          const { venue } = exhibition;

          if (!venueMap.has(venue.id)) {
            venueMap.set(venue.id, {
              venue: {
                id: venue.id,
                name: venue.name,
                slug: venue.slug,
                neighborhood: venue.neighborhood,
                image_url: venue.image_url,
              },
              exhibitions: [],
            });
          }

          venueMap.get(venue.id)!.exhibitions.push({
            id: exhibition.id,
            title: exhibition.title,
            opening_date: exhibition.opening_date,
            closing_date: exhibition.closing_date,
          });
        }

        // Sort venues by number of exhibitions (most first)
        const sorted = Array.from(venueMap.values()).sort(
          (a, b) => b.exhibitions.length - a.exhibitions.length
        );

        setVenues(sorted);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [portalSlug]);

  return { venues, loading };
}

// ── useVenueAttractionShows ───────────────────────────────────────────────────

/**
 * Fetches shows for attraction-type venues (zoo, aquarium, attraction,
 * theme_park). Wraps the /api/portals/[slug]/shows endpoint and returns
 * its already-grouped venue data unchanged.
 */
export function useVenueAttractionShows(portalSlug: string): {
  venues: ShowVenueData[];
  loading: boolean;
} {
  const [venues, setVenues] = useState<ShowVenueData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const venueTypes = "zoo,aquarium,attraction,theme_park,museum";
    const url = `/api/portals/${encodeURIComponent(portalSlug)}/shows?venue_types=${venueTypes}`;

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ShowsApiResponse>;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setVenues(data.venues ?? []);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [portalSlug]);

  return { venues, loading };
}

// ── Exported types ────────────────────────────────────────────────────────────

export type { GroupedVenueExhibition, ShowVenueData };
