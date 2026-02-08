"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import type { Festival } from "@/lib/festivals";
import { fetchWithRetry } from "@/lib/fetchWithRetry";

interface UseFestivalsListOptions {
  portalId?: string;
  enabled?: boolean;
}

/**
 * Hook for fetching upcoming festivals with filter support.
 * Uses simple useQuery (not infinite) since festivals are a small dataset.
 * Reads the same filter params as useEventsList from URL search params.
 */
export function useFestivalsList(options: UseFestivalsListOptions = {}) {
  const { portalId, enabled = true } = options;
  const searchParams = useSearchParams();

  // Build query params from current search/filter state
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    const filterKeys = ["search", "categories", "neighborhoods", "price", "date"];
    filterKeys.forEach((key) => {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    });
    // Add portal filter
    if (portalId) {
      params.set("portal_id", portalId);
    }
    return params.toString();
  }, [searchParams, portalId]);

  const query = useQuery<Festival[]>({
    queryKey: ["festivals", "upcoming", queryParams, portalId],
    queryFn: async ({ signal }) => {
      const url = queryParams
        ? `/api/festivals/upcoming?${queryParams}`
        : "/api/festivals/upcoming";
      const res = await fetchWithRetry(
        url,
        { signal },
        {
          maxRetries: 2,
          baseDelay: 1000,
          shouldRetry: (error, response) => {
            if (error.name === "AbortError") return false;
            if (!response) return true;
            if (response.status >= 500) return true;
            return false;
          },
        }
      );

      if (!res.ok) {
        throw new Error(`Failed to fetch festivals: ${res.status}`);
      }

      const data = await res.json();
      return data.festivals as Festival[];
    },
    staleTime: 5 * 60 * 1000, // 5 min - festivals change rarely
    enabled,
    refetchOnWindowFocus: false,
    retry: false,
  });

  return {
    festivals: query.data || [],
    isLoading: query.isLoading,
    error: query.error?.message || null,
  };
}
