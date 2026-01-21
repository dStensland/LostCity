"use client";

import { useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

const STORAGE_KEY = "lostcity_saved_filters";
const FILTER_KEYS = ["categories", "neighborhoods", "vibes", "price", "date"] as const;

type FilterKey = (typeof FILTER_KEYS)[number];
type SavedFilters = Partial<Record<FilterKey, string>>;

interface UseFilterPersistenceOptions {
  /** Auto-restore saved filters when no filters are present in URL */
  autoRestore?: boolean;
  /** Keys to persist (default: all filter keys) */
  keys?: FilterKey[];
}

export function useFilterPersistence(options: UseFilterPersistenceOptions = {}) {
  const { autoRestore = false, keys = [...FILTER_KEYS] } = options;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasRestoredRef = useRef(false);

  // Get current filters from URL
  const getCurrentFilters = useCallback((): SavedFilters => {
    const filters: SavedFilters = {};
    for (const key of keys) {
      const value = searchParams.get(key);
      if (value) {
        filters[key] = value;
      }
    }
    return filters;
  }, [searchParams, keys]);

  // Check if URL has any of the tracked filters
  const hasUrlFilters = useCallback((): boolean => {
    return keys.some((key) => searchParams.has(key));
  }, [searchParams, keys]);

  // Save current filters to localStorage
  const saveFilters = useCallback(() => {
    const filters = getCurrentFilters();
    if (Object.keys(filters).length === 0) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch (e) {
      console.error("Failed to save filters:", e);
    }
  }, [getCurrentFilters]);

  // Load saved filters from localStorage
  const getSavedFilters = useCallback((): SavedFilters => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Failed to load saved filters:", e);
    }
    return {};
  }, []);

  // Restore saved filters to URL
  const restoreFilters = useCallback(() => {
    const savedFilters = getSavedFilters();
    if (Object.keys(savedFilters).length === 0) return false;

    const params = new URLSearchParams(searchParams.toString());
    let hasChanges = false;

    for (const [key, value] of Object.entries(savedFilters)) {
      if (value && !params.has(key)) {
        params.set(key, value);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      return true;
    }
    return false;
  }, [getSavedFilters, searchParams, pathname, router]);

  // Clear saved filters
  const clearSavedFilters = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error("Failed to clear saved filters:", e);
    }
  }, []);

  // Check if there are saved filters
  const hasSavedFilters = useCallback((): boolean => {
    return Object.keys(getSavedFilters()).length > 0;
  }, [getSavedFilters]);

  // Auto-save filters when they change
  useEffect(() => {
    if (hasUrlFilters()) {
      saveFilters();
    }
  }, [searchParams, hasUrlFilters, saveFilters]);

  // Auto-restore on mount if enabled and no URL filters
  useEffect(() => {
    if (autoRestore && !hasRestoredRef.current && !hasUrlFilters()) {
      hasRestoredRef.current = true;
      restoreFilters();
    }
  }, [autoRestore, hasUrlFilters, restoreFilters]);

  return {
    saveFilters,
    restoreFilters,
    clearSavedFilters,
    getSavedFilters,
    hasSavedFilters,
    hasUrlFilters,
  };
}
