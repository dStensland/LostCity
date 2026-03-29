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
    deleteTag,
    searchTMDB,
    reorderEntries,
  } = useGoblinLog(isAuthenticated);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<LogEntry | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeDirector, setActiveDirector] = useState<string | null>(null);
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
      {/* Subtle noise texture overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-0"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }}
      />

      {/* Header */}
      <div className="mb-8 relative z-10">
        <div className="flex items-end justify-between gap-4 pb-4
          border-b-2 border-red-900/40">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-[0.2em] leading-none">
              The Log
            </h2>
            <p className="text-2xs text-zinc-600 font-mono mt-2 tracking-[0.3em] uppercase">
              {filteredEntries.length} film{filteredEntries.length !== 1 ? "s" : ""} / {year}
              {activeTag && <span className="text-amber-500/70"> / #{activeTag}</span>}
              {activeDirector && <span className="text-red-500/70"> / {activeDirector}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {username && (
              <button
                onClick={handleCopyShareLink}
                className="px-3 py-1.5 text-2xs font-mono font-bold tracking-[0.2em] uppercase
                  border-2 border-zinc-700 text-zinc-500
                  hover:text-white hover:border-red-700 hover:bg-red-950/30
                  active:scale-95 transition-all"
              >
                {copied ? "COPIED!" : "SHARE"}
              </button>
            )}
            <button
              onClick={() => setAddModalOpen(true)}
              className="px-4 py-1.5 bg-red-700 text-white
                font-mono text-2xs font-black tracking-[0.2em] uppercase
                border-2 border-red-600
                hover:bg-red-600 hover:shadow-[0_0_20px_rgba(185,28,28,0.3)]
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
                          ? "bg-violet-500/15 border-violet-500/40 text-violet-400"
                          : "border-zinc-800 text-zinc-600 hover:text-zinc-400 hover:border-zinc-700"
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
        /* Ranked list */
        <div
          className="space-y-2 relative z-10"
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
