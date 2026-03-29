"use client";

import { useState } from "react";
import SmartImage from "@/components/SmartImage";
import { formatWatchedDate, formatRuntime, TMDB_POSTER_W185, TMDB_POSTER_W342, type LogEntry } from "@/lib/goblin-log-utils";

interface Props {
  entry: LogEntry;
  rank: number;
  onEdit: (entry: LogEntry) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onMoveToRank?: (rank: number) => void;
  isFirst?: boolean;
  isLast?: boolean;
  readOnly?: boolean;
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
  const [showInfo, setShowInfo] = useState(false);
  const [editingRank, setEditingRank] = useState(false);
  const [rankInput, setRankInput] = useState("");
  const movie = entry.movie;

  const trailerUrl = movie.trailer_url
    ?? `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + " " + (movie.year || "") + " trailer")}`;
  const imdbUrl = movie.imdb_id ? `https://www.imdb.com/title/${movie.imdb_id}` : null;
  const letterboxdUrl = `https://letterboxd.com/search/${encodeURIComponent(movie.title)}/`;

  // Top 3 get hero treatment
  const isHero = rank <= 3;
  const posterSrc = movie.poster_path
    ? `${isHero ? TMDB_POSTER_W342 : TMDB_POSTER_W185}${movie.poster_path}`
    : null;

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
      onDragEnd={(e) => e.preventDefault()}
      className={`group animate-slide-up flex items-stretch
        transition-all duration-200 overflow-hidden
        ${isHero ? "border-l-2 border-l-amber-500/60" : ""}
        ${isDragging ? "opacity-40 scale-[0.98]" : ""}
        ${isDragTarget ? "border-t-2 border-t-[var(--coral)]" : ""}
        ${!readOnly ? "cursor-grab active:cursor-grabbing" : ""}
        bg-zinc-950 border border-zinc-800/60 hover:border-zinc-700`}
      style={{ animationDelay: `${Math.min(rank, 10) * 40}ms` }}
    >
      {/* Rank column */}
      <div className={`flex flex-col items-center justify-center flex-shrink-0
        border-r border-zinc-800/60
        ${isHero ? "w-12 sm:w-14" : "w-10 sm:w-12"}`}>
        {!readOnly && onMoveUp && !isFirst && (
          <button
            onClick={onMoveUp}
            className="text-zinc-600 hover:text-zinc-300 text-2xs py-0.5 transition-colors
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
              focus:outline-none focus:border-amber-500
              [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        ) : (
          <button
            onClick={() => {
              if (readOnly) return;
              setRankInput(String(rank));
              setEditingRank(true);
            }}
            className={`font-mono font-black transition-colors
              ${isHero
                ? "text-lg text-amber-500/90 hover:text-amber-400"
                : "text-sm text-zinc-500 hover:text-amber-500/70"}
              ${!readOnly ? "cursor-text" : ""}`}
          >
            {rank}
          </button>
        )}
        {!readOnly && onMoveDown && !isLast && (
          <button
            onClick={onMoveDown}
            className="text-zinc-600 hover:text-zinc-300 text-2xs py-0.5 transition-colors
              opacity-0 group-hover:opacity-100"
          >
            ▼
          </button>
        )}
      </div>

      {/* Poster */}
      <div className={`flex-shrink-0 bg-zinc-900
        ${isHero ? "w-20 sm:w-28" : "w-16 sm:w-20"}`}>
        {posterSrc ? (
          <SmartImage
            src={posterSrc}
            alt={movie.title}
            width={isHero ? 112 : 80}
            height={isHero ? 168 : 120}
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
      <div className="flex-1 min-w-0 p-2.5 sm:p-3">
        {/* Title row — clickable for edit */}
        <div
          onClick={() => (readOnly ? setExpanded(!expanded) : onEdit(entry))}
          className="cursor-pointer hover:bg-zinc-900/30 -m-2.5 sm:-m-3 p-2.5 sm:p-3 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className={`font-bold text-white leading-tight line-clamp-1 uppercase tracking-wide
              ${isHero ? "text-base sm:text-lg" : "text-sm"}`}>
              {movie.title}
            </h3>
            {!readOnly && (
              <span className="text-zinc-600 text-2xs font-mono flex-shrink-0
                opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                EDIT
              </span>
            )}
          </div>

          {/* Director · year · runtime · rating */}
          <div className="flex items-center gap-1.5 mt-0.5 text-2xs text-zinc-500 font-mono">
            {movie.director && <span className="text-zinc-400">{movie.director}</span>}
            {movie.director && movie.year && <span className="text-zinc-700">·</span>}
            {movie.year && <span>{movie.year}</span>}
            {movie.runtime_minutes && (
              <>
                <span className="text-zinc-700">·</span>
                <span>{formatRuntime(movie.runtime_minutes)}</span>
              </>
            )}
            {movie.mpaa_rating && (
              <>
                <span className="text-zinc-700">·</span>
                <span>{movie.mpaa_rating}</span>
              </>
            )}
          </div>

          {/* Scores */}
          {(movie.rt_critics_score != null || movie.rt_audience_score != null || movie.tmdb_vote_average != null) && (
            <div className="flex items-center gap-2 mt-1.5 text-2xs font-mono">
              {movie.rt_critics_score != null && (
                <span className={`px-1.5 py-0.5 ${
                  movie.rt_critics_score >= 75
                    ? "bg-red-900/60 text-red-400 border border-red-800/50"
                    : movie.rt_critics_score >= 60
                      ? "bg-red-950/40 text-red-500/80 border border-red-900/30"
                      : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                }`}>
                  RT {movie.rt_critics_score}%
                </span>
              )}
              {movie.rt_audience_score != null && (
                <span className={`px-1.5 py-0.5 ${
                  movie.rt_audience_score >= 75
                    ? "bg-amber-900/40 text-amber-400 border border-amber-800/40"
                    : movie.rt_audience_score >= 60
                      ? "bg-amber-950/30 text-amber-500/70 border border-amber-900/30"
                      : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                }`}>
                  AUD {movie.rt_audience_score}%
                </span>
              )}
              {movie.tmdb_vote_average != null && (
                <span className={`${
                  movie.tmdb_vote_average >= 7
                    ? "text-amber-500"
                    : movie.tmdb_vote_average >= 5
                      ? "text-zinc-400"
                      : "text-zinc-600"
                }`}>
                  TMDB {movie.tmdb_vote_average.toFixed(1)}
                </span>
              )}
            </div>
          )}

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
              !showInfo && !expanded && readOnly ? "line-clamp-1" : ""
            }`}>
              &ldquo;{entry.note}&rdquo;
            </p>
          )}

