"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { useRankingGame } from "@/lib/hooks/useRankingGame";
import { useGoblinUser } from "@/lib/hooks/useGoblinUser";
import GoblinRankingList from "./GoblinRankingList";
import GoblinRankingCompare from "./GoblinRankingCompare";
import GoblinRankingGroup from "./GoblinRankingGroup";
import type { RankingEntry } from "@/lib/ranking-types";

interface Props {
  gameId: number;
}

type View = "mine" | "compare" | "group";

export default function GoblinRankingGamePage({ gameId }: Props) {
  const { user } = useGoblinUser();
  const isAuthenticated = user !== null;
  const { game, myEntries, participants, loading, saving, saved, saveRankings } =
    useRankingGame(gameId, isAuthenticated);

  const [activeCategoryIdx, setActiveCategoryIdx] = useState(0);
  const [view, setView] = useState<View>("mine");
  const scrollPositions = useRef<Map<number, number>>(new Map());

  const activeCategory = game?.categories[activeCategoryIdx] ?? null;

  const categoryItemIds = useMemo(() => {
    if (!activeCategory) return new Set<number>();
    return new Set(activeCategory.items.map((i) => i.id));
  }, [activeCategory]);

  const myCategoryEntries = useMemo(
    () => myEntries.filter((e) => categoryItemIds.has(e.item_id)),
    [myEntries, categoryItemIds]
  );

  const categoryParticipants = useMemo(
    () =>
      participants.map((p) => ({
        ...p,
        entries: p.entries.filter((e) => categoryItemIds.has(e.item_id)),
        items_ranked: p.entries.filter((e) => categoryItemIds.has(e.item_id)).length,
      })),
    [participants, categoryItemIds]
  );

  const handleSave = useCallback(
    (categoryId: number, entries: RankingEntry[]) => {
      saveRankings(categoryId, entries);
    },
    [saveRankings]
  );

  const handleCategorySwitch = useCallback(
    (idx: number) => {
      scrollPositions.current.set(activeCategoryIdx, window.scrollY);
      setActiveCategoryIdx(idx);
      const savedPos = scrollPositions.current.get(idx);
      if (savedPos != null) {
        requestAnimationFrame(() => window.scrollTo(0, savedPos));
      }
    },
    [activeCategoryIdx]
  );

  const isOpen = game?.status === "open";
  const effectiveView = !isOpen && view === "mine" ? "group" : view;

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 bg-zinc-900/50 border border-zinc-800/30 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="font-mono text-sm text-zinc-500">Game not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 pb-28">
      {/* Header */}
      <div className="mb-6">
        <div
          className="flex items-end justify-between gap-4 pb-4"
          style={{ borderBottom: "1px solid rgba(0,240,255,0.15)" }}
        >
          <div>
            {!isOpen && (
              <p className="text-2xs text-amber-500 font-mono tracking-[0.3em] uppercase mb-1">
                FINAL RESULTS
              </p>
            )}
            <h1
              className="text-2xl sm:text-3xl font-black text-white uppercase tracking-[0.25em] leading-none"
              style={{ textShadow: "0 0 30px rgba(0,240,255,0.2)" }}
            >
              {game.name}
            </h1>
            {game.description && (
              <p className="text-2xs text-zinc-600 font-mono mt-2 tracking-[0.2em] uppercase">
                {game.description}
              </p>
            )}
          </div>
          <div className="flex-shrink-0">
            {saving && (
              <span className="text-2xs text-cyan-500 font-mono animate-pulse">SAVING...</span>
            )}
            {saved && !saving && (
              <span className="text-2xs text-zinc-600 font-mono">SAVED</span>
            )}
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-1.5 mt-4 overflow-x-auto scrollbar-hide">
          {game.categories.map((cat, i) => (
            <button
              key={cat.id}
              onClick={() => handleCategorySwitch(i)}
              className={`flex-shrink-0 px-3 py-1 font-mono text-2xs font-bold tracking-wider uppercase
                border transition-all duration-200 ${
                  i === activeCategoryIdx
                    ? "border-cyan-600 text-cyan-300 bg-cyan-950/30 shadow-[0_0_10px_rgba(0,240,255,0.1)]"
                    : "border-zinc-800 text-zinc-600 hover:text-cyan-400/60 hover:border-cyan-800/40"
                }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1.5 mt-3">
          {(
            [
              { key: "mine" as View, label: "My Rankings" },
              { key: "compare" as View, label: "Compare" },
              { key: "group" as View, label: "Group Rankings" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`px-2.5 py-1 font-mono text-2xs tracking-wider uppercase
                border transition-all duration-200 ${
                  effectiveView === key
                    ? "border-fuchsia-600 text-fuchsia-300 bg-fuchsia-950/30"
                    : "border-zinc-800 text-zinc-600 hover:text-fuchsia-400/60 hover:border-fuchsia-800/40"
                }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* View content */}
      {activeCategory && effectiveView === "mine" && (
        <GoblinRankingList
          items={activeCategory.items}
          entries={myCategoryEntries}
          categoryId={activeCategory.id}
          isOpen={isOpen ?? false}
          onSave={handleSave}
        />
      )}

      {activeCategory && effectiveView === "compare" && user && (
        <GoblinRankingCompare
          items={activeCategory.items}
          myEntries={myCategoryEntries}
          participants={categoryParticipants}
          currentUserId={user.id}
        />
      )}

      {activeCategory && effectiveView === "group" && (
        <GoblinRankingGroup
          items={activeCategory.items}
          myEntries={myCategoryEntries}
          participants={categoryParticipants}
        />
      )}
    </div>
  );
}
