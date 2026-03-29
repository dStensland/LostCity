"use client";

import { useState, useMemo, useCallback } from "react";
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

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <p className="text-[var(--muted)] font-mono text-sm text-center">
          Sign in to start logging movies
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-0">
      {/* Header row: year pills + add button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {YEARS.map((y) => (
            <button
              key={y}
              onClick={() => {
                setYear(y);
                setActiveTag(null);
              }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full font-mono text-xs font-medium
                border transition-all duration-200 ${
                  y === year
                    ? "bg-[var(--coral)]/15 border-[var(--coral)]/40 text-[var(--coral)]"
                    : "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--soft)]"
                }`}
            >
              {y}
            </button>
          ))}
        </div>

        <button
          onClick={() => setAddModalOpen(true)}
          className="flex-shrink-0 ml-3 px-4 py-1.5 rounded-full
            bg-[var(--coral)] text-[var(--void)]
            font-mono text-xs font-medium
            hover:brightness-110 active:scale-95 transition-all"
        >
          + Log Movie
        </button>
      </div>

      {/* Tag filter strip */}
      {tags.length > 0 && (
        <div className="flex items-center gap-1.5 mb-4 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTag(null)}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full font-mono text-xs
              border transition-all duration-200 ${
                !activeTag
                  ? "border-[var(--soft)]/40 text-[var(--cream)]"
                  : "border-[var(--twilight)] text-[var(--muted)]"
              }`}
          >
            All
          </button>
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => setActiveTag(activeTag === tag.name ? null : tag.name)}
              className="flex-shrink-0 px-2.5 py-1 rounded-full font-mono text-xs
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
      )}

      {/* Count */}
      <p className="text-xs text-[var(--muted)] font-mono mb-4">
        {filteredEntries.length} movie{filteredEntries.length !== 1 ? "s" : ""} in {year}
        {activeTag && ` tagged "${activeTag}"`}
      </p>

      {/* Loading state */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse flex items-center gap-3 h-24
              bg-[var(--twilight)]/20 rounded border border-[var(--twilight)]/30">
              <div className="w-12 h-full bg-[var(--twilight)]/40" />
              <div className="w-16 h-full bg-[var(--twilight)]/30" />
              <div className="flex-1 space-y-2 py-3">
                <div className="h-4 bg-[var(--twilight)]/40 rounded w-1/3" />
                <div className="h-3 bg-[var(--twilight)]/30 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-[var(--muted)] font-mono text-sm text-center mb-4">
            {activeTag
              ? `No movies tagged "${activeTag}" in ${year}`
              : `No movies logged in ${year} yet`}
          </p>
          {!activeTag && (
            <button
              onClick={() => setAddModalOpen(true)}
              className="px-4 py-2 rounded-lg border border-dashed border-[var(--twilight)]
                text-[var(--soft)] font-mono text-sm
                hover:border-[var(--coral)] hover:text-[var(--coral)] transition-colors"
            >
              Log your first movie
            </button>
          )}
        </div>
      ) : (
        /* Vertical ranked list */
        <div
          className="space-y-1"
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
