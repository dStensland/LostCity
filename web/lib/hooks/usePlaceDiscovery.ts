"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { Spot } from "@/lib/spots-constants";
import { useReplaceStateParams } from "@/lib/hooks/useReplaceStateParams";
import { type SpotsTab } from "@/lib/spots-constants";
import {
  DEFAULT_DESTINATIONS_FILTERS,
  applyDestinationsQueryState,
  parseDestinationsQueryState,
  type DestinationsFilterState,
} from "@/lib/destinations-query-state";
import {
  createFindFilterSnapshot,
  trackFindZeroResults,
} from "@/lib/analytics/find-tracking";
import { buildExplorePlacesRequestParams } from "@/lib/explore-platform/places-request";
import type { PlaceSeedSpot, PlacesLaneInitialData } from "@/lib/explore-platform/lane-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FilterState = DestinationsFilterState;
export const DEFAULT_FILTERS = DEFAULT_DESTINATIONS_FILTERS;

const CLIENT_SPOTS_CACHE_TTL_MS = 60 * 1000;
const clientSpotsCache = new Map<
  string,
  {
    cachedAt: number;
    spots: Spot[];
    meta: { openCount: number; neighborhoods: string[] };
  }
>();

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UsePlaceDiscoveryOptions {
  portalId: string;
  portalSlug: string;
  isExclusive?: boolean;
  initialPayload?: PlacesLaneInitialData | null;
}

function inflateSeedSpot(spot: PlaceSeedSpot): Spot {
  return {
    id: spot.id,
    name: spot.name,
    slug: spot.slug,
    address: null,
    neighborhood: spot.neighborhood,
    city: "",
    state: "GA",
    lat: spot.lat ?? null,
    lng: spot.lng ?? null,
    place_type: spot.place_type,
    location_designator: spot.location_designator ?? "standard",
    venue_types: null,
    description: null,
    short_description: spot.short_description,
    price_level: spot.price_level,
    website: null,
    instagram: null,
    hours_display: null,
    vibes: null,
    genres: null,
    image_url: spot.image_url,
    featured: false,
    active: true,
    claimed_by: null,
    is_verified: null,
    event_count: spot.event_count,
    upcoming_events: spot.upcoming_events,
    is_open: spot.is_open,
    closes_at: spot.closes_at,
    is_24_hours: spot.is_24_hours,
    distance_km: spot.distance_km ?? null,
  };
}

export type UserLocation = { lat: number; lng: number };

export interface UsePlaceDiscoveryReturn {
  spots: Spot[];
  filteredSpots: Spot[];
  loading: boolean;
  fetchError: string | null;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  meta: { openCount: number; neighborhoods: string[] };
  retry: () => void;
  filterSnapshot: ReturnType<typeof createFindFilterSnapshot>;
  /** Display-only context label from URL (e.g. "Coffee", "Brunch") */
  contextLabel: string | null;
  /** User's current location for distance sorting */
  userLocation: UserLocation | null;
  setUserLocation: React.Dispatch<React.SetStateAction<UserLocation | null>>;
  /** Active spots sub-tab */
  activeTab: SpotsTab;
  setActiveTab: (tab: SpotsTab) => void;
}

// Legacy alias for backwards compatibility
export type UseVenueDiscoveryReturn = UsePlaceDiscoveryReturn;
export type UseVenueDiscoveryOptions = UsePlaceDiscoveryOptions;

function getCachedSpotPayload(cacheKey: string) {
  const cached = clientSpotsCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > CLIENT_SPOTS_CACHE_TTL_MS) {
    clientSpotsCache.delete(cacheKey);
    return null;
  }
  return cached;
}

function normalizeFetchedSpots(
  spots: Spot[] | PlaceSeedSpot[] | undefined,
  compact: boolean,
): Spot[] {
  const nextSpots = spots ?? [];
  return compact
    ? nextSpots.map((spot) => inflateSeedSpot(spot as PlaceSeedSpot))
    : (nextSpots as Spot[]);
}

