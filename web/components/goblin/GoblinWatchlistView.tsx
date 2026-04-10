"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useGoblinWatchlist } from "@/lib/hooks/useGoblinWatchlist";
import { useGoblinLog } from "@/lib/hooks/useGoblinLog";
import GoblinWatchlistCard from "./GoblinWatchlistCard";
import GoblinAddToWatchlistModal from "./GoblinAddToWatchlistModal";
import GoblinWatchlistWatchedModal from "./GoblinWatchlistWatchedModal";
import GoblinTagPicker from "./GoblinTagPicker";
import type { WatchlistEntry, WatchlistTag } from "@/lib/goblin-watchlist-utils";

interface Props {
  isAuthenticated: boolean;
}

export default function GoblinWatchlistView({ isAuthenticated }: Props) {
  const {
    entries,
    tags,
    loading,
    addEntry,
    updateEntry,
    deleteEntry,
    reorderEntries,
    markWatched,
    createTag,
    deleteTag,
    searchTMDB,
  } = useGoblinWatchlist(isAuthenticated);

  // Log hook — needed for "Watched" flow (log tags + createTag)
  const logHook = useGoblinLog(isAuthenticated);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [watchedEntry, setWatchedEntry] = useState<WatchlistEntry | null>(null);
  const [editEntry, setEditEntry] = useState<WatchlistEntry | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  // Edit inline modal state
  const [editNote, setEditNote] = useState("");
  const [editTagIds, setEditTagIds] = useState<number[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  // Sync edit form when editEntry changes
  useEffect(() => {
    if (editEntry) {
      setEditNote(editEntry.note ?? "");
      setEditTagIds(editEntry.tags.map((t) => t.id));
    }
  }, [editEntry]);

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

  const handleWatched = useCallback(
    async (
      entryId: number,
      logData: {
        watched_date: string;
        note?: string;
        watched_with?: string;
        log_tag_ids?: number[];
      }
    ): Promise<{ log_entry_id: number } | null> => {
      const result = await markWatched(entryId, logData);
      if (result) setWatchedEntry(null);
      return result;
    },
    [markWatched]
  );

  const handleEditSave = useCallback(
    async (entryId: number, data: Partial<{ note: string; tag_ids: number[] }>) => {
      setEditSaving(true);
      await updateEntry(entryId, data);
      setEditSaving(false);
      setEditEntry(null);
    },
    [updateEntry]
  );

  const toggleEditTag = useCallback((tagId: number) => {
    setEditTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <p className="text-zinc-500 font-mono text-sm text-center">
          Sign in to build your queue
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto relative">
      {/* Header */}
      <div className="mb-8 relative z-10">
        <div
          className="flex items-end justify-between gap-4 pb-4"
          style={{ borderBottom: "1px solid rgba(255,217,61,0.15)" }}
        >
          <div>
            <h2
              className="text-2xl sm:text-3xl font-black text-white uppercase tracking-[0.25em] leading-none"
              style={{
                textShadow:
                  "0 0 30px rgba(255,217,61,0.2), 0 0 60px rgba(255,217,61,0.05)",
              }}
            >
              The Queue
            </h2>
            <p className="text-2xs text-zinc-600 font-mono mt-2 tracking-[0.3em] uppercase">
              {filteredEntries.length} film{filteredEntries.length !== 1 ? "s" : ""}
              {activeTag && (
                <span className="text-amber-400/70"> / #{activeTag}</span>
              )}
            </p>
          </div>
          <button
            onClick={() => setAddModalOpen(true)}
            className="px-4 py-1.5 text-white
              font-mono text-2xs font-black tracking-[0.2em] uppercase
              border border-amber-600 bg-amber-950/40
              hover:bg-amber-900/40 hover:shadow-[0_0_20px_rgba(255,217,61,0.2)]
              active:scale-95 transition-all"
          >
            + ADD
          </button>
        </div>

        {/* Tag filters */}
        {tags.length > 0 && (
          <div
            className="flex items-center gap-1.5 mt-4 overflow-x-auto scrollbar-hide
              [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] sm:[mask-image:none]"
          >
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex-shrink-0 flex items-center gap-0.5 rounded-full font-mono text-2xs font-medium
                  border transition-all duration-200 group/tag"
                style={{
                  backgroundColor:
                    activeTag === tag.name ? `${tag.color}20` : "transparent",
                  borderColor:
                    activeTag === tag.name
                      ? `${tag.color}60`
                      : "var(--twilight)",
                  color:
                    activeTag === tag.name
                      ? tag.color || "var(--cream)"
                      : "var(--muted)",
                }}
              >
                <button
                  onClick={() =>
                    setActiveTag(activeTag === tag.name ? null : tag.name)
                  }
                  className="pl-2 pr-0.5 py-0.5"
                >
                  {tag.name}
                </button>
                <button
                  onClick={async () => {
                    if (activeTag === tag.name) setActiveTag(null);
                    await deleteTag(tag.id);
                  }}
                  className="pr-1.5 py-0.5 opacity-0 group-hover/tag:opacity-100
                    hover:text-red-400 transition-all"
                  title={`Delete "${tag.name}" tag`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Loading skeleton */}
      {loading ? (
        <div className="space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse flex items-stretch h-24
                bg-zinc-950 border border-zinc-800/40"
            >
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
              ? `// Nothing tagged "${activeTag}" in the queue`
              : "// Nothing in the queue yet"}
          </p>
          {!activeTag && (
            <button
              onClick={() => setAddModalOpen(true)}
              className="mt-4 px-5 py-2 border border-dashed border-zinc-700
                text-zinc-500 font-mono text-xs uppercase tracking-wider
                hover:border-amber-500/40 hover:text-amber-400 transition-colors"
            >
              Add a movie
            </button>
          )}
        </div>
      ) : (
        /* Flat ranked list — no tier grouping */
        <div
          className="relative z-10 space-y-1.5"
          onDragLeave={() => setDragOver(null)}
        >
          {filteredEntries.map((entry, i) => (
            <GoblinWatchlistCard
              key={entry.id}
              entry={entry}
              rank={i + 1}
              onEdit={setEditEntry}
              onWatched={setWatchedEntry}
              onRemove={deleteEntry}
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

      {/* Add to Watchlist Modal */}
      <GoblinAddToWatchlistModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSubmit={addEntry}
        searchTMDB={searchTMDB}
        tags={tags}
        onCreateTag={createTag}
      />

      {/* Watched Modal */}
      <GoblinWatchlistWatchedModal
        entry={watchedEntry}
        open={watchedEntry !== null}
        onClose={() => setWatchedEntry(null)}
        onSubmit={handleWatched}
        logTags={logHook.tags}
        onCreateLogTag={logHook.createTag}
      />

      {/* Edit Inline Modal */}
      {editEntry !== null &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4
              bg-black/60 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setEditEntry(null);
            }}
          >
            <div
              className="relative bg-[var(--night)] border border-[var(--twilight)]
                rounded-xl p-6 max-w-md w-full shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              {/* Close */}
              <button
                onClick={() => setEditEntry(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full
                  hover:bg-[var(--twilight)] transition-colors
                  flex items-center justify-center text-[var(--muted)]"
              >
                ✕
              </button>

              <h2 className="text-xl font-semibold text-[var(--cream)] mb-6 pr-10 truncate">
                Edit — {editEntry.movie.title}
              </h2>

              {/* Note */}
              <div className="mb-4">
                <label className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
                  Note
                </label>
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Why this movie? Who recommended it?"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg resize-none
                    bg-[var(--dusk)] border border-[var(--twilight)]
                    text-[var(--cream)] font-mono text-sm
                    placeholder:text-[var(--muted)]
                    focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {/* Tags */}
              <div className="mb-6">
                <label className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
                  Tags
                </label>
                <GoblinTagPicker
                  tags={tags as { id: number; name: string; color: string | null }[]}
                  selectedIds={editTagIds}
                  onToggle={toggleEditTag}
                  onCreate={
                    createTag as (
                      name: string
                    ) => Promise<{ id: number; name: string; color: string | null } | null>
                  }
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setEditEntry(null)}
                  className="flex-1 py-2.5 bg-[var(--twilight)] text-[var(--cream)] rounded-lg
                    font-mono text-sm hover:bg-[var(--dusk)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    handleEditSave(editEntry.id, {
                      note: editNote.trim() || undefined,
                      tag_ids: editTagIds,
                    })
                  }
                  disabled={editSaving}
                  className="flex-1 py-2.5 bg-amber-600 text-black rounded-lg
                    font-mono text-sm font-medium disabled:opacity-50
                    hover:bg-amber-500 transition-colors"
                >
                  {editSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
