"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "lostcity_recent_searches";
const MAX_RECENT_SEARCHES = 5;

interface RecentSearch {
  query: string;
  timestamp: number;
}

export function useRecentSearches() {
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentSearch[];
        // Filter out old searches (older than 30 days)
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const filtered = parsed.filter((s) => s.timestamp > thirtyDaysAgo);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial data load from localStorage
        setRecentSearches(filtered);
      }
    } catch (e) {
      console.error("Failed to load recent searches:", e);
    }
  }, []);

  // Save to localStorage whenever recentSearches changes
  const saveToStorage = useCallback((searches: RecentSearch[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
    } catch (e) {
      console.error("Failed to save recent searches:", e);
    }
  }, []);

  const addSearch = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (!trimmed || trimmed.length < 2) return;

      setRecentSearches((prev) => {
        // Remove duplicate if exists
        const filtered = prev.filter(
          (s) => s.query.toLowerCase() !== trimmed.toLowerCase()
        );
        // Add new search at the beginning
        const updated = [
          { query: trimmed, timestamp: Date.now() },
          ...filtered,
        ].slice(0, MAX_RECENT_SEARCHES);

        saveToStorage(updated);
        return updated;
      });
    },
    [saveToStorage]
  );

  const removeSearch = useCallback(
    (query: string) => {
      setRecentSearches((prev) => {
        const updated = prev.filter(
          (s) => s.query.toLowerCase() !== query.toLowerCase()
        );
        saveToStorage(updated);
        return updated;
      });
    },
    [saveToStorage]
  );

  const clearSearches = useCallback(() => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error("Failed to clear recent searches:", e);
    }
  }, []);

  return {
    recentSearches: recentSearches.map((s) => s.query),
    addSearch,
    removeSearch,
    clearSearches,
  };
}
