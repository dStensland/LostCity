"use client";

import { useState, useEffect, useCallback } from "react";
import type { LogEntry, GoblinTag, TMDBSearchResult } from "@/lib/goblin-log-utils";

interface UseGoblinLogState {
  entries: LogEntry[];
  tags: GoblinTag[];
  loading: boolean;
  year: number;
}

interface UseGoblinLogActions {
  setYear: (year: number) => void;
  addEntry: (data: {
    tmdb_id: number;
    watched_date: string;
    note?: string;
    watched_with?: string;
    tag_ids?: number[];
  }) => Promise<boolean>;
  updateEntry: (
    entryId: number,
    data: Partial<{
      watched_date: string;
      note: string;
      watched_with: string;
      tag_ids: number[];
      sort_order: number;
    }>
  ) => Promise<boolean>;
  deleteEntry: (entryId: number) => Promise<boolean>;
  createTag: (name: string) => Promise<GoblinTag | null>;
  updateTag: (tagId: number, data: { name?: string; color?: string }) => Promise<boolean>;
  deleteTag: (tagId: number) => Promise<boolean>;
  searchTMDB: (query: string) => Promise<TMDBSearchResult[]>;
  refreshEntries: () => Promise<void>;
  refreshTags: () => Promise<void>;
}

export function useGoblinLog(
  isAuthenticated: boolean
): UseGoblinLogState & UseGoblinLogActions {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [tags, setTags] = useState<GoblinTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  const fetchEntries = useCallback(async (y: number) => {
    try {
      const res = await fetch(`/api/goblinday/me/log?year=${y}`);
      if (!res.ok) return;
      const data = await res.json();
      setEntries(data.entries || []);
    } catch {
      // Non-critical
    }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch("/api/goblinday/me/tags");
      if (!res.ok) return;
      const data = await res.json();
      setTags(data.tags || []);
    } catch {
      // Non-critical
    }
  }, []);

  // Fetch on mount + year change
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([fetchEntries(year), fetchTags()]).finally(() =>
      setLoading(false)
    );
  }, [isAuthenticated, year, fetchEntries, fetchTags]);

  const addEntry = useCallback(
    async (data: {
      tmdb_id: number;
      watched_date: string;
      note?: string;
      watched_with?: string;
      tag_ids?: number[];
    }) => {
      try {
        const res = await fetch("/api/goblinday/me/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) return false;
        await fetchEntries(year);
        return true;
      } catch {
        return false;
      }
    },
    [year, fetchEntries]
  );

  const updateEntry = useCallback(
    async (entryId: number, data: any) => {
      try {
        const res = await fetch(`/api/goblinday/me/log/${entryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) return false;
        await fetchEntries(year);
        return true;
      } catch {
        return false;
      }
    },
    [year, fetchEntries]
  );

  const deleteEntry = useCallback(
    async (entryId: number) => {
      // Optimistic removal
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
      try {
        const res = await fetch(`/api/goblinday/me/log/${entryId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          await fetchEntries(year); // rollback
          return false;
        }
        return true;
      } catch {
        await fetchEntries(year);
        return false;
      }
    },
    [year, fetchEntries]
  );

  const createTag = useCallback(
    async (name: string): Promise<GoblinTag | null> => {
      try {
        const res = await fetch("/api/goblinday/me/tags", {
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
    },
    []
  );

  const updateTag = useCallback(
    async (tagId: number, data: { name?: string; color?: string }) => {
      try {
        const res = await fetch(`/api/goblinday/me/tags/${tagId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) return false;
        await fetchTags();
        return true;
      } catch {
        return false;
      }
    },
    [fetchTags]
  );

  const deleteTag = useCallback(
    async (tagId: number) => {
      setTags((prev) => prev.filter((t) => t.id !== tagId));
      try {
        const res = await fetch(`/api/goblinday/me/tags/${tagId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          await fetchTags();
          return false;
        }
        // Also refresh entries since tag associations were removed
        await fetchEntries(year);
        return true;
      } catch {
        await fetchTags();
        return false;
      }
    },
    [fetchTags, fetchEntries, year]
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
    year,
    setYear,
    addEntry,
    updateEntry,
    deleteEntry,
    createTag,
    updateTag,
    deleteTag,
    searchTMDB,
    refreshEntries: useCallback(() => fetchEntries(year), [fetchEntries, year]),
    refreshTags: fetchTags,
  };
}
