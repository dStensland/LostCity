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

// Neon color per rank tier
const RANK_NEON = {
  hero: { color: "#00f0ff", glow: "0 0 10px rgba(0,240,255,0.4), 0 0 30px rgba(0,240,255,0.15)" },
  mid: { color: "#ff00aa", glow: "0 0 8px rgba(255,0,170,0.3), 0 0 20px rgba(255,0,170,0.1)" },
  rest: { color: "#52525b", glow: "none" },
};

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
  const tier = isHero ? RANK_NEON.hero : isMid ? RANK_NEON.mid : RANK_NEON.rest;
  const posterSrc = movie.poster_path
    ? `${isHero ? TMDB_POSTER_W342 : TMDB_POSTER_W185}${movie.poster_path}`
    : null;

  const trailerUrl = movie.trailer_url
    ?? `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + " " + (movie.year || "") + " trailer")}`;
  const imdbUrl = movie.imdb_id ? `https://www.imdb.com/title/${movie.imdb_id}` : null;
  const letterboxdUrl = `https://letterboxd.com/search/${encodeURIComponent(movie.title)}/`;

  return (
    <div
      draggable={!readOnly}
      onDragStart={(e) => { if (readOnly) return; e.dataTransfer.effectAllowed = "move"; onDragStart?.(); }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; onDragOver?.(e); }}
      onDrop={(e) => { e.preventDefault(); onDrop?.(); }}
      onDragEnd={(e) => e.preventDefault()}
      className={`goblin-log-card group relative flex items-stretch overflow-hidden
        transition-all duration-200 ease-out bg-black/80 backdrop-blur-sm
        border border-zinc-800/40
        ${isDragging ? "opacity-30 scale-[0.98]" : ""}
        ${isDragTarget ? "border-t-2 border-t-cyan-400" : ""}
        ${!readOnly ? "cursor-grab active:cursor-grabbing" : ""}
        hover:border-zinc-700/60`}
      style={{
        animationDelay: `${Math.min(rank, 15) * 50}ms`,
        borderLeft: `2px solid ${tier.color}`,
        '--card-neon': tier.color,
      } as React.CSSProperties}
    >
      {/* Rank column */}
      <div className={`relative flex flex-col items-center justify-center flex-shrink-0
        ${isHero ? "w-14 sm:w-16" : "w-11 sm:w-14"}`}>
        {!readOnly && onMoveUp && !isFirst && (
          <button onClick={onMoveUp}
            className="text-zinc-700 hover:text-cyan-400 text-2xs transition-colors
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
            className="w-10 text-center bg-transparent border-b-2 border-cyan-500
              text-cyan-300 font-mono text-lg font-black
              focus:outline-none
              [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        ) : (
          <button
            onClick={() => { if (readOnly) return; setRankInput(String(rank)); setEditingRank(true); }}
            className="font-mono font-black leading-none transition-all"
            style={{
              fontSize: isHero ? "2rem" : isMid ? "1.25rem" : "0.875rem",
              color: tier.color,
              textShadow: tier.glow,
            }}
          >
            {rank}
          </button>
        )}
        {!readOnly && onMoveDown && !isLast && (
          <button onClick={onMoveDown}
            className="text-zinc-700 hover:text-cyan-400 text-2xs transition-colors
              sm:opacity-0 sm:group-hover:opacity-100 absolute bottom-1">
            &#x25BC;
          </button>
        )}
      </div>

      {/* Poster */}
      <div className={`relative flex-shrink-0 overflow-hidden
        ${isHero ? "w-[85px] sm:w-[110px]" : "w-[60px] sm:w-[75px]"}`}>
        {posterSrc ? (
          <>
            <SmartImage src={posterSrc} alt={movie.title}
              width={isHero ? 110 : 75} height={isHero ? 165 : 112}
              className="object-cover w-full h-full transition-all duration-500
                group-hover:scale-105 group-hover:brightness-110"
            />
            {/* Neon edge glow on poster */}
            <div className="absolute inset-y-0 right-0 w-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ boxShadow: `0 0 8px ${tier.color}, 0 0 2px ${tier.color}`, backgroundColor: tier.color }} />
          </>
        ) : (
          <div className="flex items-center justify-center h-full min-h-[90px]
            text-2xs text-zinc-700 font-mono p-1 text-center bg-zinc-950">
            {movie.title}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div
          onClick={() => (readOnly ? setShowInfo(!showInfo) : onEdit(entry))}
          className="cursor-pointer p-3 sm:p-3.5 hover:bg-white/[0.02] transition-colors"
        >
          {/* Title */}
          <div className="flex items-start justify-between gap-2">
            <h3 className={`font-black text-white leading-none uppercase
              ${isHero ? "text-base sm:text-lg tracking-[0.08em]" : "text-sm tracking-[0.06em]"}`}
              style={isHero ? { textShadow: `0 0 20px rgba(0,240,255,0.15)` } : undefined}
            >
              {movie.title}
            </h3>
            {!readOnly && (
              <span className="text-cyan-800 text-2xs font-mono font-bold flex-shrink-0
                opacity-0 group-hover:opacity-100 transition-opacity tracking-widest">
                EDIT
              </span>
            )}
          </div>

          {/* Director / year / runtime */}
          <div className="flex items-center gap-1.5 mt-1 text-2xs font-mono">
            {movie.director && <span className="text-zinc-400">{movie.director}</span>}
            {movie.director && movie.year && <span className="text-zinc-800">/</span>}
            {movie.year && <span className="text-zinc-500">{movie.year}</span>}
            {movie.runtime_minutes && (
              <><span className="text-zinc-800">/</span><span className="text-zinc-600">{formatRuntime(movie.runtime_minutes)}</span></>
            )}
            {movie.mpaa_rating && (
              <><span className="text-zinc-800">/</span><span className="text-zinc-600">{movie.mpaa_rating}</span></>
            )}
          </div>

          {/* Scores */}
          {(movie.rt_critics_score != null || movie.rt_audience_score != null || movie.tmdb_vote_average != null) && (
            <div className="flex items-center gap-2 mt-2 text-2xs font-mono">
              {movie.rt_critics_score != null && (
                <span className={`px-1.5 py-0.5 border ${
                  movie.rt_critics_score >= 75
                    ? "text-cyan-300 border-cyan-800/50 bg-cyan-950/30"
                    : movie.rt_critics_score >= 60
                      ? "text-cyan-500/70 border-cyan-900/30 bg-cyan-950/20"
                      : "text-zinc-600 border-zinc-800/50 bg-zinc-950/30"
                }`}>
                  {movie.rt_critics_score}% RT
                </span>
              )}
              {movie.rt_audience_score != null && (
                <span className={`px-1.5 py-0.5 border ${
                  movie.rt_audience_score >= 75
                    ? "text-fuchsia-300 border-fuchsia-800/40 bg-fuchsia-950/30"
                    : movie.rt_audience_score >= 60
                      ? "text-fuchsia-500/60 border-fuchsia-900/20 bg-fuchsia-950/20"
                      : "text-zinc-600 border-zinc-800/50 bg-zinc-950/30"
                }`}>
                  {movie.rt_audience_score}% AUD
                </span>
              )}
              {movie.tmdb_vote_average != null && (
                <span className={`px-1.5 py-0.5 border ${
                  movie.tmdb_vote_average >= 7
                    ? "text-amber-300 border-amber-800/40 bg-amber-950/20"
                    : movie.tmdb_vote_average >= 5
                      ? "text-amber-600/70 border-amber-900/20 bg-amber-950/10"
                      : "text-zinc-600 border-zinc-800/50 bg-zinc-950/30"
                }`}>
                  {movie.tmdb_vote_average.toFixed(1)} TMDB
                </span>
              )}
            </div>
          )}

          {/* Meta: date, watched with, tags */}
          <div className="flex items-center flex-wrap gap-1.5 mt-2">
            <span className="text-2xs text-zinc-600 font-mono tabular-nums">
              {formatWatchedDate(entry.watched_date)}
            </span>
            {entry.watched_with && (
              <><span className="text-zinc-800">/</span>
              <span className="text-2xs text-zinc-500 font-mono">w/ {entry.watched_with}</span></>
            )}
            {entry.tags.map((tag) => (
              <span key={tag.id}
                className="px-1.5 py-0.5 text-2xs font-mono font-bold uppercase tracking-wider
                  border transition-all duration-200"
                style={{
                  backgroundColor: `${tag.color}10`,
                  borderColor: `${tag.color}30`,
                  color: tag.color || "#a1a1aa",
                  textShadow: `0 0 8px ${tag.color}40`,
                }}
              >
                {tag.name}
              </span>
            ))}
          </div>

          {/* Note */}
          {entry.note && (
            <p className={`mt-2 text-xs text-zinc-500 italic leading-relaxed
              border-l border-cyan-900/30 pl-2.5 ${!showInfo ? "line-clamp-1" : ""}`}>
              {entry.note}
            </p>
          )}
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-3 px-3 sm:px-3.5 pb-2.5 pt-0
          text-2xs font-mono text-zinc-700
          sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
          <button onClick={() => setShowInfo(!showInfo)}
            className={`transition-colors ${showInfo ? "text-cyan-400" : "hover:text-cyan-500"}`}>
            [{showInfo ? "−" : "i"}]
          </button>
          <a href={trailerUrl} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="hover:text-fuchsia-400 transition-colors">[▶]</a>
          {imdbUrl && (
            <a href={imdbUrl} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="hover:text-amber-400 transition-colors">[imdb]</a>
          )}
          <a href={letterboxdUrl} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="hover:text-emerald-400 transition-colors">[lb]</a>
        </div>

        {/* Synopsis */}
        {showInfo && movie.synopsis && (
          <div className="px-3 sm:px-3.5 pb-3 animate-fade-in">
            <p className="text-xs text-zinc-500 leading-relaxed border-t border-cyan-900/20 pt-2">
              {movie.synopsis}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
