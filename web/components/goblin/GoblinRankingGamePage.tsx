"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRankingGame } from "@/lib/hooks/useRankingGame";
import { useGoblinUser } from "@/lib/hooks/useGoblinUser";
import GoblinRankingList from "./GoblinRankingList";
import GoblinRankingCompare from "./GoblinRankingCompare";
import GoblinRankingGroup from "./GoblinRankingGroup";
import { GoblinLoginPrompt } from "./GoblinLoginPrompt";
import type { RankingEntry } from "@/lib/ranking-types";

interface Props {
  gameId: number;
}

type View = "mine" | "compare" | "group";

export default function GoblinRankingGamePage({ gameId }: Props) {
  const { user } = useGoblinUser();
  const router = useRouter();
  const isAuthenticated = user !== null;
  const { game, myEntries, participants, loading, saving, saved, saveError, saveRankings, addItem, editItem, deleteItem } =
    useRankingGame(gameId, isAuthenticated);

  const [activeCategoryIdx, setActiveCategoryIdx] = useState(0);
  const [view, setView] = useState<View>("group");
  const [hasSetInitialView, setHasSetInitialView] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [glitching, setGlitching] = useState(false);
  const scrollPositions = useRef<Map<number, number>>(new Map());

  // Set initial view once auth resolves — logged-in users get "mine", guests get "group"
  useEffect(() => {
    if (!hasSetInitialView && !loading) {
      setView(isAuthenticated ? "mine" : "group");
      setHasSetInitialView(true);
    }
  }, [isAuthenticated, loading, hasSetInitialView]);

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
      setGlitching(true);
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
            <div key={i} className="h-14 bg-zinc-950 border border-zinc-800/30 animate-pulse" />
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
    <div
      className="max-w-3xl mx-auto px-4 py-4 pb-28 relative"
      style={{
        backgroundImage: `linear-gradient(rgba(0,240,255,0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,240,255,0.02) 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
      }}
    >
      {/* Scan line overlay */}
      <div
        className="fixed inset-0 pointer-events-none motion-safe:block hidden"
        aria-hidden="true"
        style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,240,255,0.015) 2px, rgba(0,240,255,0.015) 4px)",
          contain: "layout style paint",
          zIndex: 50,
        }}
      />

      {/* Header */}
      <div className="mb-6">
        <div
          className="flex items-end justify-between gap-4 pb-4"
          style={{ borderBottom: "1px solid rgba(0,240,255,0.15)" }}
        >
          <div>
            {/* Classification label */}
            <p className="font-mono text-[9px] text-cyan-500/40 tracking-[0.3em] uppercase mb-2">
              {isOpen ? "OPERATION ACTIVE" : "OPERATION CLOSED"} // RANKING PROTOCOL
            </p>
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
              <p className="text-2xs text-zinc-500 font-mono mt-2 tracking-[0.2em] uppercase">
                {game.description}
              </p>
            )}
            {/* Pulsing status dot + divider */}
            <div className="flex items-center gap-2 mt-3">
              <div
                className="w-1.5 h-1.5 rounded-full motion-safe:animate-[statusPulse_2s_ease-in-out_infinite]"
                style={{ background: "#00f0ff", boxShadow: "0 0 8px #00f0ff, 0 0 16px rgba(0,240,255,0.4)" }}
              />
              <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(0,240,255,0.4), transparent)" }} />
            </div>
          </div>
          <div className="flex-shrink-0">
            {saving && (
              <span className="text-2xs text-cyan-500 font-mono animate-pulse">SAVING...</span>
            )}
            {saveError && !saving && activeCategory && (
              <button
                onClick={() => saveRankings(activeCategory.id, myCategoryEntries)}
                className="text-2xs text-red-400 font-mono hover:text-red-300 transition-colors"
              >
                SAVE FAILED — TAP TO RETRY
              </button>
            )}
            {saved && !saving && !saveError && (
              <span className="text-2xs text-zinc-500 font-mono">SAVED</span>
            )}
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-2 mt-4 overflow-x-auto scrollbar-hide">
          {game.categories.map((cat, i) => (
            <button
              key={cat.id}
              onClick={() => handleCategorySwitch(i)}
              className={`flex-shrink-0 px-4 py-1.5 font-mono text-xs font-bold tracking-wider uppercase
                border transition-all duration-200 ${
                  i === activeCategoryIdx
                    ? "border-cyan-500/40 text-white bg-cyan-500/15"
                    : "border-zinc-800 text-zinc-500 hover:text-cyan-400/70 hover:border-cyan-800/40"
                }`}
              style={i === activeCategoryIdx ? {
                boxShadow: "0 0 12px rgba(0,240,255,0.1), inset 0 0 12px rgba(0,240,255,0.05)",
              } : undefined}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex items-center justify-end gap-1 mt-3">
          {([
            { key: "mine" as View, label: "My Rankings" },
            { key: "compare" as View, label: "Compare" },
            { key: "group" as View, label: "Group" },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`px-2 py-0.5 font-mono text-2xs tracking-wider uppercase
                transition-all duration-200 ${
                  effectiveView === key
                    ? "text-fuchsia-400 border-b border-fuchsia-500"
                    : "text-zinc-600 hover:text-fuchsia-400/60 border-b border-transparent"
                }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* View content with glitch transition */}
      <div
        className={glitching ? "motion-safe:animate-[glitchWipe_150ms_ease-out]" : ""}
        style={glitching ? { willChange: "clip-path" } : undefined}
        onAnimationEnd={() => setGlitching(false)}
      >
        {/* Sign-in banner for unauth users */}
        {!isAuthenticated && (
          <div className="mb-4 flex items-center justify-between px-3 py-2 border border-cyan-800/30 bg-cyan-950/10">
            <span className="font-mono text-2xs text-zinc-500 uppercase tracking-wider">
              Sign in to add your rankings and compare
            </span>
            <button
              onClick={() => setShowLogin(true)}
              className="px-3 py-1 border border-cyan-800/40 text-cyan-400
                font-mono text-2xs uppercase tracking-wider
                hover:bg-cyan-950/20 hover:border-cyan-700/50 transition-all"
            >
              SIGN IN
            </button>
          </div>
        )}

        {activeCategory && effectiveView === "mine" && (
          isAuthenticated ? (
            <GoblinRankingList
              items={activeCategory.items}
              entries={myCategoryEntries}
              categoryId={activeCategory.id}
              isOpen={isOpen ?? false}
              onSave={handleSave}
              onAddItem={addItem}
              onEditItem={editItem}
              onDeleteItem={deleteItem}
            />
          ) : (
            <div className="py-12 text-center">
              <p className="font-mono text-sm text-zinc-500 tracking-widest uppercase mb-4">
                Sign in to start ranking
              </p>
              <button
                onClick={() => setShowLogin(true)}
                className="px-5 py-2 border border-cyan-800/40 text-cyan-400
                  font-mono text-xs uppercase tracking-wider
                  hover:bg-cyan-950/20 hover:border-cyan-700/50 transition-all"
              >
                SIGN IN
              </button>
            </div>
          )
        )}

        {activeCategory && effectiveView === "compare" && (
          isAuthenticated && user ? (
            <GoblinRankingCompare
              items={activeCategory.items}
              myEntries={myCategoryEntries}
              participants={categoryParticipants}
              currentUserId={user.id}
            />
          ) : (
            <div className="py-12 text-center">
              <p className="font-mono text-sm text-zinc-500 tracking-widest uppercase mb-4">
                Sign in to compare rankings
              </p>
              <button
                onClick={() => setShowLogin(true)}
                className="px-5 py-2 border border-cyan-800/40 text-cyan-400
                  font-mono text-xs uppercase tracking-wider
                  hover:bg-cyan-950/20 hover:border-cyan-700/50 transition-all"
              >
                SIGN IN
              </button>
            </div>
          )
        )}

        {activeCategory && effectiveView === "group" && (
          <GoblinRankingGroup
            items={activeCategory.items}
            myEntries={myCategoryEntries}
            participants={categoryParticipants}
          />
        )}
      </div>

      <GoblinLoginPrompt
        open={showLogin}
        onClose={() => setShowLogin(false)}
        onSignIn={() => router.push("/auth/login?redirect=/goblinday/rankings/" + gameId)}
      />
    </div>
  );
}
