"use client";

import { useState } from "react";
import SmartImage from "@/components/SmartImage";
import { formatWatchedDate, formatRuntime, TMDB_POSTER_W185, type LogEntry } from "@/lib/goblin-log-utils";

interface Props {
  entry: LogEntry;
  rank: number;
  onEdit: (entry: LogEntry) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onMoveToRank?: (rank: number) => void;
  isFirst?: boolean;
  isLast?: boolean;
  /** If true, render read-only (for public page) */
  readOnly?: boolean;
  /** Drag-and-drop handlers */
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  isDragTarget?: boolean;
  isDragging?: boolean;
}

export default function GoblinLogEntryCard({
  entry,
  rank,
  onEdit,
  onMoveUp,
  onMoveDown,
  onMoveToRank,
  isFirst,
  isLast,
  readOnly,
  onDragStart,
  onDragOver,
  onDrop,
  isDragTarget,
  isDragging,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editingRank, setEditingRank] = useState(false);
  const [rankInput, setRankInput] = useState("");
  const movie = entry.movie;

  return (
    <div
      draggable={!readOnly}
      onDragStart={(e) => {
        if (readOnly) return;
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver?.(e);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.();
      }}
      onDragEnd={(e) => {
        e.preventDefault();
      }}
      className={`group animate-slide-up flex items-stretch gap-0
        bg-zinc-950 border hover:border-zinc-700
        transition-all duration-200 overflow-hidden
        ${isDragging ? "opacity-40 scale-[0.98]" : ""}
        ${isDragTarget ? "border-[var(--coral)] border-t-2" : "border-zinc-800"}
        ${!readOnly ? "cursor-grab active:cursor-grabbing" : ""}`}
      style={{ animationDelay: `${rank * 40}ms` }}
    >
      {/* Rank number + move buttons */}
      <div className="flex flex-col items-center justify-center w-10 sm:w-12 flex-shrink-0
        border-r border-zinc-800 bg-zinc-950">
        {!readOnly && onMoveUp && !isFirst && (
          <button
            onClick={onMoveUp}
            className="text-zinc-600 hover:text-zinc-300 text-xs py-0.5 transition-colors
              opacity-0 group-hover:opacity-100"
          >
            ▲
          </button>
        )}
        {!readOnly && editingRank ? (
          <input
            type="number"
            min={1}
            autoFocus
            value={rankInput}
            onChange={(e) => setRankInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const val = parseInt(rankInput);
                if (!isNaN(val) && val >= 1) onMoveToRank?.(val);
                setEditingRank(false);
              } else if (e.key === "Escape") {
                setEditingRank(false);
              }
            }}
            onBlur={() => setEditingRank(false)}
            className="w-8 text-center bg-transparent border border-zinc-600 rounded
              text-zinc-300 font-mono text-sm font-bold
              focus:outline-none focus:border-[var(--coral)]
              [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        ) : (
          <button
            onClick={() => {
              if (readOnly) return;
              setRankInput(String(rank));
              setEditingRank(true);
            }}
            className={`text-zinc-500 font-mono text-sm font-bold
              ${!readOnly ? "hover:text-[var(--coral)] hover:underline cursor-text transition-colors" : ""}`}
          >
            {rank}
          </button>
        )}
        {!readOnly && onMoveDown && !isLast && (
          <button
            onClick={onMoveDown}
            className="text-zinc-600 hover:text-zinc-300 text-xs py-0.5 transition-colors
              opacity-0 group-hover:opacity-100"
          >
            ▼
          </button>
        )}
      </div>

      {/* Poster thumbnail */}
      <div className="w-16 sm:w-20 flex-shrink-0 bg-zinc-900">
        {movie.poster_path ? (
          <SmartImage
            src={`${TMDB_POSTER_W185}${movie.poster_path}`}
            alt={movie.title}
            width={80}
            height={120}
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="flex items-center justify-center h-full min-h-[96px]
            text-2xs text-zinc-600 font-mono p-1 text-center">
            {movie.title}
          </div>
        )}
      </div>

      {/* Content */}
      <button
        onClick={() => (readOnly ? setExpanded(!expanded) : onEdit(entry))}
        className="flex-1 min-w-0 p-2.5 sm:p-3 text-left hover:bg-zinc-900/50 transition-colors"
      >
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-white text-sm sm:text-base leading-tight line-clamp-1 uppercase tracking-wide">
            {movie.title}
          </h3>
          {!readOnly && (
            <span className="text-zinc-600 text-2xs font-mono flex-shrink-0
              opacity-0 group-hover:opacity-100 transition-opacity">
              EDIT
            </span>
          )}
        </div>

        {/* Director + year + runtime */}
        <div className="flex items-center gap-1.5 mt-0.5 text-2xs text-zinc-500 font-mono">
          {movie.director && (
            <span className="text-zinc-400">{movie.director}</span>
          )}
          {movie.director && movie.year && <span>·</span>}
          {movie.year && <span>{movie.year}</span>}
          {movie.runtime_minutes && (
            <>
              <span>·</span>
              <span>{formatRuntime(movie.runtime_minutes)}</span>
            </>
          )}
          {movie.mpaa_rating && (
            <>
              <span>·</span>
              <span>{movie.mpaa_rating}</span>
            </>
          )}
        </div>

        {/* Scores row */}
        <div className="flex items-center gap-2 mt-1.5 text-2xs font-mono">
          {movie.rt_critics_score != null && (
            <span
              className={`px-1.5 py-0.5 ${
                movie.rt_critics_score >= 75
                  ? "bg-red-900/60 text-red-400 border border-red-800/50"
                  : movie.rt_critics_score >= 60
                    ? "bg-red-950/40 text-red-500/80 border border-red-900/30"
                    : "bg-zinc-900 text-zinc-500 border border-zinc-800"
              }`}
            >
              RT {movie.rt_critics_score}%
            </span>
          )}
          {movie.rt_audience_score != null && (
            <span
              className={`px-1.5 py-0.5 ${
                movie.rt_audience_score >= 75
                  ? "bg-amber-900/40 text-amber-400 border border-amber-800/40"
                  : movie.rt_audience_score >= 60
                    ? "bg-amber-950/30 text-amber-500/70 border border-amber-900/30"
                    : "bg-zinc-900 text-zinc-500 border border-zinc-800"
              }`}
            >
              AUD {movie.rt_audience_score}%
            </span>
          )}
          {movie.tmdb_vote_average != null && (
            <span
              className={`${
                movie.tmdb_vote_average >= 7
                  ? "text-amber-500"
                  : movie.tmdb_vote_average >= 5
                    ? "text-zinc-400"
                    : "text-zinc-600"
              }`}
            >
              TMDB {movie.tmdb_vote_average.toFixed(1)}
            </span>
          )}
        </div>

        {/* Tags + date + watched with */}
        <div className="flex items-center flex-wrap gap-1.5 mt-2">
          <span className="text-2xs text-zinc-500 font-mono">
            {formatWatchedDate(entry.watched_date)}
          </span>
          {entry.watched_with && (
            <>
              <span className="text-zinc-700">·</span>
              <span className="text-2xs text-zinc-500 font-mono">
                w/ {entry.watched_with}
              </span>
            </>
          )}
          {entry.tags.map((tag) => (
            <span
              key={tag.id}
              className="px-1.5 py-0.5 rounded-full text-2xs font-mono font-medium"
              style={{
                backgroundColor: `${tag.color}20`,
                color: tag.color || "var(--soft)",
              }}
            >
              {tag.name}
            </span>
          ))}
        </div>

        {/* Note */}
        {entry.note && (
          <p className={`mt-1.5 text-xs text-zinc-400 italic leading-relaxed ${
            !expanded && readOnly ? "line-clamp-1" : ""
          }`}>
            &ldquo;{entry.note}&rdquo;
          </p>
        )}

        {/* Genres */}
        {movie.genres && movie.genres.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5">
            {movie.genres.slice(0, 3).map((genre) => (
              <span
                key={genre}
                className="text-2xs text-zinc-600 font-mono uppercase tracking-wider"
              >
                {genre}
              </span>
            ))}
          </div>
        )}
      </button>
    </div>
  );
}