export function usePlaceDiscovery({
  portalId,
  portalSlug,
  isExclusive = false,
  initialPayload = null,
}: UsePlaceDiscoveryOptions): UsePlaceDiscoveryReturn {
  const searchParams = useReplaceStateParams();
  const queryString = searchParams.toString();
  const queryState = useMemo(
    () => parseDestinationsQueryState(queryString),
    [queryString]
  );
  const filters = queryState.filters;
  const activeTab = queryState.activeTab;

  const hydratedInitialSpots = useMemo(
    () => initialPayload?.spots.map(inflateSeedSpot) ?? [],
    [initialPayload],
  );
  const [spots, setSpots] = useState<Spot[]>(() => hydratedInitialSpots);
  const [loading, setLoading] = useState(() => !initialPayload);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ openCount: number; neighborhoods: string[] }>(
    () =>
      initialPayload?.meta ?? {
        openCount: 0,
        neighborhoods: [],
      },
  );
  const [userLocation, setUserLocation] = useState<UserLocation | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem("userLocation");
      if (!saved) return null;
      return JSON.parse(saved) as UserLocation;
    } catch {
      return null;
    }
  });

  const zeroResultsSignatureRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const urlSearch = searchParams.get("search") || "";
  const contextLabel = searchParams.get("label") || null;

  // ── Analytics snapshot ─────────────────────────────────────────────────
  const filterSnapshot = useMemo(
    () =>
      createFindFilterSnapshot(
        {
          search: urlSearch,
          open_now: filters.openNow ? "true" : undefined,
          with_events: filters.withEvents ? "true" : undefined,
          price_level: filters.priceLevel,
          venue_type: filters.venueTypes,
          neighborhoods: filters.neighborhoods,
          vibes: filters.vibes,
          cuisine: filters.cuisine,
        },
        "destinations"
      ),
    [
      urlSearch,
      filters.neighborhoods,
      filters.openNow,
      filters.priceLevel,
      filters.venueTypes,
      filters.vibes,
      filters.cuisine,
      filters.withEvents,
    ]
  );

  // ── Build server-side query params ─────────────────────────────────────
  const buildQueryParams = useCallback(() => {
    return buildExplorePlacesRequestParams({
      portalId,
      isExclusive,
      queryString,
      userLocation,
      limit: 120,
    });
  }, [
    portalId,
    isExclusive,
    queryString,
    userLocation,
  ]);

  useEffect(() => {
    if (!initialPayload) return;
    clientSpotsCache.set(initialPayload.requestKey, {
      cachedAt: Date.now(),
      spots: hydratedInitialSpots,
      meta: initialPayload.meta,
    });
  }, [hydratedInitialSpots, initialPayload]);

  const commitQueryState = useCallback(
    (nextState: { activeTab: SpotsTab; filters: FilterState }) => {
      const nextParams = applyDestinationsQueryState(
        new URLSearchParams(searchParams.toString()),
        nextState
      );
      const next = nextParams.toString();
      const current = searchParams.toString();
      if (next !== current) {
        window.history.replaceState(
          window.history.state,
          "",
          `/${portalSlug}?${next}`,
        );
      }
    },
    [portalSlug, searchParams]
  );

  const setFilters = useCallback<React.Dispatch<React.SetStateAction<FilterState>>>(
    (updater) => {
      const nextFilters =
        typeof updater === "function" ? updater(filters) : updater;
      commitQueryState({
        activeTab,
        filters: nextFilters,
      });
    },
    [activeTab, commitQueryState, filters]
  );

  const setActiveTab = useCallback(
    (tab: SpotsTab) => {
      commitQueryState({
        activeTab: tab,
        filters: {
          ...filters,
          venueTypes: [],
          cuisine: [],
          vibes: [],
          occasion: null,
        },
      });
    },
    [commitQueryState, filters]
  );

  // ── Fetch spots (debounced 200ms to batch rapid filter changes) ──────
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstFetchRef = useRef(true);

  useEffect(() => {
    // Skip debounce on initial mount for instant first load
    const delay = isFirstFetchRef.current ? 0 : 200;
    isFirstFetchRef.current = false;

    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);

    fetchTimeoutRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      async function fetchSpots() {
        const params = buildQueryParams();
        const requestKey = params.toString();
        const cached = getCachedSpotPayload(requestKey);

        if (cached) {
          setSpots(cached.spots);
          setMeta(cached.meta);
          setFetchError(null);
          setLoading(false);
          return;
        }

        setLoading(true);
        setFetchError(null);
        try {
          const res = await fetch(`/api/spots?${params}`, { signal: controller.signal });
          if (!res.ok) throw new Error(`Server error (${res.status})`);
          const data = await res.json();
          const nextSpots = normalizeFetchedSpots(
            data.spots,
            params.get("compact") === "1" || data.compact === true,
          );
          const nextMeta = data.meta || { openCount: 0, neighborhoods: [] };
          clientSpotsCache.set(requestKey, {
            cachedAt: Date.now(),
            spots: nextSpots,
            meta: nextMeta,
          });
          setSpots(nextSpots);
          setMeta(nextMeta);
        } catch (error) {
          if ((error as Error).name === "AbortError") return;
          console.error("Failed to fetch spots:", error);
          setFetchError("Unable to load spots. Please try again.");
          setSpots([]);
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      }

      fetchSpots();
    }, delay);

    return () => {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      abortRef.current?.abort();
    };
  }, [buildQueryParams]);

  // ── Client-side filters (instant, no re-fetch) ────────────────────────
  const filteredSpots = useMemo(() => {
    let result = spots;
    if (filters.openNow) {
      result = result.filter((s) => s.is_open);
    }
    if (filters.withEvents) {
      result = result.filter((s) => (s.event_count ?? 0) > 0);
    }
    if (filters.priceLevel.length > 0) {
      result = result.filter(
        (s) => s.price_level != null && filters.priceLevel.includes(s.price_level)
      );
    }
    return result;
  }, [spots, filters.openNow, filters.withEvents, filters.priceLevel]);

  // ── Zero-results analytics ─────────────────────────────────────────────
  useEffect(() => {
    if (!portalSlug || loading) return;
    if (filteredSpots.length > 0) {
      zeroResultsSignatureRef.current = null;
      return;
    }
    if (filterSnapshot.activeCount === 0) return;
    if (zeroResultsSignatureRef.current === filterSnapshot.signature) return;

    trackFindZeroResults({
      portalSlug,
      findType: "destinations",
      displayMode: "list",
      surface: "destinations_list",
      snapshot: filterSnapshot,
      resultCount: filteredSpots.length,
    });
    zeroResultsSignatureRef.current = filterSnapshot.signature;
  }, [filterSnapshot, loading, portalSlug, filteredSpots.length]);

  // ── Retry helper ───────────────────────────────────────────────────────
  const retry = useCallback(() => {
    setFetchError(null);
    setLoading(true);
    const params = buildQueryParams();
    const requestKey = params.toString();
    clientSpotsCache.delete(requestKey);
    fetch(`/api/spots?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Server error (${res.status})`);
        return res.json();
      })
      .then((data) => {
        const nextSpots = normalizeFetchedSpots(
          data.spots,
          params.get("compact") === "1" || data.compact === true,
        );
        const nextMeta = data.meta || { openCount: 0, neighborhoods: [] };
        clientSpotsCache.set(requestKey, {
          cachedAt: Date.now(),
          spots: nextSpots,
          meta: nextMeta,
        });
        setSpots(nextSpots);
        setMeta(nextMeta);
      })
      .catch(() => setFetchError("Still unable to load spots."))
      .finally(() => setLoading(false));
  }, [buildQueryParams]);

  return {
    spots,
    filteredSpots,
    loading,
    fetchError,
    filters,
    setFilters,
    meta,
    retry,
    filterSnapshot,
    contextLabel,
    userLocation,
    setUserLocation,
    activeTab,
    setActiveTab,
  };
}

// Legacy alias for backwards compatibility
export const useVenueDiscovery = usePlaceDiscovery;
