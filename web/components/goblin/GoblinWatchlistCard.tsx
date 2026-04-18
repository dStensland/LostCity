"use client";

import { useState } from "react";
import SmartImage from "@/components/SmartImage";
import { formatRuntime, TMDB_POSTER_W185, TMDB_POSTER_W342 } from "@/lib/goblin-log-utils";
import { type WatchlistEntry } from "@/lib/goblin-watchlist-utils";

interface Props {
  entry: WatchlistEntry;
  rank: number;
  hideRank?: boolean;
  onEdit: (entry: WatchlistEntry) => void;
  onWatched: (entry: WatchlistEntry) => void;
  onRemove: (entryId: number) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onMoveToRank?: (rank: number) => void;
  isFirst?: boolean;
  isLast?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  isDragTarget?: boolean;
  isDragging?: boolean;
}

// Neon color per rank tier — amber/gold accent
const RANK_NEON = {
  hero: { color: "#ffd93d", glow: "0 0 10px rgba(255,217,61,0.4), 0 0 30px rgba(255,217,61,0.15)" },
  mid: { color: "#fb923c", glow: "0 0 8px rgba(251,146,60,0.3), 0 0 20px rgba(251,146,60,0.1)" },
  rest: { color: "#52525b", glow: "none" },
};

export default function GoblinWatchlistCard({
  entry, rank, hideRank, onEdit, onWatched, onRemove,
  onMoveUp, onMoveDown, onMoveToRank,
  isFirst, isLast,
  onDragStart, onDragOver, onDrop, isDragTarget, isDragging,
}: Props) {
  const [showInfo, setShowInfo] = useState(false);
  const [editingRank, setEditingRank] = useState(false);
  const [rankInput, setRankInput] = useState("");
  const movie = entry.movie;

  const isHero = !hideRank && rank <= 3;
  const isMid = !hideRank && rank > 3 && rank <= 10;
  const tier = isHero ? RANK_NEON.hero : isMid ? RANK_NEON.mid : RANK_NEON.rest;
  const posterSrc = movie.poster_path
    ? `${isHero ? TMDB_POSTER_W342 : TMDB_POSTER_W185}${movie.poster_path}`
    : null;

  const trailerUrl = movie.trailer_url
    ?? `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + " " + (movie.year || "") + " trailer")}`;
  const imdbUrl = movie.imdb_id ? `https://www.imdb.com/title/${movie.imdb_id}` : null;

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart?.(); }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; onDragOver?.(e); }}
      onDrop={(e) => { e.preventDefault(); onDrop?.(); }}
      onDragEnd={(e) => e.preventDefault()}
      className={`goblin-watchlist-card group relative flex items-stretch overflow-hidden
        transition-[border-color,opacity,transform] duration-200 ease-out
        bg-[rgba(5,5,8,0.92)] border border-zinc-800/40
        cursor-grab active:cursor-grabbing
        ${isDragging ? "opacity-30 scale-[0.98]" : ""}
        ${isDragTarget ? "border-t-2 border-t-amber-400" : ""}
        hover:border-zinc-700/60`}
      style={{
        animationDelay: `${Math.min(rank, 8) * 40}ms`,
        borderLeft: `2px solid ${tier.color}`,
        '--card-neon': tier.color,
      } as React.CSSProperties}
    >
      {/* Rank column */}
      {!hideRank && (
        <div className={`relative flex flex-col items-center justify-center flex-shrink-0
          ${isHero ? "w-14 sm:w-16" : "w-11 sm:w-14"}`}>
          {onMoveUp && !isFirst && (
            <button onClick={onMoveUp}
              className="text-zinc-700 hover:text-amber-400 text-xs sm:text-2xs transition-colors
                sm:opacity-0 sm:group-hover:opacity-100 absolute top-0 w-full py-1">
              &#x25B2;
            </button>
          )}
          {editingRank ? (
            <input type="number" min={1} autoFocus value={rankInput}
              onChange={(e) => setRankInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { const v = parseInt(rankInput); if (!isNaN(v) && v >= 1) onMoveToRank?.(v); setEditingRank(false); }
                else if (e.key === "Escape") setEditingRank(false);
              }}
              onBlur={() => setEditingRank(false)}
              className="w-10 text-center bg-transparent border-b-2 border-amber-500
                text-amber-300 font-mono text-lg font-black
                focus:outline-none
                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          ) : (
            <button
              onClick={() => { setRankInput(String(rank)); setEditingRank(true); }}
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
          {onMoveDown && !isLast && (
            <button onClick={onMoveDown}
              className="text-zinc-700 hover:text-amber-400 text-xs sm:text-2xs transition-colors
                sm:opacity-0 sm:group-hover:opacity-100 absolute bottom-0 w-full py-1">
              &#x25BC;
            </button>
          )}
        </div>
      )}

      {/* Poster */}
      <div className={`relative flex-shrink-0 overflow-hidden
        ${isHero ? "w-[85px] sm:w-[110px]" : "w-[60px] sm:w-[75px]"}`}>
        {posterSrc ? (
          <>
            <SmartImage src={posterSrc} alt={movie.title}
              width={isHero ? 110 : 75} height={isHero ? 165 : 112}
              loading="lazy"
              className="object-cover w-full h-full"
            />
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
          onClick={() => onEdit(entry)}
          className="cursor-pointer p-3 sm:p-3.5 hover:bg-white/[0.02] transition-colors"
        >
          {/* Title */}
          <div className="flex items-start justify-between gap-2">
            <h3 className={`font-black text-white leading-none uppercase
              ${isHero ? "text-base sm:text-lg tracking-[0.08em]" : "text-sm tracking-[0.06em]"}`}
              style={isHero ? { textShadow: `0 0 20px rgba(255,217,61,0.15)` } : undefined}
            >
              {movie.title}
            </h3>
            <span className="text-amber-800 text-2xs font-mono font-bold flex-shrink-0
              opacity-0 group-hover:opacity-100 transition-opacity tracking-widest">
              EDIT
            </span>
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

          {/* Scores — RT critics uses amber accent */}
          {(movie.rt_critics_score != null || movie.rt_audience_score != null || movie.tmdb_vote_average != null) && (
            <div className="flex items-center gap-2 mt-2 text-2xs font-mono">
              {movie.rt_critics_score != null && (
                <span className={`px-1.5 py-0.5 border ${
                  movie.rt_critics_score >= 75
                    ? "text-amber-300 border-amber-800/50 bg-amber-950/30"
                    : movie.rt_critics_score >= 60
                      ? "text-amber-500/70 border-amber-900/30 bg-amber-950/20"
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

          {/* Tags */}
          {entry.tags.length > 0 && (
            <div className="flex items-center flex-wrap gap-1.5 mt-2">
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
          )}

          {/* Note */}
          {entry.note && (
            <p className={`mt-2 text-xs text-zinc-500 italic leading-relaxed
              border-l border-amber-900/30 pl-2.5 ${!showInfo ? "line-clamp-1" : ""}`}>
              {entry.note}
            </p>
          )}
        </div>

        {/* Action bar — always visible on mobile for touch access */}
        <div className="flex items-center gap-4 sm:gap-3 px-3 sm:px-3.5 pb-2.5 pt-0
          text-xs sm:text-2xs font-mono text-zinc-600 sm:text-zinc-700
          sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
          <button onClick={() => onWatched(entry)}
            className="py-1 text-emerald-600 hover:text-emerald-400 font-bold transition-colors">
            [WATCHED]
          </button>
          <button onClick={() => onRemove(entry.id)}
            className="py-1 text-zinc-500 hover:text-amber-400 font-bold transition-colors"
            title="Mark as seen (removes without logging)">
            [SEEN]
          </button>
          <button onClick={() => setShowInfo(!showInfo)}
            className={`py-1 transition-colors ${showInfo ? "text-amber-400" : "hover:text-amber-500"}`}>
            [{showInfo ? "−" : "i"}]
          </button>
          <a href={trailerUrl} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="py-1 hover:text-fuchsia-400 transition-colors">[▶]</a>
          {imdbUrl && (
            <a href={imdbUrl} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="py-1 hover:text-amber-400 transition-colors">[imdb]</a>
          )}
          <button onClick={() => onRemove(entry.id)}
            className="py-1 ml-auto text-zinc-800 hover:text-red-500 transition-colors">
            [×]
          </button>
        </div>

        {/* Synopsis */}
        {showInfo && movie.synopsis && (
          <div className="px-3 sm:px-3.5 pb-3 animate-fade-in">
            <p className="text-xs text-zinc-500 leading-relaxed border-t border-amber-900/20 pt-2">
              {movie.synopsis}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
