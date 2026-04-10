"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  RankingGameDetail,
  RankingEntry,
  ParticipantRankings,
} from "@/lib/ranking-types";

interface UseRankingGameState {
  game: RankingGameDetail | null;
  myEntries: RankingEntry[];
  participants: ParticipantRankings[];
  loading: boolean;
  saving: boolean;
  saved: boolean;
  saveError: boolean;
}

export function useRankingGame(gameId: number, isAuthenticated: boolean) {
  const [state, setState] = useState<UseRankingGameState>({
    game: null,
    myEntries: [],
    participants: [],
    loading: true,
    saving: false,
    saved: false,
    saveError: false,
  });

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchGame = useCallback(async () => {
    const res = await fetch(`/api/goblinday/rankings/${gameId}`);
    if (!res.ok) return;
    const data = await res.json();
    setState((prev) => ({ ...prev, game: data.game }));
  }, [gameId]);

  const fetchMyEntries = useCallback(async () => {
    if (!isAuthenticated) return;
    const res = await fetch(`/api/goblinday/rankings/${gameId}/me`);
    if (!res.ok) return;
    const data = await res.json();
    setState((prev) => ({ ...prev, myEntries: data.entries || [] }));
  }, [gameId, isAuthenticated]);

  const fetchParticipants = useCallback(async () => {
    const res = await fetch(`/api/goblinday/rankings/${gameId}/entries`);
    if (!res.ok) return;
    const data = await res.json();
    setState((prev) => ({ ...prev, participants: data.participants || [] }));
  }, [gameId]);

  useEffect(() => {
    setState((prev) => ({ ...prev, loading: true }));
    Promise.all([fetchGame(), fetchMyEntries(), fetchParticipants()]).then(() => {
      setState((prev) => ({ ...prev, loading: false }));
    });
  }, [fetchGame, fetchMyEntries, fetchParticipants]);

  const saveRankings = useCallback(
    (categoryId: number, entries: RankingEntry[]) => {
      setState((prev) => {
        const otherEntries = prev.myEntries.filter((e) => {
          const cat = prev.game?.categories.find((c) =>
            c.items.some((i) => i.id === e.item_id)
          );
          return cat?.id !== categoryId;
        });
        return {
          ...prev,
          myEntries: [...otherEntries, ...entries],
          saved: false,
        };
      });

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);

      saveTimerRef.current = setTimeout(async () => {
        setState((prev) => ({ ...prev, saving: true, saveError: false }));
        try {
          const res = await fetch(`/api/goblinday/rankings/${gameId}/me`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category_id: categoryId, entries }),
          });
          if (res.ok) {
            setState((prev) => ({ ...prev, saving: false, saved: true, saveError: false }));
            savedTimerRef.current = setTimeout(() => {
              setState((prev) => ({ ...prev, saved: false }));
            }, 2000);
            fetchParticipants();
          } else {
            setState((prev) => ({ ...prev, saving: false, saveError: true }));
          }
        } catch {
          setState((prev) => ({ ...prev, saving: false, saveError: true }));
        }
      }, 500);
    },
    [gameId, fetchParticipants]
  );

  const refreshParticipants = useCallback(() => {
    fetchParticipants();
  }, [fetchParticipants]);

  const addItem = useCallback(async (categoryId: number, name: string, subtitle: string | null) => {
    const res = await fetch(`/api/goblinday/rankings/${gameId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_id: categoryId, name, subtitle }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    await fetchGame();
    return data.item;
  }, [gameId, fetchGame]);

  const editItem = useCallback(async (itemId: number, name: string, subtitle: string | null, imageUrl?: string | null) => {
    const body: Record<string, unknown> = { item_id: itemId, name, subtitle };
    if (imageUrl !== undefined) body.image_url = imageUrl;
    const res = await fetch(`/api/goblinday/rankings/${gameId}/items`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return false;
    await fetchGame();
    return true;
  }, [gameId, fetchGame]);

  const deleteItem = useCallback(async (itemId: number) => {
    const res = await fetch(`/api/goblinday/rankings/${gameId}/items`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId }),
    });
    if (!res.ok) return false;
    await fetchGame();
    await fetchParticipants();
    return true;
  }, [gameId, fetchGame, fetchParticipants]);

  return {
    game: state.game,
    myEntries: state.myEntries,
    participants: state.participants,
    loading: state.loading,
    saving: state.saving,
    saved: state.saved,
    saveError: state.saveError,
    saveRankings,
    refreshParticipants,
    addItem,
    editItem,
    deleteItem,
  };
}
