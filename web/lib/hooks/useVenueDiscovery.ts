"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Spot } from "@/lib/spots-constants";
import {
  isValidSpotsTab,
  getTabChips,
  getTabVenueTypes,
  type SpotsTab,
} from "@/lib/spots-constants";
import {
  createFindFilterSnapshot,
  trackFindZeroResults,
} from "@/lib/analytics/find-tracking";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FilterState = {
  openNow: boolean;
  priceLevel: number[];
  venueTypes: string[];
  neighborhoods: string[];
  vibes: string[];
  cuisine: string[];
  withEvents: boolean;
  occasion: string | null;
};

export const DEFAULT_FILTERS: FilterState = {
  openNow: false,
  priceLevel: [],
  venueTypes: [],
  neighborhoods: [],
  vibes: [],
  cuisine: [],
  withEvents: false,
  occasion: null,
};

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

function splitCsv(value: string | null): string[] {
  return (
    value
      ?.split(",")
      .map((part) => part.trim())
      .filter(Boolean) || []
  );
}

export function parseFilterStateFromQuery(query: string): FilterState {
  const params = new URLSearchParams(query);

  return {
    openNow: params.get("open_now") === "true",
    priceLevel: splitCsv(params.get("price_level"))
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value)),
    // Normalise: accept both venue_type (singular) and venue_types (plural)
    venueTypes: splitCsv(params.get("venue_type") || params.get("venue_types")),
    neighborhoods: splitCsv(params.get("neighborhoods") || params.get("neighborhood")),
    vibes: splitCsv(params.get("vibes")),
    cuisine: splitCsv(params.get("cuisine")),
    withEvents: params.get("with_events") === "true",
    occasion: params.get("occasion") || null,
  };
}

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

export function useVenueDiscovery({
  portalId,
  portalSlug,
  isExclusive = false,
}: UseVenueDiscoveryOptions): UseVenueDiscoveryReturn {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialFilters = useMemo(
    () => parseFilterStateFromQuery(searchParams?.toString() || ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // Only parse once on mount — URL sync effect keeps them aligned
  );

  const initialTab = useMemo((): SpotsTab => {
    const raw = searchParams?.get("tab");
    return isValidSpotsTab(raw) ? raw : "eat-drink";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ openCount: number; neighborhoods: string[] }>({
    openCount: 0,
    neighborhoods: [],
  });
  // Sanitize initial filters: clear venueTypes that don't belong to the initial tab
  const sanitizedInitialFilters = useMemo(() => {
    if (initialFilters.venueTypes.length === 0) return initialFilters;
    const tabTypes = new Set(getTabVenueTypes(initialTab));
    const valid = initialFilters.venueTypes.filter((t) => tabTypes.has(t));
    if (valid.length === initialFilters.venueTypes.length) return initialFilters;
    return { ...initialFilters, venueTypes: valid };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [filters, setFilters] = useState<FilterState>(sanitizedInitialFilters);
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
  const [activeTab, setActiveTabRaw] = useState<SpotsTab>(initialTab);

  // Switch tabs — resets venueTypes, cuisine, vibes, occasion but preserves neighborhoods, openNow, priceLevel
  const setActiveTab = useCallback((tab: SpotsTab) => {
    setActiveTabRaw(tab);
    setFilters((f) => ({
      ...f,
      venueTypes: [],
      cuisine: [],
      vibes: [],
      occasion: null,
    }));
  }, []);

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
    if (filters.neighborhoods.length > 0) params.set("neighborhood", filters.neighborhoods.join(","));
    if (effectiveVibes.length > 0) params.set("vibes", effectiveVibes.join(","));
    if (effectiveCuisine.length > 0) params.set("cuisine", effectiveCuisine.join(","));
    if (urlSearch) params.set("q", urlSearch);
    if (userLocation) {
      params.set("center_lat", String(userLocation.lat));
      params.set("center_lng", String(userLocation.lng));
    }
    return params;
  }, [portalId, isExclusive, filters.venueTypes, filters.neighborhoods, filters.vibes, filters.cuisine, filters.occasion, activeTab, urlSearch, userLocation]);

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
        setLoading(true);
        setFetchError(null);
        try {
          const params = buildQueryParams();
          const res = await fetch(`/api/spots?${params}`, { signal: controller.signal });
          if (!res.ok) throw new Error(`Server error (${res.status})`);
          const data = await res.json();
          setSpots(data.spots || []);
          if (data.meta) {
            setMeta(data.meta);
          }
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

  // ── URL sync (share filter state with map mode) ────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    const setOrDelete = (key: string, value: string | null) => {
      if (value && value.length > 0) params.set(key, value);
      else params.delete(key);
    };

    setOrDelete("tab", activeTab !== "eat-drink" ? activeTab : null);
    setOrDelete("occasion", filters.occasion);
    setOrDelete("open_now", filters.openNow ? "true" : null);
    setOrDelete("with_events", filters.withEvents ? "true" : null);
    setOrDelete("price_level", filters.priceLevel.length > 0 ? filters.priceLevel.join(",") : null);
    setOrDelete("venue_type", filters.venueTypes.length > 0 ? filters.venueTypes.join(",") : null);
    setOrDelete("neighborhoods", filters.neighborhoods.length > 0 ? filters.neighborhoods.join(",") : null);
    params.delete("neighborhood");
    setOrDelete("vibes", filters.vibes.length > 0 ? filters.vibes.join(",") : null);
    setOrDelete("cuisine", filters.cuisine.length > 0 ? filters.cuisine.join(",") : null);

    const next = params.toString();
    const current = searchParams?.toString() || "";
    if (next !== current) {
      router.replace(`/${portalSlug}?${next}`, { scroll: false });
    }
  }, [
    activeTab,
    filters.occasion,
    filters.neighborhoods,
    filters.openNow,
    filters.priceLevel,
    filters.venueTypes,
    filters.vibes,
    filters.cuisine,
    filters.withEvents,
    portalSlug,
    router,
    searchParams,
  ]);

  // ── Retry helper ───────────────────────────────────────────────────────
  const retry = useCallback(() => {
    setFetchError(null);
    setLoading(true);
    const params = buildQueryParams();
    fetch(`/api/spots?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Server error (${res.status})`);
        return res.json();
      })
      .then((data) => {
        setSpots(data.spots || []);
        if (data.meta) setMeta(data.meta);
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
