"use client";

import { useState, useCallback } from "react";
import GoblinWatchlistCard from "./GoblinWatchlistCard";
import GoblinWatchlistWatchedModal from "./GoblinWatchlistWatchedModal";
import type { GoblinGroup, GoblinGroupMovie } from "@/lib/goblin-group-utils";
import type { WatchlistEntry } from "@/lib/goblin-watchlist-utils";

interface Props {
  group: GoblinGroup;
  onAddMovie: () => void;
  onRemoveMovie: (groupId: number, movieId: number) => Promise<boolean>;
  onMarkWatched: (
    groupId: number,
    movieId: number,
    logData: {
      watched_date: string;
      note?: string;
      watched_with?: string;
      log_tag_ids?: number[];
    }
  ) => Promise<{ log_entry_id: number } | null>;
  onDeleteGroup: (groupId: number) => void;
  onReorderMovies: (
    groupId: number,
    newOrder: GoblinGroupMovie[]
  ) => Promise<void>;
  logTags: { id: number; name: string; color: string | null }[];
  onCreateLogTag: (name: string) => Promise<{ id: number; name: string; color: string | null } | null>;
}

function groupMovieToWatchlistEntry(gm: GoblinGroupMovie): WatchlistEntry {
  return {
    id: gm.movie_id,
    movie_id: gm.movie_id,
    note: gm.note,
    sort_order: gm.sort_order,
    added_at: gm.added_at,
    movie: gm.movie,
    tags: [],
  };
}

export default function GoblinGroupSection({
  group,
  onAddMovie,
  onRemoveMovie,
  onMarkWatched,
  onDeleteGroup,
  onReorderMovies,
  logTags,
  onCreateLogTag,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [watchedMovie, setWatchedMovie] = useState<GoblinGroupMovie | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const handleDrop = useCallback(
    async (toIndex: number) => {
      if (dragFrom === null || dragFrom === toIndex) {
        setDragFrom(null);
        setDragOver(null);
        return;
      }
      const reordered = [...group.movies];
      const [moved] = reordered.splice(dragFrom, 1);
      reordered.splice(toIndex, 0, moved);
      setDragFrom(null);
      setDragOver(null);
      await onReorderMovies(group.id, reordered);
    },
    [dragFrom, group.movies, group.id, onReorderMovies]
  );

  const handleWatched = useCallback(
    async (
      _entryId: number,
      logData: {
        watched_date: string;
        note?: string;
        watched_with?: string;
        log_tag_ids?: number[];
      }
    ) => {
      if (!watchedMovie) return null;
      const result = await onMarkWatched(group.id, watchedMovie.movie_id, logData);
      if (result) setWatchedMovie(null);
      return result;
    },
    [group.id, watchedMovie, onMarkWatched]
  );

  return (
    <div className="relative">
      {/* Section header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-3 py-3 group/header"
      >
        {/* Collapse chevron */}
        <span
          className="text-zinc-600 text-xs transition-transform duration-200"
          style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0)" }}
        >
          &#x25BC;
        </span>

        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-white uppercase tracking-[0.08em] text-sm leading-none truncate">
              {group.name}
            </h3>
            <span className="text-2xs text-zinc-600 font-mono flex-shrink-0">
              {group.movies.length} film{group.movies.length !== 1 ? "s" : ""}
            </span>
          </div>
          {group.description && (
            <p className="text-2xs text-zinc-500 italic mt-1 truncate">
              {group.description}
            </p>
          )}
        </div>

        {/* Overflow menu button */}
        <div
          className="relative flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="px-2 py-1 text-zinc-700 hover:text-zinc-400
              text-sm font-mono transition-colors"
          >
            ...
          </button>
          {showMenu && (
            <div
              className="absolute right-0 top-full mt-1 z-20 bg-[var(--night)]
                border border-[var(--twilight)] rounded-lg shadow-2xl py-1 min-w-[140px]"
            >
              <button
                onClick={() => {
                  setShowMenu(false);
                  onAddMovie();
                }}
                className="w-full px-3 py-2 text-left text-xs font-mono text-[var(--cream)]
                  hover:bg-[var(--dusk)] transition-colors"
              >
                Add Movie
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  onDeleteGroup(group.id);
                }}
                className="w-full px-3 py-2 text-left text-xs font-mono text-red-400
                  hover:bg-[var(--dusk)] transition-colors"
              >
                Delete Group
              </button>
            </div>
          )}
        </div>
      </button>

      {/* Divider */}
      <div
        className="h-px mb-3"
        style={{ background: "rgba(255,217,61,0.1)" }}
      />

      {/* Movie cards */}
      {!collapsed && (
        <>
          {group.movies.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-zinc-600 font-mono text-xs tracking-widest uppercase mb-3">
                // No movies yet
              </p>
              <button
                onClick={onAddMovie}
                className="px-4 py-1.5 border border-dashed border-zinc-700
                  text-zinc-500 font-mono text-2xs uppercase tracking-wider
                  hover:border-amber-500/40 hover:text-amber-400 transition-colors"
              >
                Add a movie
              </button>
            </div>
          ) : (
            <div
              className="space-y-1.5"
              onDragLeave={() => setDragOver(null)}
            >
              {group.movies.map((gm, i) => (
                <GoblinWatchlistCard
                  key={gm.movie_id}
                  entry={groupMovieToWatchlistEntry(gm)}
                  rank={i + 1}
                  hideRank
                  onEdit={() => {}}
                  onWatched={() => setWatchedMovie(gm)}
                  onRemove={() => onRemoveMovie(group.id, gm.movie_id)}
                  onMoveUp={
                    i > 0
                      ? () => {
                          const reordered = [...group.movies];
                          [reordered[i], reordered[i - 1]] = [reordered[i - 1], reordered[i]];
                          onReorderMovies(group.id, reordered);
                        }
                      : undefined
                  }
                  onMoveDown={
                    i < group.movies.length - 1
                      ? () => {
                          const reordered = [...group.movies];
                          [reordered[i], reordered[i + 1]] = [reordered[i + 1], reordered[i]];
                          onReorderMovies(group.id, reordered);
                        }
                      : undefined
                  }
                  isFirst={i === 0}
                  isLast={i === group.movies.length - 1}
                  onDragStart={() => setDragFrom(i)}
                  onDragOver={() => setDragOver(i)}
                  onDrop={() => handleDrop(i)}
                  isDragging={dragFrom === i}
                  isDragTarget={dragOver === i && dragFrom !== i}
                />
              ))}
            </div>
          )}

          {/* Add movie inline button */}
          {group.movies.length > 0 && (
            <button
              onClick={onAddMovie}
              className="mt-2 w-full py-2 border border-dashed border-zinc-800
                text-zinc-600 font-mono text-2xs uppercase tracking-wider
                hover:border-amber-700/40 hover:text-amber-500/60 transition-colors"
            >
              + Add Movie
            </button>
          )}
        </>
      )}

      {/* Watched modal */}
      <GoblinWatchlistWatchedModal
        entry={watchedMovie ? groupMovieToWatchlistEntry(watchedMovie) : null}
        open={watchedMovie !== null}
        onClose={() => setWatchedMovie(null)}
        onSubmit={handleWatched}
        logTags={logTags}
        onCreateLogTag={onCreateLogTag}
      />
    </div>
  );
}
