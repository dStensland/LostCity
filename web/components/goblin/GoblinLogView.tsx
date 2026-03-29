"use client";

import { useState, useMemo } from "react";
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
  } = useGoblinLog(isAuthenticated);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<LogEntry | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const filteredEntries = useMemo(() => {
    if (!activeTag) return entries;
    return entries.filter((e) => e.tags.some((t) => t.name === activeTag));
  }, [entries, activeTag]);

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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[2/3] rounded-lg bg-[var(--twilight)]/40" />
              <div className="mt-2 h-3 bg-[var(--twilight)]/40 rounded w-3/4" />
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
        /* Poster grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredEntries.map((entry, i) => (
            <GoblinLogEntryCard
              key={entry.id}
              entry={entry}
              index={i}
              onEdit={setEditEntry}
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
