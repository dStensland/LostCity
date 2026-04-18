"use client";

import { useState, useEffect, useCallback } from "react";
import type { LogEntry, GoblinTag, LogList, TMDBSearchResult } from "@/lib/goblin-log-utils";

interface UseGoblinLogState {
  entries: LogEntry[];
  tags: GoblinTag[];
  lists: LogList[];
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
    list_id?: number | null;
  }) => Promise<boolean>;
  updateEntry: (
    entryId: number,
    data: Partial<{
      watched_date: string;
      note: string;
      watched_with: string;
      tag_ids: number[];
      sort_order: number;
      list_id: number | null;
    }>
  ) => Promise<boolean>;
  deleteEntry: (entryId: number) => Promise<boolean>;
  createTag: (name: string) => Promise<GoblinTag | null>;
  updateTag: (tagId: number, data: { name?: string; color?: string }) => Promise<boolean>;
  deleteTag: (tagId: number) => Promise<boolean>;
  reorderEntries: (newOrder: LogEntry[]) => Promise<boolean>;
  searchTMDB: (query: string) => Promise<TMDBSearchResult[]>;
  refreshEntries: () => Promise<void>;
  refreshTags: () => Promise<void>;
}

export function useGoblinLog(
  isAuthenticated: boolean
): UseGoblinLogState & UseGoblinLogActions {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [tags, setTags] = useState<GoblinTag[]>([]);
  const [lists, setLists] = useState<LogList[]>([]);
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

  const fetchLists = useCallback(async () => {
    try {
      const res = await fetch("/api/goblinday/me/lists");
      if (!res.ok) return;
      const data = await res.json();
      // /me/lists includes movie_ids/count metadata we don't need here —
      // keep LogList slim to {id, name, slug}.
      interface RawList { id: number; name: string; slug: string | null }
      const raw: RawList[] = data.lists || [];
      setLists(raw.map((l) => ({ id: l.id, name: l.name, slug: l.slug })));
    } catch {
      // Non-critical
    }
  }, []);

  // Fetch on mount + year change
  /* eslint-disable react-hooks/set-state-in-effect --
     Fetch-on-year-or-auth-change loading pattern: short-circuits loading
     off for unauth users, otherwise flips loading on, fetches entries +
     tags in parallel, flips off. Cascade bounded — loading is not in
     the dep array ([isAuthenticated, year, fetchEntries, fetchTags]). */
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([fetchEntries(year), fetchTags(), fetchLists()]).finally(() =>
      setLoading(false)
    );
  }, [isAuthenticated, year, fetchEntries, fetchTags, fetchLists]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
    async (
      entryId: number,
      data: Partial<{
        watched_date: string;
        note: string;
        watched_with: string;
        tag_ids: number[];
        tier_name: string | null;
        tier_color: string | null;
      }>,
    ) => {
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

  const reorderEntries = useCallback(
    async (newOrder: LogEntry[]): Promise<boolean> => {
      // Optimistic: update UI immediately
      setEntries(newOrder);

      const order = newOrder.map((e, i) => ({ id: e.id, sort_order: i + 1 }));
      try {
        const res = await fetch("/api/goblinday/me/log/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order }),
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
    lists,
    loading,
    year,
    setYear,
    addEntry,
    updateEntry,
    deleteEntry,
    createTag,
    updateTag,
    deleteTag,
    reorderEntries,
    searchTMDB,
    refreshEntries: useCallback(() => fetchEntries(year), [fetchEntries, year]),
    refreshTags: fetchTags,
  };
}
