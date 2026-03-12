"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Spot } from "@/lib/spots-constants";
import {
  getTabChips,
  getTabVenueTypes,
  type SpotsTab,
} from "@/lib/spots-constants";
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

interface UseVenueDiscoveryOptions {
  portalId: string;
  portalSlug: string;
  isExclusive?: boolean;
}

export type UserLocation = { lat: number; lng: number };

export interface UseVenueDiscoveryReturn {
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

function getCachedSpotPayload(cacheKey: string) {
  const cached = clientSpotsCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > CLIENT_SPOTS_CACHE_TTL_MS) {
    clientSpotsCache.delete(cacheKey);
    return null;
  }
  return cached;
}

export function useVenueDiscovery({
  portalId,
  portalSlug,
  isExclusive = false,
}: UseVenueDiscoveryOptions): UseVenueDiscoveryReturn {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams?.toString() || "";
  const queryState = useMemo(
    () => parseDestinationsQueryState(queryString),
    [queryString]
  );
  const filters = queryState.filters;
  const activeTab = queryState.activeTab;

  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ openCount: number; neighborhoods: string[] }>({
    openCount: 0,
    neighborhoods: [],
  });
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

  const urlSearch = searchParams?.get("search") || "";
  const contextLabel = searchParams?.get("label") || null;

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
    const params = new URLSearchParams();
    if (portalId) params.set("portal_id", portalId);
    if (isExclusive) params.set("exclusive", "true");

    // Resolve effective venueTypes, vibes, cuisine considering tab defaults + occasion overrides
    let effectiveVenueTypes = filters.venueTypes;
    let effectiveVibes = filters.vibes;
    let effectiveCuisine = filters.cuisine;

    // If user hasn't manually set venueTypes, use the tab's defaults
    if (effectiveVenueTypes.length === 0) {
      effectiveVenueTypes = getTabVenueTypes(activeTab);
    }

    // If an occasion chip is active, merge its overrides (scoped to active tab — no cross-tab collision)
    if (filters.occasion) {
      const chip = getTabChips(activeTab).find((c) => c.key === filters.occasion);
      if (chip) {
        const ov = chip.filterOverrides;
        if (ov.venueTypes) effectiveVenueTypes = [...ov.venueTypes];
        if (ov.vibes) effectiveVibes = [...effectiveVibes, ...ov.vibes.filter((v) => !effectiveVibes.includes(v))];
        if (ov.cuisine) effectiveCuisine = [...effectiveCuisine, ...ov.cuisine.filter((c) => !effectiveCuisine.includes(c))];
      }
    }

    if (effectiveVenueTypes.length > 0) params.set("venue_type", effectiveVenueTypes.join(","));
    // Enrich Things to Do venues with upcoming event details
    if (activeTab === "things-to-do") params.set("include_events", "true");
    if (filters.neighborhoods.length > 0) params.set("neighborhood", filters.neighborhoods.join(","));
    if (effectiveVibes.length > 0) params.set("vibes", effectiveVibes.join(","));
    if (effectiveCuisine.length > 0) params.set("cuisine", effectiveCuisine.join(","));
    if (urlSearch) params.set("q", urlSearch);
    if (userLocation) {
      params.set("center_lat", String(userLocation.lat));
      params.set("center_lng", String(userLocation.lng));
    }
    return params;
  }, [
    portalId,
    isExclusive,
    filters.venueTypes,
    filters.neighborhoods,
    filters.vibes,
    filters.cuisine,
    filters.occasion,
    activeTab,
    urlSearch,
    userLocation,
  ]);

  const commitQueryState = useCallback(
    (nextState: { activeTab: SpotsTab; filters: FilterState }) => {
      const nextParams = applyDestinationsQueryState(
        new URLSearchParams(searchParams?.toString() || ""),
        nextState
      );
      const next = nextParams.toString();
      const current = searchParams?.toString() || "";
      if (next !== current) {
        router.replace(`/${portalSlug}?${next}`, { scroll: false });
      }
    },
    [portalSlug, router, searchParams]
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
          const nextSpots = data.spots || [];
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
        const nextSpots = data.spots || [];
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
