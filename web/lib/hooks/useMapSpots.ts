"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import type { Spot } from "@/lib/spots-constants";
import { buildSpotsApiParams } from "@/lib/build-spots-params";

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

  const apiParamsString = useMemo(() => {
    return buildSpotsApiParams({
      portalId,
      isExclusive: portalExclusive,
      searchParams,
    }).toString();
  }, [searchParams, portalId, portalExclusive]);

  const query = useQuery<SpotsResponse, Error>({
    queryKey: ["spots", "map", apiParamsString],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/spots?${apiParamsString}`, { signal });
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
