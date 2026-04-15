"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  GoblinGroup,
  TMDBPerson,
  TMDBFilmographyMovie,
} from "@/lib/goblin-group-utils";

export function useGoblinGroups(isAuthenticated: boolean) {
  const [groups, setGroups] = useState<GoblinGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/goblinday/me/lists");
      if (!res.ok) return;
      const data = await res.json();
      setGroups(data.groups || []);
    } catch {
      // Non-critical
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect --
     Fetch-on-auth-change loading pattern: short-circuits loading off for
     unauth users, otherwise flips loading on, fetches, flips off. Cascade
     bounded — loading is not in the dep array ([isAuthenticated, fetchGroups]). */
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchGroups().finally(() => setLoading(false));
  }, [isAuthenticated, fetchGroups]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const createGroup = useCallback(
    async (data: {
      name: string;
      description?: string;
      movie_tmdb_ids?: number[];
    }): Promise<GoblinGroup | null> => {
      try {
        const res = await fetch("/api/goblinday/me/lists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) return null;
        const result = await res.json();
        await fetchGroups();
        return result.group || null;
      } catch {
        return null;
      }
    },
    [fetchGroups]
  );

  const updateGroup = useCallback(
    async (
      groupId: number,
      data: Partial<{ name: string; description: string }>
    ): Promise<boolean> => {
      try {
        const res = await fetch(`/api/goblinday/me/lists/${groupId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) return false;
        await fetchGroups();
        return true;
      } catch {
        return false;
      }
    },
    [fetchGroups]
  );

  const deleteGroup = useCallback(
    async (groupId: number): Promise<boolean> => {
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      try {
        const res = await fetch(`/api/goblinday/me/lists/${groupId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          await fetchGroups();
          return false;
        }
        return true;
      } catch {
        await fetchGroups();
        return false;
      }
    },
    [fetchGroups]
  );

  const addMovie = useCallback(
    async (
      groupId: number,
      tmdbId: number,
      note?: string
    ): Promise<boolean> => {
      try {
        const res = await fetch(
          `/api/goblinday/me/lists/${groupId}/movies`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tmdb_id: tmdbId, note }),
          }
        );
        if (!res.ok) return false;
        await fetchGroups();
        return true;
      } catch {
        return false;
      }
    },
    [fetchGroups]
  );

  const removeMovie = useCallback(
    async (groupId: number, movieId: number): Promise<boolean> => {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, movies: g.movies.filter((m) => m.movie_id !== movieId) }
            : g
        )
      );
      try {
        const res = await fetch(
          `/api/goblinday/me/lists/${groupId}/movies/${movieId}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          await fetchGroups();
          return false;
        }
        return true;
      } catch {
        await fetchGroups();
        return false;
      }
    },
    [fetchGroups]
  );

  const markWatched = useCallback(
    async (
      groupId: number,
      movieId: number,
      logData: {
        watched_date: string;
        note?: string;
        watched_with?: string;
        log_tag_ids?: number[];
      }
    ): Promise<{ log_entry_id: number } | null> => {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, movies: g.movies.filter((m) => m.movie_id !== movieId) }
            : g
        )
      );
      try {
        const res = await fetch(
          `/api/goblinday/me/lists/${groupId}/movies/${movieId}/watched`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(logData),
          }
        );
        if (!res.ok) {
          await fetchGroups();
          return null;
        }
        const data = await res.json();
        return data.log_entry_id != null
          ? { log_entry_id: data.log_entry_id }
          : null;
      } catch {
        await fetchGroups();
        return null;
      }
    },
    [fetchGroups]
  );

  const reorderMovies = useCallback(
    async (
      groupId: number,
      order: { movie_id: number; sort_order: number }[]
    ): Promise<boolean> => {
      try {
        const res = await fetch(
          `/api/goblinday/me/lists/${groupId}/movies/reorder`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order }),
          }
        );
        if (!res.ok) return false;
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const reorderGroups = useCallback(
    async (
      order: { id: number; sort_order: number }[]
    ): Promise<boolean> => {
      try {
        const res = await fetch("/api/goblinday/me/lists/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order }),
        });
        if (!res.ok) return false;
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const searchPerson = useCallback(
    async (query: string): Promise<TMDBPerson[]> => {
      if (query.length < 2) return [];
      try {
        const res = await fetch(
          `/api/goblinday/tmdb/person?q=${encodeURIComponent(query)}`
        );
        if (!res.ok) return [];
        const data = await res.json();
        return data.results || [];
      } catch {
        return [];
      }
    },
    []
  );

  const getFilmography = useCallback(
    async (
      personId: number
    ): Promise<{
      person: { name: string };
      movies: TMDBFilmographyMovie[];
    } | null> => {
      try {
        const res = await fetch(
          `/api/goblinday/tmdb/person/${personId}/filmography`
        );
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    },
    []
  );

  return {
    groups,
    loading,
    createGroup,
    updateGroup,
    deleteGroup,
    addMovie,
    removeMovie,
    markWatched,
    reorderMovies,
    reorderGroups,
    searchPerson,
    getFilmography,
    refreshGroups: fetchGroups,
  };
}
