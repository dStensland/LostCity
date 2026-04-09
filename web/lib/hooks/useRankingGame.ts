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
}

export function useRankingGame(gameId: number, isAuthenticated: boolean) {
  const [state, setState] = useState<UseRankingGameState>({
    game: null,
    myEntries: [],
    participants: [],
    loading: true,
    saving: false,
    saved: false,
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
        setState((prev) => ({ ...prev, saving: true }));
        try {
          const res = await fetch(`/api/goblinday/rankings/${gameId}/me`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category_id: categoryId, entries }),
          });
          if (res.ok) {
            setState((prev) => ({ ...prev, saving: false, saved: true }));
            savedTimerRef.current = setTimeout(() => {
              setState((prev) => ({ ...prev, saved: false }));
            }, 2000);
            fetchParticipants();
          } else {
            setState((prev) => ({ ...prev, saving: false }));
          }
        } catch {
          setState((prev) => ({ ...prev, saving: false }));
        }
      }, 500);
    },
    [gameId, fetchParticipants]
  );

  const refreshParticipants = useCallback(() => {
    fetchParticipants();
  }, [fetchParticipants]);

  return {
    game: state.game,
    myEntries: state.myEntries,
    participants: state.participants,
    loading: state.loading,
    saving: state.saving,
    saved: state.saved,
    saveRankings,
    refreshParticipants,
  };
}