          {/* Genres */}
          {movie.genres && movie.genres.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1.5">
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
        </div>

        {/* Action links — always visible */}
        <div className="flex items-center gap-3 mt-2 pt-1.5 border-t border-zinc-800/40">
          <button
            onClick={() => setShowInfo(!showInfo)}
            className={`text-2xs font-mono font-bold uppercase tracking-wider transition-colors ${
              showInfo ? "text-amber-400" : "text-zinc-600 hover:text-zinc-400"
            }`}
          >
            {showInfo ? "HIDE" : "INFO"}
          </button>
          <a
            href={trailerUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-2xs font-mono font-bold uppercase tracking-wider
              text-zinc-600 hover:text-red-400 transition-colors"
          >
            TRAILER
          </a>
          {imdbUrl && (
            <a
              href={imdbUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-2xs font-mono font-bold uppercase tracking-wider
                text-zinc-600 hover:text-amber-400 transition-colors"
            >
              IMDB
            </a>
          )}
          <a
            href={letterboxdUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-2xs font-mono font-bold uppercase tracking-wider
              text-zinc-600 hover:text-emerald-400 transition-colors"
          >
            LETTERBOXD
          </a>
        </div>

        {/* Expandable synopsis */}
        {showInfo && movie.synopsis && (
          <div className="mt-2 animate-fade-in">
            <p className="text-xs text-zinc-400 leading-relaxed">
              {movie.synopsis}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
