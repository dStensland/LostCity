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
  entry, rank, onEdit, onMoveUp, onMoveDown, onMoveToRank,
  isFirst, isLast, readOnly,
  onDragStart, onDragOver, onDrop, isDragTarget, isDragging,
}: Props) {
  const [showInfo, setShowInfo] = useState(false);
  const [editingRank, setEditingRank] = useState(false);
  const [rankInput, setRankInput] = useState("");
  const movie = entry.movie;

  const isHero = rank <= 3;
  const isMid = rank > 3 && rank <= 10;
  const posterSrc = movie.poster_path
    ? `${isHero ? TMDB_POSTER_W342 : TMDB_POSTER_W185}${movie.poster_path}`
    : null;

  const trailerUrl = movie.trailer_url
    ?? `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + " " + (movie.year || "") + " trailer")}`;
  const imdbUrl = movie.imdb_id ? `https://www.imdb.com/title/${movie.imdb_id}` : null;
  const letterboxdUrl = `https://letterboxd.com/search/${encodeURIComponent(movie.title)}/`;

  // Rank accent color
  const rankColor = isHero ? "rgb(245, 158, 11)" : isMid ? "rgb(185, 28, 28)" : "rgb(63, 63, 70)";

  return (
    <div
      draggable={!readOnly}
      onDragStart={(e) => { if (readOnly) return; e.dataTransfer.effectAllowed = "move"; onDragStart?.(); }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; onDragOver?.(e); }}
      onDrop={(e) => { e.preventDefault(); onDrop?.(); }}
      onDragEnd={(e) => e.preventDefault()}
      className={`goblin-log-card group relative flex items-stretch overflow-visible
        transition-all duration-300
        ${isDragging ? "opacity-30 scale-[0.96] rotate-[-1deg]" : ""}
        ${isDragTarget ? "translate-y-1" : ""}
        ${!readOnly ? "cursor-grab active:cursor-grabbing" : ""}
        hover:translate-x-1 hover:-translate-y-[1px]`}
      style={{
        animationDelay: `${Math.min(rank, 15) * 50}ms`,
        // Drop target indicator
        ...(isDragTarget ? { boxShadow: `0 -3px 0 0 rgb(220, 38, 38)` } : {}),
      }}
    >
      {/* Rank — oversized, bleeding out */}
      <div className={`relative flex flex-col items-center justify-center flex-shrink-0
        ${isHero ? "w-14 sm:w-16" : "w-11 sm:w-13"}
        bg-black border-r-2`}
        style={{ borderRightColor: rankColor }}
      >
        {!readOnly && onMoveUp && !isFirst && (
          <button onClick={onMoveUp}
            className="text-zinc-700 hover:text-red-500 text-2xs transition-colors
              sm:opacity-0 sm:group-hover:opacity-100 absolute top-1">
            &#x25B2;
          </button>
        )}
        {!readOnly && editingRank ? (
          <input type="number" min={1} autoFocus value={rankInput}
            onChange={(e) => setRankInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { const v = parseInt(rankInput); if (!isNaN(v) && v >= 1) onMoveToRank?.(v); setEditingRank(false); }
              else if (e.key === "Escape") setEditingRank(false);
            }}
            onBlur={() => setEditingRank(false)}
            className="w-10 text-center bg-transparent border-b-2 border-red-600
              text-red-400 font-mono text-lg font-black
              focus:outline-none
              [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        ) : (
          <button
            onClick={() => { if (readOnly) return; setRankInput(String(rank)); setEditingRank(true); }}
            className={`font-mono font-black leading-none transition-all
              ${isHero
                ? "text-3xl sm:text-4xl text-amber-500/80 group-hover:text-amber-400 group-hover:scale-110"
                : isMid
                  ? "text-xl sm:text-2xl text-red-900/60 group-hover:text-red-700"
                  : "text-base sm:text-lg text-zinc-800 group-hover:text-zinc-600"}
              ${!readOnly ? "cursor-text" : ""}`}
          >
            {rank}
          </button>
        )}
        {!readOnly && onMoveDown && !isLast && (
          <button onClick={onMoveDown}
            className="text-zinc-700 hover:text-red-500 text-2xs transition-colors
              sm:opacity-0 sm:group-hover:opacity-100 absolute bottom-1">
            &#x25BC;
          </button>
        )}
      </div>

      {/* Poster — with vignette and hover effects */}
      <div className={`relative flex-shrink-0 overflow-hidden bg-black
        ${isHero ? "w-[85px] sm:w-[110px]" : "w-[60px] sm:w-[75px]"}`}>
        {posterSrc ? (
          <>
            <SmartImage src={posterSrc} alt={movie.title}
              width={isHero ? 110 : 75} height={isHero ? 165 : 112}
              className="object-cover w-full h-full transition-all duration-500
                group-hover:scale-105 group-hover:brightness-110
                saturate-[0.85] group-hover:saturate-100"
            />
            {/* Film burn vignette */}
            <div className="absolute inset-0 pointer-events-none
              bg-gradient-to-r from-black/30 via-transparent to-black/20
              mix-blend-multiply" />
          </>
        ) : (
          <div className="flex items-center justify-center h-full min-h-[90px]
            text-2xs text-zinc-700 font-mono p-1 text-center bg-zinc-950
            border-r border-zinc-900">
            {movie.title}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 bg-zinc-950/80 border-l border-zinc-900/50">
        <div
          onClick={() => (readOnly ? setShowInfo(!showInfo) : onEdit(entry))}
          className="cursor-pointer p-3 sm:p-3.5 transition-colors
            hover:bg-zinc-900/40"
        >
          {/* Title */}
          <div className="flex items-start justify-between gap-2">
            <h3 className={`font-black text-white leading-none uppercase
              ${isHero ? "text-base sm:text-lg tracking-[0.08em]" : "text-sm tracking-[0.06em]"}`}>
              {movie.title}
            </h3>
            {!readOnly && (
              <span className="text-red-800 text-2xs font-mono font-bold flex-shrink-0
                opacity-0 group-hover:opacity-100 transition-opacity tracking-widest">
                EDIT
              </span>
            )}
          </div>

          {/* Director · year · runtime */}
          <div className="flex items-center gap-1.5 mt-1 text-2xs font-mono">
            {movie.director && <span className="text-zinc-400">{movie.director}</span>}
            {movie.director && movie.year && <span className="text-zinc-800">/</span>}
            {movie.year && <span className="text-zinc-500">{movie.year}</span>}
            {movie.runtime_minutes && (
              <>
                <span className="text-zinc-800">/</span>
                <span className="text-zinc-600">{formatRuntime(movie.runtime_minutes)}</span>
              </>
            )}
            {movie.mpaa_rating && (
              <>
                <span className="text-zinc-800">/</span>
                <span className="text-zinc-600">{movie.mpaa_rating}</span>
              </>
            )}
          </div>

          {/* Scores */}
          {(movie.rt_critics_score != null || movie.rt_audience_score != null || movie.tmdb_vote_average != null) && (
            <div className="flex items-center gap-2 mt-2 text-2xs font-mono">
              {movie.rt_critics_score != null && (
                <span className={`px-1.5 py-0.5 border ${
                  movie.rt_critics_score >= 75
                    ? "bg-red-950/80 text-red-400 border-red-800/60"
                    : movie.rt_critics_score >= 60
                      ? "bg-red-950/40 text-red-500/70 border-red-900/30"
                      : "bg-zinc-950 text-zinc-600 border-zinc-800/50"
                }`}>
                  {movie.rt_critics_score}% RT
                </span>
              )}
              {movie.rt_audience_score != null && (
                <span className={`px-1.5 py-0.5 border ${
                  movie.rt_audience_score >= 75
                    ? "bg-amber-950/60 text-amber-400 border-amber-800/40"
                    : movie.rt_audience_score >= 60
                      ? "bg-amber-950/30 text-amber-500/60 border-amber-900/20"
                      : "bg-zinc-950 text-zinc-600 border-zinc-800/50"
                }`}>
                  {movie.rt_audience_score}% AUD
                </span>
              )}
              {movie.tmdb_vote_average != null && (
                <span className={`font-bold ${
                  movie.tmdb_vote_average >= 7 ? "text-amber-500/80"
                    : movie.tmdb_vote_average >= 5 ? "text-zinc-500" : "text-zinc-700"
                }`}>
                  {movie.tmdb_vote_average.toFixed(1)}
                </span>
              )}
            </div>
          )}

          {/* Meta row: date, watched with, tags */}
          <div className="flex items-center flex-wrap gap-1.5 mt-2">
            <span className="text-2xs text-zinc-600 font-mono tabular-nums">
              {formatWatchedDate(entry.watched_date)}
            </span>
            {entry.watched_with && (
              <>
                <span className="text-zinc-800">/</span>
                <span className="text-2xs text-zinc-500 font-mono">
                  w/ {entry.watched_with}
                </span>
              </>
            )}
            {entry.tags.map((tag) => (
              <span key={tag.id}
                className="px-1.5 py-0.5 text-2xs font-mono font-bold uppercase tracking-wider
                  border rotate-[-0.5deg] inline-block"
                style={{
                  backgroundColor: `${tag.color}15`,
                  borderColor: `${tag.color}40`,
                  color: tag.color || "var(--soft)",
                }}
              >
                {tag.name}
              </span>
            ))}
          </div>

          {/* Note */}
          {entry.note && (
            <p className={`mt-2 text-xs text-zinc-500 italic leading-relaxed
              border-l-2 border-zinc-800 pl-2.5 ${!showInfo ? "line-clamp-1" : ""}`}>
              {entry.note}
            </p>
          )}
        </div>

        {/* Action bar — slides up on hover */}
        <div className="flex items-center gap-3 px-3 sm:px-3.5 pb-2 pt-0
          text-2xs font-mono text-zinc-700
          transition-opacity duration-200
          sm:opacity-0 sm:group-hover:opacity-100">
          <button onClick={() => setShowInfo(!showInfo)}
            className={`transition-colors hover:text-white ${showInfo ? "text-amber-500" : ""}`}>
            [{showInfo ? "−" : "i"}]
          </button>
          <a href={trailerUrl} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="hover:text-red-500 transition-colors">[▶]</a>
          {imdbUrl && (
            <a href={imdbUrl} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="hover:text-amber-500 transition-colors">[imdb]</a>
          )}
          <a href={letterboxdUrl} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="hover:text-emerald-500 transition-colors">[lb]</a>
        </div>

        {/* Synopsis expand */}
        {showInfo && movie.synopsis && (
          <div className="px-3 sm:px-3.5 pb-3 animate-fade-in">
            <p className="text-xs text-zinc-500 leading-relaxed border-t border-zinc-800/40 pt-2">
              {movie.synopsis}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
