"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useGoblinLog } from "@/lib/hooks/useGoblinLog";
import GoblinLogEntryCard from "./GoblinLogEntryCard";
import GoblinAddMovieModal from "./GoblinAddMovieModal";
import GoblinEditEntryModal from "./GoblinEditEntryModal";
import type { LogEntry } from "@/lib/goblin-log-utils";

interface Props {
  isAuthenticated: boolean;
}

const YEARS = Array.from(
  { length: new Date().getFullYear() - 2024 + 1 },
  (_, i) => new Date().getFullYear() - i
);

export default function GoblinLogView({ isAuthenticated }: Props) {
  const {
    entries,
    tags,
    loading,
    year,
    setYear,
    addEntry,
    updateEntry,
    deleteEntry,
    createTag,
    searchTMDB,
    reorderEntries,
  } = useGoblinLog(isAuthenticated);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<LogEntry | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch("/api/auth/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.profile?.username) setUsername(d.profile.username); })
      .catch(() => {});
  }, [isAuthenticated]);

  const filteredEntries = useMemo(() => {
    if (!activeTag) return entries;
    return entries.filter((e) => e.tags.some((t) => t.name === activeTag));
  }, [entries, activeTag]);

  const swapEntries = useCallback(
    async (indexA: number, indexB: number) => {
      if (indexB < 0 || indexB >= filteredEntries.length) return;
      const reordered = [...filteredEntries];
      [reordered[indexA], reordered[indexB]] = [reordered[indexB], reordered[indexA]];
      await reorderEntries(reordered);
    },
    [filteredEntries, reorderEntries]
  );

  const handleDrop = useCallback(
    async (toIndex: number) => {
      if (dragFrom === null || dragFrom === toIndex) {
        setDragFrom(null);
        setDragOver(null);
        return;
      }
      const reordered = [...filteredEntries];
      const [moved] = reordered.splice(dragFrom, 1);
      reordered.splice(toIndex, 0, moved);
      setDragFrom(null);
      setDragOver(null);
      await reorderEntries(reordered);
    },
    [dragFrom, filteredEntries, reorderEntries]
  );

  const moveToRank = useCallback(
    async (currentIndex: number, newRank: number) => {
      const targetIndex = Math.max(0, Math.min(newRank - 1, filteredEntries.length - 1));
      if (targetIndex === currentIndex) return;
      const reordered = [...filteredEntries];
      const [moved] = reordered.splice(currentIndex, 1);
      reordered.splice(targetIndex, 0, moved);
      await reorderEntries(reordered);
    },
    [filteredEntries, reorderEntries]
  );

  const handleCopyShareLink = () => {
    if (!username) return;
    const url = `${window.location.origin}/goblinday/log/${username}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <p className="text-zinc-500 font-mono text-sm text-center">
          Sign in to start logging movies
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6 pb-4 border-b border-zinc-800/60">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-[0.15em]">
              My Movie Log
            </h2>
            <p className="text-2xs text-zinc-500 font-mono mt-1 tracking-widest uppercase">
              {filteredEntries.length} movie{filteredEntries.length !== 1 ? "s" : ""} ranked in {year}
              {activeTag && <span className="text-amber-500/70"> · #{activeTag}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {username && (
              <button
                onClick={handleCopyShareLink}
                className="px-3 py-1.5 text-2xs font-mono font-bold tracking-wider uppercase
                  border border-zinc-700 text-zinc-400 hover:text-amber-400 hover:border-amber-500/40
                  transition-all"
              >
                {copied ? "COPIED!" : "SHARE"}
              </button>
            )}
            <button
              onClick={() => setAddModalOpen(true)}
              className="px-4 py-1.5 bg-amber-500 text-black
                font-mono text-2xs font-black tracking-wider uppercase
                hover:bg-amber-400 active:scale-95 transition-all"
            >
              + LOG MOVIE
            </button>
          </div>
        </div>

        {/* Year pills + tag filters */}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            {YEARS.map((y) => (
              <button
                key={y}
                onClick={() => {
                  setYear(y);
                  setActiveTag(null);
                }}
                className={`flex-shrink-0 px-3 py-1 font-mono text-2xs font-bold tracking-wider uppercase
                  border transition-all duration-200 ${
                    y === year
                      ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                      : "border-zinc-800 text-zinc-600 hover:text-zinc-400 hover:border-zinc-700"
                  }`}
              >
                {y}
              </button>
            ))}
          </div>
          {tags.length > 0 && (
            <>
              <div className="w-px h-4 bg-zinc-800 flex-shrink-0" />
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => setActiveTag(activeTag === tag.name ? null : tag.name)}
                    className="flex-shrink-0 px-2 py-0.5 rounded-full font-mono text-2xs font-medium
                      border transition-all duration-200"
                    style={{
                      backgroundColor: activeTag === tag.name ? `${tag.color}20` : "transparent",
                      borderColor: activeTag === tag.name ? `${tag.color}60` : "var(--twilight)",
                      color: activeTag === tag.name ? tag.color || "var(--cream)" : "var(--muted)",
                    }}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse flex items-stretch h-24
              bg-zinc-950 border border-zinc-800/40">
              <div className="w-12 bg-zinc-900/50" />
              <div className="w-20 bg-zinc-900/30" />
              <div className="flex-1 p-3 space-y-2">
                <div className="h-4 bg-zinc-800/40 rounded w-1/3" />
                <div className="h-3 bg-zinc-800/30 rounded w-1/2" />
                <div className="h-3 bg-zinc-800/20 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-zinc-500 font-mono text-sm text-center mb-1 tracking-widest uppercase">
            {activeTag
              ? `// Nothing tagged "${activeTag}" in ${year}`
              : `// No movies logged in ${year}`}
          </p>
          {!activeTag && (
            <button
              onClick={() => setAddModalOpen(true)}
              className="mt-4 px-5 py-2 border border-dashed border-zinc-700
                text-zinc-500 font-mono text-xs uppercase tracking-wider
                hover:border-amber-500/40 hover:text-amber-400 transition-colors"
            >
              Log your first movie
            </button>
          )}
        </div>
      ) : (
        /* Ranked list */
        <div
          className="space-y-0.5"
          onDragLeave={() => setDragOver(null)}
        >
          {filteredEntries.map((entry, i) => (
            <GoblinLogEntryCard
              key={entry.id}
              entry={entry}
              rank={i + 1}
              onEdit={setEditEntry}
              onMoveUp={() => swapEntries(i, i - 1)}
              onMoveDown={() => swapEntries(i, i + 1)}
              onMoveToRank={(rank) => moveToRank(i, rank)}
              isFirst={i === 0}
              isLast={i === filteredEntries.length - 1}
              onDragStart={() => setDragFrom(i)}
              onDragOver={() => setDragOver(i)}
              onDrop={() => handleDrop(i)}
              isDragging={dragFrom === i}
              isDragTarget={dragOver === i && dragFrom !== i}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <GoblinAddMovieModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSubmit={addEntry}
        searchTMDB={searchTMDB}
        tags={tags}
        onCreateTag={createTag}
      />

      <GoblinEditEntryModal
        entry={editEntry}
        open={editEntry !== null}
        onClose={() => setEditEntry(null)}
        onSave={updateEntry}
        onDelete={deleteEntry}
        tags={tags}
        onCreateTag={createTag}
      />
    </div>
  );
}
