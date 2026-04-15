"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface GoblinList {
  id: number;
  name: string;
  movie_ids: number[];
}

interface GoblinUserState {
  user: User | null;
  bookmarks: Set<number>;
  watchlistMovieIds: Set<number>;
  watched: Set<number>;
  lists: GoblinList[];
  loading: boolean;
}

interface GoblinUserActions {
  toggleBookmark: (movieId: number) => Promise<void>;
  toggleWatched: (movieId: number) => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

export function useGoblinUser(): GoblinUserState & GoblinUserActions {
  const [user, setUser] = useState<User | null>(null);
  const [bookmarks, setBookmarks] = useState<Set<number>>(new Set());
  const [watched, setWatched] = useState<Set<number>>(new Set());
  const [lists, setLists] = useState<GoblinList[]>([]);
  const [watchlistMovieIds, setWatchlistMovieIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async () => {
    try {
      const res = await fetch("/api/goblinday/me");
      if (!res.ok) return;
      const data = await res.json();
      setBookmarks(new Set<number>(data.bookmarks ?? []));
      setWatched(new Set<number>(data.watched ?? []));
      setLists(data.lists ?? []);
      setWatchlistMovieIds(new Set<number>(data.watchlistMovieIds ?? []));
    } catch {
      // Non-critical: user data simply won't be loaded
    }
  }, []);

  const refreshUserData = useCallback(async () => {
    await fetchUserData();
  }, [fetchUserData]);

  // On mount: check auth state and subscribe to changes
  useEffect(() => {
    const supabase = createClient();

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchUserData().finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        fetchUserData();
      } else {
        setBookmarks(new Set());
        setWatched(new Set());
        setLists([]);
        setWatchlistMovieIds(new Set());
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  const toggleBookmark = useCallback(
    async (movieId: number) => {
      const wasOnWatchlist = watchlistMovieIds.has(movieId);
      // Optimistic update
      setWatchlistMovieIds((prev) => {
        const next = new Set(prev);
        if (wasOnWatchlist) next.delete(movieId);
        else next.add(movieId);
        return next;
      });
      try {
        if (wasOnWatchlist) {
          // Find the watchlist entry to delete
          const listRes = await fetch("/api/goblinday/me/watchlist");
          if (!listRes.ok) throw new Error("Failed");
          const listData = await listRes.json();
          const entry = (listData.entries || []).find(
            (e: {
              movie_id?: number | null;
              movie?: { id?: number | null } | null;
            }) => e.movie_id === movieId || e.movie?.id === movieId
          );
          if (entry) {
            const res = await fetch(`/api/goblinday/me/watchlist/${entry.id}`, {
              method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed");
          }
        } else {
          const res = await fetch("/api/goblinday/me/watchlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ movie_id: movieId }),
          });
          if (!res.ok) throw new Error("Failed");
        }
      } catch {
        // Rollback
        setWatchlistMovieIds((prev) => {
          const next = new Set(prev);
          if (wasOnWatchlist) next.add(movieId);
          else next.delete(movieId);
          return next;
        });
      }
    },
    [watchlistMovieIds]
  );

  const toggleWatched = useCallback(
    async (movieId: number) => {
      const wasWatched = watched.has(movieId);
      // Optimistic update
      setWatched((prev) => {
        const next = new Set(prev);
        if (wasWatched) next.delete(movieId);
        else next.add(movieId);
        return next;
      });
      try {
        const res = await fetch("/api/goblinday/me/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ movie_id: movieId, field: "watched", value: !wasWatched }),
        });
        if (!res.ok) throw new Error("Failed");
      } catch {
        // Rollback
        setWatched((prev) => {
          const next = new Set(prev);
          if (wasWatched) next.add(movieId);
          else next.delete(movieId);
          return next;
        });
      }
    },
    [watched]
  );

  const signIn = useCallback(async () => {
    const supabase = createClient();
    // Pass current path so the callback redirects back here after auth
    const currentPath = window.location.pathname + window.location.search;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(currentPath)}`,
      },
    });
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setBookmarks(new Set());
    setWatched(new Set());
    setLists([]);
    setWatchlistMovieIds(new Set());
  }, []);

  return {
    user,
    bookmarks: watchlistMovieIds,
    watchlistMovieIds,
    watched,
    lists,
    loading,
    toggleBookmark,
    toggleWatched,
    signIn,
    signOut,
    refreshUserData,
  };
}
