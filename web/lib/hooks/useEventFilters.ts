"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

/**
 * Filter state parsed from URL
 */
export interface EventFilters {
  search?: string;
  categories?: string[];
  tags?: string[];
  genres?: string[];
  vibes?: string[];
  neighborhoods?: string[];
  price?: string;
  date?: "today" | "weekend" | "week";
  mood?: string;
  view?: "events" | "calendar" | "map";
}

/**
 * Shared filters that persist across all views
 */
const SHARED_FILTER_KEYS = [
  "search",
  "categories",
  "tags",
  "genres",
  "vibes",
  "neighborhoods",
  "price",
  "mood",
] as const;

/**
 * View-specific filter keys
 */
const VIEW_SPECIFIC_KEYS: Record<string, string[]> = {
  events: ["date"],
  calendar: ["month"],
  map: ["bounds"],
};

/**
 * Hook for managing event filters via URL parameters
 * Provides type-safe access to filters and update functions
 */
export function useEventFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Parse current filters from URL
  const filters = useMemo((): EventFilters => {
    return {
      search: searchParams.get("search") || undefined,
      categories: searchParams.get("categories")?.split(",").filter(Boolean) || undefined,
      tags: searchParams.get("tags")?.split(",").filter(Boolean) || undefined,
      genres: searchParams.get("genres")?.split(",").filter(Boolean) || undefined,
      vibes: searchParams.get("vibes")?.split(",").filter(Boolean) || undefined,
      neighborhoods: searchParams.get("neighborhoods")?.split(",").filter(Boolean) || undefined,
      price: searchParams.get("price") || undefined,
      date: (searchParams.get("date") as EventFilters["date"]) || undefined,
      mood: searchParams.get("mood") || undefined,
      view: (searchParams.get("view") as EventFilters["view"]) || undefined,
    };
  }, [searchParams]);

  // Check if any filters are active (excluding view)
  const hasActiveFilters = useMemo(() => {
    return !!(
      filters.search ||
      filters.categories?.length ||
      filters.tags?.length ||
      filters.genres?.length ||
      filters.vibes?.length ||
      filters.neighborhoods?.length ||
      filters.price ||
      filters.date ||
      filters.mood
    );
  }, [filters]);

  // Stable searchParams string for React Query keys
  const filtersKey = useMemo(() => {
    const params = new URLSearchParams();
    SHARED_FILTER_KEYS.forEach((key) => {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    });
    // Include view-specific params
    const view = searchParams.get("view") || "events";
    VIEW_SPECIFIC_KEYS[view]?.forEach((key) => {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [searchParams]);

  // Update a single filter
  const setFilter = useCallback(
    (key: keyof EventFilters, value: string | string[] | undefined) => {
      const params = new URLSearchParams(searchParams.toString());

      if (value === undefined || (Array.isArray(value) && value.length === 0)) {
        params.delete(key);
      } else if (Array.isArray(value)) {
        params.set(key, value.join(","));
      } else {
        params.set(key, value);
      }

      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  // Update multiple filters at once
  const setFilters = useCallback(
    (updates: Partial<EventFilters>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || (Array.isArray(value) && value.length === 0)) {
          params.delete(key);
        } else if (Array.isArray(value)) {
          params.set(key, value.join(","));
        } else {
          params.set(key, value);
        }
      });

      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  // Clear all filters (optionally keep view)
  const clearFilters = useCallback(
    (keepView = true) => {
      const params = new URLSearchParams();
      if (keepView) {
        const view = searchParams.get("view");
        if (view) params.set("view", view);
      }
      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  // Switch view while preserving shared filters
  const switchView = useCallback(
    (newView: "events" | "calendar" | "map") => {
      const params = new URLSearchParams();

      // Copy shared filters
      SHARED_FILTER_KEYS.forEach((key) => {
        const value = searchParams.get(key);
        if (value) params.set(key, value);
      });

      // Set the new view
      if (newView !== "events") {
        params.set("view", newView);
      }

      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  // Toggle a value in an array filter
  const toggleArrayFilter = useCallback(
    (key: "categories" | "tags" | "genres" | "vibes" | "neighborhoods", value: string) => {
      const current = filters[key] || [];
      const newValues = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      setFilter(key, newValues.length > 0 ? newValues : undefined);
    },
    [filters, setFilter]
  );

  return {
    filters,
    filtersKey,
    hasActiveFilters,
    setFilter,
    setFilters,
    clearFilters,
    switchView,
    toggleArrayFilter,
    searchParams, // Expose raw searchParams for special cases
  };
}
