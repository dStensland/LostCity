"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

/**
 * Filter state for For You feed
 */
export interface ForYouFilters {
  search?: string;
  categories?: string[];
  subcategories?: string[];
  tags?: string[];
  neighborhoods?: string[];
  date?: "today" | "tomorrow" | "weekend" | "week";
  free?: boolean;
  personalized?: boolean; // When true, pre-filter to followed entities
}

/**
 * Filter keys that affect the feed query
 */
const FILTER_KEYS = [
  "search",
  "categories",
  "subcategories",
  "tags",
  "neighborhoods",
  "date",
  "free",
  "personalized",
] as const;

/**
 * Hook for managing For You feed filters via URL parameters
 * Similar to useEventFilters but specific to the personalized feed
 */
export function useForYouFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Parse current filters from URL
  const filters = useMemo((): ForYouFilters => {
    const personalizedParam = searchParams.get("personalized");
    return {
      search: searchParams.get("search") || undefined,
      categories: searchParams.get("categories")?.split(",").filter(Boolean) || undefined,
      subcategories: searchParams.get("subcategories")?.split(",").filter(Boolean) || undefined,
      tags: searchParams.get("tags")?.split(",").filter(Boolean) || undefined,
      neighborhoods: searchParams.get("neighborhoods")?.split(",").filter(Boolean) || undefined,
      date: (searchParams.get("date") as ForYouFilters["date"]) || undefined,
      free: searchParams.get("free") === "1" || undefined,
      // Default to true for personalized mode
      personalized: personalizedParam === null ? true : personalizedParam === "1",
    };
  }, [searchParams]);

  // Check if any filters are active (excluding personalized toggle)
  const hasActiveFilters = useMemo(() => {
    return !!(
      filters.search ||
      filters.categories?.length ||
      filters.subcategories?.length ||
      filters.tags?.length ||
      filters.neighborhoods?.length ||
      filters.date ||
      filters.free
    );
  }, [filters]);

  // Stable key for React Query (excludes personalized since it's a mode toggle)
  const filtersKey = useMemo(() => {
    const params = new URLSearchParams();
    FILTER_KEYS.forEach((key) => {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [searchParams]);

  // Update a single filter
  const setFilter = useCallback(
    (key: keyof ForYouFilters, value: string | string[] | boolean | undefined) => {
      const params = new URLSearchParams(searchParams.toString());

      if (value === undefined || (Array.isArray(value) && value.length === 0)) {
        params.delete(key);
      } else if (Array.isArray(value)) {
        params.set(key, value.join(","));
      } else if (typeof value === "boolean") {
        if (key === "personalized") {
          // Default is true, so only set param when false
          if (value) {
            params.delete(key);
          } else {
            params.set(key, "0");
          }
        } else {
          params.set(key, value ? "1" : "0");
        }
      } else {
        params.set(key, value);
      }

      // Reset cursor when filters change
      params.delete("cursor");

      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  // Update multiple filters at once
  const setFilters = useCallback(
    (updates: Partial<ForYouFilters>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || (Array.isArray(value) && value.length === 0)) {
          params.delete(key);
        } else if (Array.isArray(value)) {
          params.set(key, value.join(","));
        } else if (typeof value === "boolean") {
          if (key === "personalized") {
            if (value) {
              params.delete(key);
            } else {
              params.set(key, "0");
            }
          } else {
            params.set(key, value ? "1" : "0");
          }
        } else {
          params.set(key, value);
        }
      });

      // Reset cursor when filters change
      params.delete("cursor");

      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  // Clear all filters (keeps view and personalized mode)
  const clearFilters = useCallback(() => {
    const params = new URLSearchParams();
    // Keep the view param
    const view = searchParams.get("view");
    if (view) params.set("view", view);
    // Keep personalized mode if explicitly set
    const personalized = searchParams.get("personalized");
    if (personalized === "0") params.set("personalized", "0");

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [searchParams, router, pathname]);

  // Toggle personalized mode
  const togglePersonalized = useCallback(() => {
    setFilter("personalized", !filters.personalized);
  }, [filters.personalized, setFilter]);

  // Toggle a value in an array filter
  const toggleArrayFilter = useCallback(
    (key: "categories" | "subcategories" | "tags" | "neighborhoods", value: string) => {
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
    togglePersonalized,
    toggleArrayFilter,
    searchParams,
  };
}
