"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import type { EventWithLocation } from "@/lib/search";

/**
 * Map bounds (lat/lng bounding box)
 */
export interface MapBounds {
  north: number; // Max latitude
  south: number; // Min latitude
  east: number;  // Max longitude
  west: number;  // Min longitude
}

/**
 * Response from /api/events
 */
interface EventsResponse {
  events: EventWithLocation[];
  hasMore: boolean;
}

/**
 * Options for useMapEvents hook
 */
interface UseMapEventsOptions {
  portalId?: string;
  portalExclusive?: boolean;
  enabled?: boolean;
  // Initial bounds (optional, will use city default if not provided)
  initialBounds?: MapBounds;
}

// Default Atlanta bounds (metropolitan area)
const ATLANTA_BOUNDS: MapBounds = {
  north: 34.05,
  south: 33.55,
  east: -84.1,
  west: -84.7,
};

/**
 * Hook for fetching events for map display
 *
 * Features:
 * - Bounds-based loading (fetches events within visible map area)
 * - Debounced bounds updates to prevent excessive API calls
 * - React Query caching for efficient data reuse
 */
export function useMapEvents(options: UseMapEventsOptions = {}) {
  const { portalId, portalExclusive, enabled = true, initialBounds } = options;
  const searchParams = useSearchParams();

  // Track current bounds (debounced)
  const [bounds, setBounds] = useState<MapBounds>(initialBounds || ATLANTA_BOUNDS);
  const boundsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Create stable query key from filter params
  const filtersKey = useMemo(() => {
    const params = new URLSearchParams();
    const filterKeys = [
      "search",
      "categories",
      "subcategories",
      "tags",
      "vibes",
      "neighborhoods",
      "price",
      "date",
    ];
    filterKeys.forEach((key) => {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [searchParams]);

  // Create bounds key for query (rounded to reduce unnecessary refetches)
  const boundsKey = useMemo(() => {
    // Round to 2 decimal places to avoid excessive refetches from minor movements
    return `${bounds.north.toFixed(2)},${bounds.south.toFixed(2)},${bounds.east.toFixed(2)},${bounds.west.toFixed(2)}`;
  }, [bounds]);

  // Build API params
  const buildApiParams = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("view"); // Remove view param

    // Add portal params
    if (portalId && portalId !== "default") {
      params.set("portal_id", portalId);
    }
    if (portalExclusive) {
      params.set("portal_exclusive", "true");
    }

    // Request more events for map view (no pagination, just limit)
    params.set("pageSize", "500");
    params.set("useCursor", "true"); // Use cursor-based to avoid COUNT(*)

    return params.toString();
  }, [searchParams, portalId, portalExclusive]);

  const query = useQuery<EventsResponse, Error>({
    queryKey: ["events", "map", filtersKey, boundsKey, portalId, portalExclusive],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/events?${buildApiParams}`, { signal });

      if (!res.ok) {
        throw new Error(`Failed to fetch map events: ${res.status}`);
      }

      return res.json();
    },
    enabled,
    // Map data can be stale for a bit since it's a visual overview
    staleTime: 60 * 1000, // 1 minute
    // Don't refetch on window focus for map
    refetchOnWindowFocus: false,
    // Treat abort as a non-error (happens during view switching)
    throwOnError: (error) => {
      if (error.name === "AbortError") return false;
      return true;
    },
  });

  // Filter events that have valid coordinates
  const events = useMemo(() => {
    if (!query.data?.events) return [];
    return query.data.events.filter((e) => e.venue?.lat && e.venue?.lng);
  }, [query.data?.events]);

  // Filter events within current bounds
  const eventsInBounds = useMemo(() => {
    return events.filter((event) => {
      const lat = event.venue?.lat;
      const lng = event.venue?.lng;
      if (!lat || !lng) return false;
      return (
        lat >= bounds.south &&
        lat <= bounds.north &&
        lng >= bounds.west &&
        lng <= bounds.east
      );
    });
  }, [events, bounds]);

  // Debounced bounds update function
  const updateBounds = useCallback((newBounds: MapBounds) => {
    if (boundsTimeoutRef.current) {
      clearTimeout(boundsTimeoutRef.current);
    }

    // Debounce 300ms to prevent rapid-fire updates during pan/zoom
    boundsTimeoutRef.current = setTimeout(() => {
      setBounds(newBounds);
    }, 300);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (boundsTimeoutRef.current) {
        clearTimeout(boundsTimeoutRef.current);
      }
    };
  }, []);

  return {
    events,
    eventsInBounds,
    bounds,
    updateBounds,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error?.message || null,
    refetch: query.refetch,
    // Expose raw query for advanced use cases
    query,
  };
}

/**
 * Type for the return value of useMapEvents
 */
export type UseMapEventsReturn = ReturnType<typeof useMapEvents>;
