"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import type { Spot } from "@/lib/spots-constants";

interface SpotsResponse {
  spots: Spot[];
}

interface UseMapSpotsOptions {
  portalId?: string;
  portalExclusive?: boolean;
  enabled?: boolean;
}

export function useMapSpots(options: UseMapSpotsOptions = {}) {
  const { portalId, portalExclusive, enabled = true } = options;
  const searchParams = useSearchParams();

  const filtersKey = useMemo(() => {
    const params = new URLSearchParams();
    const search = searchParams.get("search");
    const openNow = searchParams.get("open_now");
    const withEvents = searchParams.get("with_events");
    const priceLevel = searchParams.get("price_level");
    const venueType = searchParams.get("venue_type");
    const neighborhoods = searchParams.get("neighborhoods");
    const vibes = searchParams.get("vibes");
    const genres = searchParams.get("genres");

    if (search) params.set("search", search);
    if (openNow) params.set("open_now", openNow);
    if (withEvents) params.set("with_events", withEvents);
    if (priceLevel) params.set("price_level", priceLevel);
    if (venueType) params.set("venue_type", venueType);
    if (neighborhoods) params.set("neighborhoods", neighborhoods);
    if (vibes) params.set("vibes", vibes);
    if (genres) params.set("genres", genres);

    return params.toString();
  }, [searchParams]);

  const buildApiParams = useMemo(() => {
    const params = new URLSearchParams();

    if (portalId && portalId !== "default") {
      params.set("portal_id", portalId);
    }
    if (portalExclusive) {
      params.set("exclusive", "true");
    }

    const search = searchParams.get("search");
    const openNow = searchParams.get("open_now");
    const withEvents = searchParams.get("with_events");
    const priceLevel = searchParams.get("price_level");
    const venueType = searchParams.get("venue_type");
    const neighborhoods = searchParams.get("neighborhoods");
    const vibes = searchParams.get("vibes");
    const genres = searchParams.get("genres");

    if (search) params.set("q", search);
    if (openNow === "true") params.set("open_now", "true");
    if (withEvents === "true") params.set("with_events", "true");
    if (priceLevel) params.set("price_level", priceLevel);
    if (venueType) params.set("venue_type", venueType);
    if (neighborhoods) params.set("neighborhood", neighborhoods);
    if (vibes) params.set("vibes", vibes);
    if (genres) params.set("genres", genres);

    return params.toString();
  }, [searchParams, portalId, portalExclusive]);

  const query = useQuery<SpotsResponse, Error>({
    queryKey: ["spots", "map", filtersKey, portalId, portalExclusive],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/spots?${buildApiParams}`, { signal });
      if (!res.ok) {
        throw new Error(`Failed to fetch map destinations: ${res.status}`);
      }
      return res.json();
    },
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    throwOnError: (error) => {
      if (error.name === "AbortError") return false;
      return true;
    },
  });

  const spots = useMemo(() => {
    if (!query.data?.spots) return [];
    return query.data.spots.filter((spot) => spot.lat != null && spot.lng != null);
  }, [query.data]);

  return {
    spots,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching,
    isPlaceholderData: query.isPlaceholderData,
    error: query.error?.message || null,
    refetch: query.refetch,
    query,
  };
}

export type UseMapSpotsReturn = ReturnType<typeof useMapSpots>;
