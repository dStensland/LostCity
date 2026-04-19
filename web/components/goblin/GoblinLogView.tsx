"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useGoblinLog } from "@/lib/hooks/useGoblinLog";
import { useGoblinGroups } from "@/lib/hooks/useGoblinGroups";
import GoblinLogEntryCard from "./GoblinLogEntryCard";
import GoblinAddMovieModal from "./GoblinAddMovieModal";
import GoblinEditEntryModal from "./GoblinEditEntryModal";
import GoblinCreateGroupModal from "./GoblinCreateGroupModal";
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
    lists,
    loading,
    year,
    setYear,
    addEntry,
    updateEntry,
    deleteEntry,
    createTag,
    deleteTag,
    searchTMDB,
    reorderEntries,
    refreshEntries,
    createList,
    updateList,
  } = useGoblinLog(isAuthenticated);

  // Groups hook is used to seed new groups from the log via CreateGroupModal
  // (it owns TMDB person search + filmography helpers). We don't use its
  // `groups` state — lists from useGoblinLog drives the log's section headers.
  const groupsHook = useGoblinGroups(isAuthenticated);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<LogEntry | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeDirector, setActiveDirector] = useState<string | null>(null);
  // Drag state keyed by (listKey, bucketIdx) so reorder stays within a bucket.
  // listKey is the group's list_id or null for "Unsorted".
  const [dragFrom, setDragFrom] = useState<{ listKey: number | null; bucketIdx: number } | null>(null);
  const [dragOver, setDragOver] = useState<{ listKey: number | null; bucketIdx: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  // Inline-rename state: the list_id currently being renamed + draft name.
  const [renamingListId, setRenamingListId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch("/api/auth/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.profile?.username) setUsername(d.profile.username); })
      .catch(() => {});
  }, [isAuthenticated]);

  // Directors with 2+ movies in the current year
  const directors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      const d = e.movie.director;
      if (d) counts.set(d, (counts.get(d) || 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (activeTag) {
      result = result.filter((e) => e.tags.some((t) => t.name === activeTag));
    }
    if (activeDirector) {
      result = result.filter((e) => e.movie.director === activeDirector);
    }
    return result;
  }, [entries, activeTag, activeDirector]);

  // Partition entries by list_id, preserving first-appearance order for the
  // list sequence. "Unsorted" (null) always renders last.
  // Rank is per-bucket so dragging Mission Impossible entries doesn't affect
  // Sword & Sorcery rankings.
  const partition = useMemo(() => {
    const listOrder: (number | null)[] = [];
    const buckets = new Map<number | null, LogEntry[]>();
    for (const entry of filteredEntries) {
      const key = entry.list_id ?? null;
      if (!buckets.has(key)) {
        buckets.set(key, []);
        listOrder.push(key);
      }
      buckets.get(key)!.push(entry);
    }
    const nullIdx = listOrder.indexOf(null);
    if (nullIdx !== -1 && nullIdx !== listOrder.length - 1) {
      listOrder.splice(nullIdx, 1);
      listOrder.push(null);
    }
    return { listOrder, buckets };
  }, [filteredEntries]);

  // Flatten partition + single-bucket edit back to a flat ordered list,
  // preserving cross-bucket sequence.
  const flattenWithBucketEdit = useCallback(
    (listKey: number | null, newBucket: LogEntry[]): LogEntry[] => {
      const flat: LogEntry[] = [];
      for (const key of partition.listOrder) {
        const source = key === listKey ? newBucket : partition.buckets.get(key)!;
        flat.push(...source);
      }
      return flat;
    },
    [partition]
  );

  const swapWithinBucket = useCallback(
    async (listKey: number | null, bucketIdxA: number, bucketIdxB: number) => {
      const bucket = partition.buckets.get(listKey);
      if (!bucket) return;
      if (bucketIdxB < 0 || bucketIdxB >= bucket.length) return;
      const newBucket = [...bucket];
      [newBucket[bucketIdxA], newBucket[bucketIdxB]] = [newBucket[bucketIdxB], newBucket[bucketIdxA]];
      await reorderEntries(flattenWithBucketEdit(listKey, newBucket));
    },
    [partition, flattenWithBucketEdit, reorderEntries]
  );

  const moveToRankInBucket = useCallback(
    async (listKey: number | null, currentBucketIdx: number, newRank: number) => {
      const bucket = partition.buckets.get(listKey);
      if (!bucket) return;
      const targetIdx = Math.max(0, Math.min(newRank - 1, bucket.length - 1));
      if (targetIdx === currentBucketIdx) return;
      const newBucket = [...bucket];
      const [moved] = newBucket.splice(currentBucketIdx, 1);
      newBucket.splice(targetIdx, 0, moved);
      await reorderEntries(flattenWithBucketEdit(listKey, newBucket));
    },
    [partition, flattenWithBucketEdit, reorderEntries]
  );

  const handleDropInBucket = useCallback(
    async (listKey: number | null, toBucketIdx: number) => {
      // Only accept drops from the same bucket; cross-bucket moves are ignored.
      if (!dragFrom || dragFrom.listKey !== listKey) {
        setDragFrom(null);
        setDragOver(null);
        return;
      }
      const fromBucketIdx = dragFrom.bucketIdx;
      setDragFrom(null);
      setDragOver(null);
      if (fromBucketIdx === toBucketIdx) return;
      const bucket = partition.buckets.get(listKey);
      if (!bucket) return;
      const newBucket = [...bucket];
      const [moved] = newBucket.splice(fromBucketIdx, 1);
      newBucket.splice(toBucketIdx, 0, moved);
      await reorderEntries(flattenWithBucketEdit(listKey, newBucket));
    },
    [dragFrom, partition, flattenWithBucketEdit, reorderEntries]
  );

  const handleMoveEntryToGroup = useCallback(
    async (entryId: number, targetListId: number | null): Promise<boolean> => {
      const ok = await updateEntry(entryId, { list_id: targetListId });
      return ok;
    },
    [updateEntry]
  );

  const startRename = useCallback((listId: number, currentName: string) => {
    setRenamingListId(listId);
    setRenameDraft(currentName);
  }, []);

  const cancelRename = useCallback(() => {
    setRenamingListId(null);
    setRenameDraft("");
  }, []);

  const commitRename = useCallback(async () => {
    if (renamingListId == null) return;
    const trimmed = renameDraft.trim();
    const current = lists.find((l) => l.id === renamingListId);
    // No-op guards: empty name or unchanged name — just cancel.
    if (!trimmed || trimmed === current?.name) {
      cancelRename();
      return;
    }
    const ok = await updateList(renamingListId, { name: trimmed });
    cancelRename();
    if (ok) await refreshEntries();
  }, [renamingListId, renameDraft, lists, updateList, cancelRename, refreshEntries]);

  useEffect(() => {
    if (renamingListId != null && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingListId]);

  const handleCopyShareLink = () => {
    if (!username) return;
    // Always use lostcity.ai as canonical host (goblinday.com is an alias)
    const url = `https://lostcity.ai/goblinday/log/${username}`;
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
    <div className="max-w-3xl mx-auto relative">
      {/* Header */}
      <div className="mb-8 relative z-10">
        <div className="flex items-end justify-between gap-4 pb-4"
          style={{ borderBottom: "1px solid rgba(0,240,255,0.15)" }}>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-[0.25em] leading-none"
              style={{ textShadow: "0 0 30px rgba(0,240,255,0.2), 0 0 60px rgba(0,240,255,0.05)" }}>
              The Log
            </h2>
            <p className="text-2xs text-zinc-600 font-mono mt-2 tracking-[0.3em] uppercase">
              {filteredEntries.length} film{filteredEntries.length !== 1 ? "s" : ""} / {year}
              {activeTag && <span className="text-cyan-400/70"> / #{activeTag}</span>}
              {activeDirector && <span className="text-fuchsia-400/70"> / {activeDirector}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {username && (
              <button
                onClick={handleCopyShareLink}
                className="px-3 py-1.5 text-2xs font-mono font-bold tracking-[0.2em] uppercase
                  border border-zinc-700 text-zinc-500
                  hover:text-cyan-300 hover:border-cyan-700 hover:shadow-[0_0_12px_rgba(0,240,255,0.15)]
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
                hover:text-cyan-300 hover:border-cyan-700 hover:shadow-[0_0_12px_rgba(0,240,255,0.15)]
                active:scale-95 transition-all"
            >
              + GROUP
            </button>
            <button
              onClick={() => setAddModalOpen(true)}
              className="px-4 py-1.5 text-white
                font-mono text-2xs font-black tracking-[0.2em] uppercase
                border border-cyan-600 bg-cyan-950/40
                hover:bg-cyan-900/40 hover:shadow-[0_0_20px_rgba(0,240,255,0.2)]
                active:scale-95 transition-all"
            >
              + LOG
            </button>
          </div>
        </div>

        {/* Year pills + tag filters */}
        <div className="flex items-center gap-4 mt-4 overflow-x-auto scrollbar-hide
          [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] sm:[mask-image:none]">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            {YEARS.map((y) => (
              <button
                key={y}
                onClick={() => {
                  setYear(y);
                  setActiveTag(null);
                  setActiveDirector(null);
                }}
                className={`flex-shrink-0 px-3 py-1 font-mono text-2xs font-bold tracking-wider uppercase
                  border transition-all duration-200 ${
                    y === year
                      ? "border-cyan-600 text-cyan-300 bg-cyan-950/30 shadow-[0_0_10px_rgba(0,240,255,0.1)]"
                      : "border-zinc-800 text-zinc-600 hover:text-cyan-400/60 hover:border-cyan-800/40"
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
                  <div
                    key={tag.id}
                    className="flex-shrink-0 flex items-center gap-0.5 rounded-full font-mono text-2xs font-medium
                      border transition-all duration-200 group/tag"
                    style={{
                      backgroundColor: activeTag === tag.name ? `${tag.color}20` : "transparent",
                      borderColor: activeTag === tag.name ? `${tag.color}60` : "var(--twilight)",
                      color: activeTag === tag.name ? tag.color || "var(--cream)" : "var(--muted)",
                    }}
                  >
                    <button
                      onClick={() => setActiveTag(activeTag === tag.name ? null : tag.name)}
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
            </>
          )}
          {directors.length > 0 && (
            <>
              <div className="w-px h-4 bg-zinc-800 flex-shrink-0" />
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                {directors.map(({ name, count }) => (
                  <button
                    key={name}
                    onClick={() => setActiveDirector(activeDirector === name ? null : name)}
                    className={`flex-shrink-0 px-2 py-0.5 font-mono text-2xs font-medium
                      border transition-all duration-200 ${
                        activeDirector === name
                          ? "border-fuchsia-600 text-fuchsia-300 bg-fuchsia-950/30 shadow-[0_0_8px_rgba(255,0,170,0.1)]"
                          : "border-zinc-800 text-zinc-600 hover:text-fuchsia-400/60 hover:border-fuchsia-800/40"
                      }`}
                  >
                    {name} [{count}]
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
        /* Grouped by list, with per-group rankings + tier stripes within each group */
        <div
          className="relative z-10"
          onDragLeave={() => setDragOver(null)}
        >
          {partition.listOrder.map((listKey) => {
            const bucket = partition.buckets.get(listKey)!;
            const list = listKey !== null ? lists.find((l) => l.id === listKey) : null;
            const listName = list?.name ?? "Unsorted";

            // Compute tier groups within this bucket — tier state resets per
            // list so a tier from one list doesn't bleed into the next.
            type BucketEntry = { entry: LogEntry; bucketIdx: number };
            type TierGroup = {
              tierName: string | null;
              tierColor: string | null;
              entries: BucketEntry[];
            };
            const tierGroups: TierGroup[] = [];
            let currentTier: TierGroup | null = null;
            bucket.forEach((entry, bucketIdx) => {
              if (entry.tier_name || !currentTier) {
                currentTier = {
                  tierName: entry.tier_name || null,
                  tierColor: entry.tier_color || null,
                  entries: [],
                };
                tierGroups.push(currentTier);
              }
              currentTier.entries.push({ entry, bucketIdx });
            });

            // Always render a section header once there's at least one named
            // list (so "Unsorted" is visually distinct from grouped entries).
            const showHeader = partition.listOrder.length > 1;

            return (
              <section
                key={listKey ?? "__unsorted__"}
                className="mb-8 last:mb-0"
              >
                {showHeader && (
                  <div className="mb-3 flex items-baseline justify-between gap-4">
                    {listKey != null && renamingListId === listKey ? (
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename();
                          else if (e.key === "Escape") cancelRename();
                        }}
                        onBlur={commitRename}
                        maxLength={60}
                        className="flex-1 min-w-0 bg-transparent border-b border-cyan-600/50
                          font-mono text-xs font-bold tracking-[0.25em] uppercase text-cyan-300
                          focus:outline-none focus:border-cyan-400 py-0.5"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          listKey != null ? startRename(listKey, listName) : undefined
                        }
                        disabled={listKey == null}
                        className={`font-mono text-xs font-bold tracking-[0.25em] uppercase
                          text-cyan-400/70 text-left truncate
                          ${listKey != null
                            ? "hover:text-cyan-300 transition-colors cursor-text"
                            : "cursor-default"}`}
                        style={{ textShadow: "0 0 8px rgba(0,240,255,0.15)" }}
                        title={listKey != null ? "Click to rename" : undefined}
                      >
                        {listName}
                      </button>
                    )}
                    <span className="font-mono text-2xs text-zinc-600 tracking-[0.2em] uppercase tabular-nums">
                      {bucket.length}
                    </span>
                  </div>
                )}
                {tierGroups.map((group, gi) => (
                  <div key={gi} className="flex mb-3">
                    {group.tierName ? (
                      <div
                        className="flex-shrink-0 w-6 sm:w-8 flex items-center justify-center relative"
                        style={{ borderLeft: `2px solid ${group.tierColor || "#00f0ff"}` }}
                      >
                        <span
                          className="font-mono text-2xs font-black uppercase tracking-[0.3em] whitespace-nowrap
                            [writing-mode:vertical-lr] rotate-180"
                          style={{
                            color: group.tierColor || "#00f0ff",
                            textShadow: `0 0 8px ${group.tierColor || "#00f0ff"}40`,
                          }}
                        >
                          {group.tierName}
                        </span>
                      </div>
                    ) : (
                      <div className="w-0" />
                    )}

                    <div className="flex-1 min-w-0 space-y-1.5">
                      {group.entries.map(({ entry, bucketIdx }) => (
                        <GoblinLogEntryCard
                          key={entry.id}
                          entry={entry}
                          rank={bucketIdx + 1}
                          tierColor={group.tierColor}
                          onEdit={setEditEntry}
                          onMoveUp={() => swapWithinBucket(listKey, bucketIdx, bucketIdx - 1)}
                          onMoveDown={() => swapWithinBucket(listKey, bucketIdx, bucketIdx + 1)}
                          onMoveToRank={(rank) => moveToRankInBucket(listKey, bucketIdx, rank)}
                          isFirst={bucketIdx === 0}
                          isLast={bucketIdx === bucket.length - 1}
                          onDragStart={() => setDragFrom({ listKey, bucketIdx })}
                          onDragOver={() => setDragOver({ listKey, bucketIdx })}
                          onDrop={() => handleDropInBucket(listKey, bucketIdx)}
                          isDragging={
                            dragFrom?.listKey === listKey && dragFrom?.bucketIdx === bucketIdx
                          }
                          isDragTarget={
                            dragOver?.listKey === listKey &&
                            dragOver?.bucketIdx === bucketIdx &&
                            dragFrom?.listKey === listKey &&
                            dragFrom?.bucketIdx !== bucketIdx
                          }
                          groups={lists}
                          currentListId={entry.list_id}
                          onMoveToGroup={(targetListId) =>
                            handleMoveEntryToGroup(entry.id, targetListId)
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <GoblinAddMovieModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSubmit={addEntry}
        searchTMDB={searchTMDB}
        tags={tags}
        lists={lists}
        onCreateTag={createTag}
      />

      <GoblinEditEntryModal
        entry={editEntry}
        open={editEntry !== null}
        onClose={() => setEditEntry(null)}
        onSave={updateEntry}
        onDelete={deleteEntry}
        tags={tags}
        lists={lists}
        onCreateTag={createTag}
      />

      <GoblinCreateGroupModal
        open={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
        onSubmit={async (data) => {
          await createList(data);
        }}
        searchPerson={groupsHook.searchPerson}
        getFilmography={groupsHook.getFilmography}
      />
    </div>
  );
}
