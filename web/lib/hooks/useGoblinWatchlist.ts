"use client";

import { useState, useEffect, useCallback } from "react";
import type { WatchlistEntry, WatchlistTag } from "@/lib/goblin-watchlist-utils";
import type { TMDBSearchResult } from "@/lib/goblin-log-utils";

interface UseGoblinWatchlistState {
  entries: WatchlistEntry[];
  tags: WatchlistTag[];
  loading: boolean;
}

interface UseGoblinWatchlistActions {
  addEntry: (data: { tmdb_id: number; note?: string; tag_ids?: number[] }) => Promise<boolean>;
  updateEntry: (
    entryId: number,
    data: Partial<{ note: string; tag_ids: number[] }>
  ) => Promise<boolean>;
  deleteEntry: (entryId: number) => Promise<boolean>;
  reorderEntries: (newOrder: WatchlistEntry[]) => Promise<boolean>;
  markWatched: (
    entryId: number,
    logData: {
      watched_date: string;
      note?: string;
      watched_with?: string;
      log_tag_ids?: number[];
    }
  ) => Promise<{ log_entry_id: number } | null>;
  createTag: (name: string) => Promise<WatchlistTag | null>;
  deleteTag: (tagId: number) => Promise<boolean>;
  searchTMDB: (query: string) => Promise<TMDBSearchResult[]>;
  refreshEntries: () => Promise<void>;
}

export function useGoblinWatchlist(
  isAuthenticated: boolean
): UseGoblinWatchlistState & UseGoblinWatchlistActions {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [tags, setTags] = useState<WatchlistTag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/goblinday/me/watchlist");
      if (!res.ok) return;
      const data = await res.json();
      setEntries(data.entries || []);
    } catch {
      // Non-critical
    }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch("/api/goblinday/me/watchlist-tags");
      if (!res.ok) return;
      const data = await res.json();
      setTags(data.tags || []);
    } catch {
      // Non-critical
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([fetchEntries(), fetchTags()]).finally(() => setLoading(false));
  }, [isAuthenticated, fetchEntries, fetchTags]);

  const addEntry = useCallback(
    async (data: { tmdb_id: number; note?: string; tag_ids?: number[] }) => {
      try {
        const res = await fetch("/api/goblinday/me/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) return false;
        await fetchEntries();
        return true;
      } catch {
        return false;
      }
    },
    [fetchEntries]
  );

  const updateEntry = useCallback(
    async (entryId: number, data: Partial<{ note: string; tag_ids: number[] }>) => {
      try {
        const res = await fetch(`/api/goblinday/me/watchlist/${entryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) return false;
        await fetchEntries();
        return true;
      } catch {
        return false;
      }
    },
    [fetchEntries]
  );

  const deleteEntry = useCallback(
    async (entryId: number) => {
      // Optimistic removal
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
      try {
        const res = await fetch(`/api/goblinday/me/watchlist/${entryId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          await fetchEntries(); // rollback
          return false;
        }
        return true;
      } catch {
        await fetchEntries();
        return false;
      }
    },
    [fetchEntries]
  );

  const reorderEntries = useCallback(
    async (newOrder: WatchlistEntry[]): Promise<boolean> => {
      // Optimistic: update UI immediately
      setEntries(newOrder);

      const order = newOrder.map((e, i) => ({ id: e.id, sort_order: i + 1 }));
      try {
        const res = await fetch("/api/goblinday/me/watchlist/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order }),
        });
        if (!res.ok) {
          await fetchEntries(); // rollback
          return false;
        }
        return true;
      } catch {
        await fetchEntries();
        return false;
      }
    },
    [fetchEntries]
  );

  const markWatched = useCallback(
    async (
      entryId: number,
      logData: {
        watched_date: string;
        note?: string;
        watched_with?: string;
        log_tag_ids?: number[];
      }
    ): Promise<{ log_entry_id: number } | null> => {
      // Optimistic removal from watchlist
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
      try {
        const res = await fetch(`/api/goblinday/me/watchlist/${entryId}/watched`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(logData),
        });
        if (!res.ok) {
          await fetchEntries(); // rollback
          return null;
        }
        const data = await res.json();
        return data.log_entry_id != null ? { log_entry_id: data.log_entry_id } : null;
      } catch {
        await fetchEntries();
        return null;
      }
    },
    [fetchEntries]
  );

  const createTag = useCallback(async (name: string): Promise<WatchlistTag | null> => {
    try {
      const res = await fetch("/api/goblinday/me/watchlist-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      setTags((prev) => [...prev, data.tag]);
      return data.tag;
    } catch {
      return null;
    }
  }, []);

  const deleteTag = useCallback(
    async (tagId: number) => {
      setTags((prev) => prev.filter((t) => t.id !== tagId));
      try {
        const res = await fetch(`/api/goblinday/me/watchlist-tags/${tagId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          await fetchTags();
          return false;
        }
        // Also refresh entries since tag associations were removed
        await fetchEntries();
        return true;
      } catch {
        await fetchTags();
        return false;
      }
    },
    [fetchTags, fetchEntries]
  );

  const searchTMDB = useCallback(async (query: string): Promise<TMDBSearchResult[]> => {
    if (query.length < 2) return [];
    try {
      const res = await fetch(
        `/api/goblinday/tmdb/search?q=${encodeURIComponent(query)}`
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.results || [];
    } catch {
      return [];
    }
  }, []);

  return {
    entries,
    tags,
    loading,
    addEntry,
    updateEntry,
    deleteEntry,
    reorderEntries,
    markWatched,
    createTag,
    deleteTag,
    searchTMDB,
    refreshEntries: fetchEntries,
  };
}
