"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useGoblinWatchlist } from "@/lib/hooks/useGoblinWatchlist";
import { useGoblinLog } from "@/lib/hooks/useGoblinLog";
import { useGoblinGroups } from "@/lib/hooks/useGoblinGroups";
import GoblinWatchlistCard from "./GoblinWatchlistCard";
import GoblinAddToWatchlistModal from "./GoblinAddToWatchlistModal";
import GoblinWatchlistWatchedModal from "./GoblinWatchlistWatchedModal";
import GoblinGroupSection from "./GoblinGroupSection";
import GoblinCreateGroupModal from "./GoblinCreateGroupModal";
import GoblinTagPicker from "./GoblinTagPicker";
import SmartImage from "@/components/SmartImage";
import type { WatchlistEntry } from "@/lib/goblin-watchlist-utils";
import type { GoblinGroupMovie } from "@/lib/goblin-group-utils";

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
    recommendations,
    recommendationCount,
    addRecommendation,
    dismissRecommendation,
  } = useGoblinWatchlist(isAuthenticated);

  // Log hook — needed for "Watched" flow (log tags + createTag)
  const logHook = useGoblinLog(isAuthenticated);

  const groupsHook = useGoblinGroups(isAuthenticated);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [watchedEntry, setWatchedEntry] = useState<WatchlistEntry | null>(null);
  const [editEntry, setEditEntry] = useState<WatchlistEntry | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const [copied, setCopied] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [addToGroupId, setAddToGroupId] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch("/api/auth/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.profile?.username) setUsername(d.profile.username); })
      .catch(() => {});
  }, [isAuthenticated]);

  const handleCopyShareLink = () => {
    if (!username) return;
    const url = `https://lostcity.ai/goblinday/queue/${username}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

  const handleGroupReorderMovies = useCallback(
    async (groupId: number, newOrder: GoblinGroupMovie[]) => {
      const order = newOrder.map((m, i) => ({
        movie_id: m.movie_id,
        sort_order: i + 1,
      }));
      await groupsHook.reorderMovies(groupId, order);
      await groupsHook.refreshGroups();
    },
    [groupsHook]
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
          <div className="flex items-center gap-2">
            {username && (
              <button
                onClick={handleCopyShareLink}
                className="px-3 py-1.5 text-2xs font-mono font-bold tracking-[0.2em] uppercase
                  border border-zinc-700 text-zinc-500
                  hover:text-amber-300 hover:border-amber-700 hover:shadow-[0_0_12px_rgba(255,217,61,0.15)]
                  active:scale-95 transition-all"
              >
                {copied ? "COPIED!" : "SHARE"}
              </button>
            )}
            <button
              onClick={() => setCreateGroupOpen(true)}
              className="px-3 py-1.5 text-zinc-400
                font-mono text-2xs font-bold tracking-[0.2em] uppercase
                border border-zinc-700
                hover:text-amber-300 hover:border-amber-700 hover:shadow-[0_0_12px_rgba(255,217,61,0.15)]
                active:scale-95 transition-all"
            >
              + GROUP
            </button>
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

      {/* Pending recommendations — accept routes to Recommendations group */}
      {recommendationCount > 0 && (
        <div className="mb-8 relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-xs font-mono font-bold tracking-[0.2em] uppercase text-amber-500/80">
              Recommendations
            </h3>
            <span className="px-1.5 py-0.5 text-2xs font-mono font-bold bg-amber-950/40 border border-amber-800/30 text-amber-400">
              {recommendationCount}
            </span>
          </div>
          <div className="space-y-2">
            {recommendations.map((rec) => (
              <div key={rec.id}
                className="flex items-center gap-3 p-3 bg-[rgba(5,5,8,0.8)] border border-zinc-800/30
                  border-l-2 border-l-amber-700/40">
                <div className="w-10 h-15 flex-shrink-0 overflow-hidden bg-zinc-900">
                  {rec.movie.poster_path && (
                    <SmartImage
                      src={`https://image.tmdb.org/t/p/w185${rec.movie.poster_path}`}
                      alt={rec.movie.title} width={40} height={60} loading="lazy"
                      className="object-cover w-full h-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white uppercase tracking-wide truncate">
                    {rec.movie.title}
                    {rec.movie.year && <span className="text-zinc-600 font-normal ml-1.5">({rec.movie.year})</span>}
                  </p>
                  <p className="text-2xs text-zinc-500 font-mono mt-0.5">
                    from <span className="text-amber-500/70">{rec.recommender_name}</span>
                  </p>
                  {rec.note && (
                    <p className="text-2xs text-zinc-600 italic mt-1 line-clamp-1">
                      &ldquo;{rec.note}&rdquo;
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={async () => {
                      const ok = await addRecommendation(rec.id);
                      if (ok) await groupsHook.refreshGroups();
                    }}
                    className="px-2 py-1 text-2xs font-mono font-bold text-emerald-500
                      border border-emerald-800/40 hover:bg-emerald-950/30 transition-colors">
                    + ADD
                  </button>
                  <button
                    onClick={() => dismissRecommendation(rec.id)}
                    className="px-2 py-1 text-2xs font-mono text-zinc-700
                      hover:text-red-400 transition-colors">
                    x
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* Group sections */}
      {groupsHook.groups.length > 0 && (
        <div className="mt-10 space-y-6 relative z-10">
          <div
            className="h-px"
            style={{ background: "linear-gradient(to right, transparent, rgba(255,217,61,0.15), transparent)" }}
          />
          {groupsHook.groups.map((group) => (
            <GoblinGroupSection
              key={group.id}
              group={group}
              onAddMovie={() => setAddToGroupId(group.id)}
              onRemoveMovie={groupsHook.removeMovie}
              onMarkWatched={groupsHook.markWatched}
              onDeleteGroup={groupsHook.deleteGroup}
              onReorderMovies={handleGroupReorderMovies}
              logTags={logHook.tags}
              onCreateLogTag={logHook.createTag}
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

      {/* Create Group Modal */}
      <GoblinCreateGroupModal
        open={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
        onSubmit={async (data) => {
          await groupsHook.createGroup(data);
        }}
        searchPerson={groupsHook.searchPerson}
        getFilmography={groupsHook.getFilmography}
      />

      {/* Add Movie to Group Modal — reuses TMDB search */}
      <GoblinAddToWatchlistModal
        open={addToGroupId !== null}
        onClose={() => setAddToGroupId(null)}
        onSubmit={async (data) => {
          if (addToGroupId === null) return false;
          return await groupsHook.addMovie(addToGroupId, data.tmdb_id, data.note);
        }}
        searchTMDB={searchTMDB}
        tags={[]}
        onCreateTag={async () => null}
      />
    </div>
  );
}
