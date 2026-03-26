"use client";

import { useState } from "react";
import SmartImage from "@/components/SmartImage";

export interface StreamingInfo {
  stream?: string[];
  rent?: string[];
  buy?: string[];
  ads?: string[];
  free?: string[];
  theaters?: boolean;
}

export interface GoblinMovie {
  id: number;
  tmdb_id: number | null;
  title: string;
  release_date: string | null;
  poster_path: string | null;
  rt_critics_score: number | null;
  rt_audience_score: number | null;
  watched: boolean;
  proposed: boolean;
  streaming_info: StreamingInfo | string[] | null;
  year: number;
  synopsis: string | null;
  genres: string[] | null;
  tmdb_vote_average: number | null;
  tmdb_vote_count: number | null;
  tmdb_popularity: number | null;
  runtime_minutes: number | null;
  keywords: string[] | null;
  director: string | null;
  mpaa_rating: string | null;
  trailer_url: string | null;
  backdrop_path: string | null;
  imdb_id: string | null;
}

/** Normalize streaming_info — handles both old flat array and new categorized format */
export function normalizeStreaming(raw: StreamingInfo | string[] | null): StreamingInfo {
  if (!raw) return {};
  if (Array.isArray(raw)) {
    // Legacy flat array: ["theaters", "Netflix", "Shudder"]
    const theaters = raw.includes("theaters");
    const providers = raw.filter((s) => s !== "theaters");
    return {
      ...(theaters ? { theaters: true } : {}),
      ...(providers.length > 0 ? { stream: providers } : {}),
    };
  }
  return raw;
}

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

interface Props {
  movie: GoblinMovie;
  isBookmarked: boolean;
  isWatched: boolean;
  onToggleBookmark: (id: number) => void;
  onToggleWatched: (id: number) => void;
}

function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? `${m}m` : ""}` : `${m}m`;
}

function formatVoteCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return `${count}`;
}

type FlipMode = null | "info" | "watch";

export default function GoblinMovieCard({ movie, isBookmarked, isWatched, onToggleBookmark, onToggleWatched }: Props) {
  const [flipMode, setFlipMode] = useState<FlipMode>(null);
  const streaming = normalizeStreaming(movie.streaming_info);

  const posterUrl = movie.poster_path
    ? `${TMDB_IMAGE_BASE}${movie.poster_path}`
    : null;

  const releaseDate = movie.release_date
    ? new Date(movie.release_date + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "TBD";

  const isReleased = movie.release_date
    ? new Date(movie.release_date) <= new Date()
    : false;

  const hasWatchOptions = streaming.theaters || (streaming.stream?.length ?? 0) > 0 ||
    (streaming.rent?.length ?? 0) > 0 || (streaming.buy?.length ?? 0) > 0 ||
    (streaming.ads?.length ?? 0) > 0 || (streaming.free?.length ?? 0) > 0;

  const trailerUrl = movie.trailer_url
    ?? `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + " " + movie.year + " trailer")}`;

  return (
    <div
      className={`group bg-zinc-950 overflow-hidden border-2 transition-all font-mono relative flex flex-col ${
        isBookmarked && !isWatched
          ? "border-red-700 shadow-[0_0_20px_rgba(185,28,28,0.25)] hover:shadow-[0_0_30px_rgba(185,28,28,0.4)]"
          : isWatched
            ? "border-zinc-800"
            : "border-zinc-800 hover:border-red-900/60 hover:shadow-[0_0_15px_rgba(120,10,10,0.15)]"
      }`}
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] bg-zinc-900 overflow-hidden">
        {posterUrl ? (
          <SmartImage
            src={posterUrl}
            alt={movie.title}
            fill
            className={`object-cover transition-transform duration-500 group-hover:scale-105 ${isWatched ? "grayscale brightness-50" : ""}`}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-700 text-xs tracking-widest uppercase">
            NO POSTER
          </div>
        )}
        {/* Dark vignette overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />
        {isWatched && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-emerald-500 font-black text-sm tracking-[0.3em] uppercase rotate-[-12deg] border-2 border-emerald-500/50 px-3 py-1">
              WATCHED
            </span>
          </div>
        )}
        {isBookmarked && !isWatched && (
          <div className="absolute top-0 left-0 bg-red-700 px-2 py-0.5 shadow-[4px_4px_0_rgba(0,0,0,0.5)]">
            <span className="text-white font-bold text-2xs tracking-widest uppercase">
              SAVED
            </span>
          </div>
        )}
        {/* Flip buttons — top right corner */}
        <div className="absolute top-1.5 right-1.5 flex flex-col gap-1 z-10">
          {(movie.director || (movie.keywords && movie.keywords.length > 0) || movie.synopsis || movie.imdb_id) && (
            <button
              onClick={() => setFlipMode(flipMode === "info" ? null : "info")}
              className="w-6 h-6 bg-black/70 hover:bg-red-900/80 border border-zinc-600/50 hover:border-red-600/50 text-zinc-400 hover:text-white text-xs font-bold flex items-center justify-center transition-all"
            >
              i
            </button>
          )}
          {hasWatchOptions && (
            <button
              onClick={() => setFlipMode(flipMode === "watch" ? null : "watch")}
              className="w-6 h-6 bg-black/70 hover:bg-emerald-900/80 border border-zinc-600/50 hover:border-emerald-600/50 text-zinc-400 hover:text-emerald-300 text-xs font-bold flex items-center justify-center transition-all"
            >
              &#9654;
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-2.5 space-y-1.5 border-t border-zinc-800/50 flex flex-col flex-1">
        <div>
          <h3 className="font-bold text-white text-xs leading-tight line-clamp-2 uppercase tracking-wide">
            {movie.title}
          </h3>
          <p className="text-zinc-600 text-2xs mt-0.5 tracking-widest">{releaseDate}</p>
        </div>

        {/* RT Scores */}
        <div className="flex gap-2 text-2xs">
          <span className={`px-1.5 py-0.5 ${
            movie.rt_critics_score != null
              ? movie.rt_critics_score >= 75
                ? "bg-red-900/60 text-red-400 border border-red-800/50"
                : movie.rt_critics_score >= 60
                  ? "bg-red-950/40 text-red-500/80 border border-red-900/30"
                  : "bg-zinc-900 text-zinc-500 border border-zinc-800"
              : "text-zinc-700"
          }`}>
            RT {movie.rt_critics_score != null ? `${movie.rt_critics_score}%` : "--"}
          </span>
          <span className={`px-1.5 py-0.5 ${
            movie.rt_audience_score != null
              ? movie.rt_audience_score >= 75
                ? "bg-amber-900/40 text-amber-400 border border-amber-800/40"
                : movie.rt_audience_score >= 60
                  ? "bg-amber-950/30 text-amber-500/70 border border-amber-900/30"
                  : "bg-zinc-900 text-zinc-500 border border-zinc-800"
              : "text-zinc-700"
          }`}>
            AUD {movie.rt_audience_score != null ? `${movie.rt_audience_score}%` : "--"}
          </span>
        </div>

        {/* TMDB Score + Runtime + MPAA */}
        <div className="flex items-center gap-2 text-2xs text-zinc-500">
          {movie.tmdb_vote_average != null && (
            <span className={`${movie.tmdb_vote_average >= 7 ? "text-amber-500" : movie.tmdb_vote_average >= 5 ? "text-zinc-400" : "text-zinc-600"}`}>
              TMDB {movie.tmdb_vote_average.toFixed(1)}
              {movie.tmdb_vote_count != null && (
                <span className="text-zinc-600 ml-0.5">({formatVoteCount(movie.tmdb_vote_count)})</span>
              )}
            </span>
          )}
          {movie.mpaa_rating && (
            <span className="text-zinc-400">{movie.mpaa_rating}</span>
          )}
          {movie.mpaa_rating && movie.runtime_minutes != null && (
            <span className="text-zinc-700">|</span>
          )}
          {movie.runtime_minutes != null && (
            <span className="text-zinc-500">{formatRuntime(movie.runtime_minutes)}</span>
          )}
        </div>

        {/* Availability — compact summary */}
        <div className="flex flex-wrap gap-1">
          {streaming.theaters && (
            <span className="text-2xs px-1.5 py-0.5 bg-red-900/80 text-red-300 font-bold tracking-wider uppercase border-l-2 border-red-500">
              THEATERS
            </span>
          )}
          {(streaming.stream?.length ?? 0) > 0 && (
            <span className="text-2xs px-1.5 py-0.5 bg-emerald-950/60 text-emerald-400 tracking-wider uppercase border-l-2 border-emerald-600">
              STREAMING
            </span>
          )}
          {(streaming.ads?.length ?? 0) > 0 && !(streaming.stream?.length) && (
            <span className="text-2xs px-1.5 py-0.5 bg-cyan-950/60 text-cyan-400 tracking-wider uppercase border-l-2 border-cyan-600">
              FREE W/ ADS
            </span>
          )}
          {(streaming.rent?.length ?? 0) > 0 && !(streaming.stream?.length) && !(streaming.ads?.length) && (
            <span className="text-2xs px-1.5 py-0.5 bg-amber-950/60 text-amber-400 tracking-wider uppercase border-l-2 border-amber-600">
              RENT/BUY
            </span>
          )}
          {!isReleased && !hasWatchOptions && (
            <span className="text-2xs px-1.5 py-0.5 bg-zinc-900 text-zinc-600 tracking-wider uppercase border-l-2 border-zinc-700">
              UNRELEASED
            </span>
          )}
        </div>

        {/* Trailer + Actions — pinned to bottom */}
        <div className="mt-auto pt-1.5 border-t border-zinc-800/50 space-y-1">
          <a
            href={trailerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center bg-red-900/40 hover:bg-red-800/60 text-red-400 hover:text-red-300 text-2xs font-bold tracking-widest uppercase py-1.5 transition-all hover:shadow-[0_0_10px_rgba(220,38,38,0.3)] border border-red-800/40"
          >
            &#9654; TRAILER
          </a>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onToggleBookmark(movie.id)}
            className={`flex-1 text-2xs py-2 font-bold tracking-wider uppercase transition-all ${
              isBookmarked
                ? "bg-red-800 text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.3)] hover:bg-red-700"
                : "bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-red-400 hover:border-red-900/50 hover:bg-red-950/20 hover:shadow-[0_0_8px_rgba(120,10,10,0.2)]"
            }`}
          >
            {isBookmarked ? "\u2666 SAVED" : "SAVE"}
          </button>
          <button
            onClick={() => onToggleWatched(movie.id)}
            className={`flex-1 text-2xs py-2 font-bold tracking-wider uppercase transition-all ${
              isWatched
                ? "bg-emerald-800 text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.3)] hover:bg-emerald-700"
                : "bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-emerald-400 hover:border-emerald-900/50 hover:bg-emerald-950/20 hover:shadow-[0_0_8px_rgba(10,80,40,0.2)]"
            }`}
          >
            {isWatched ? "\u2620 WATCHED" : "WATCHED?"}
          </button>
        </div>
      </div>

      {/* Flipped card back — info or watch mode */}
      {flipMode && (
        <div
          className="absolute inset-0 z-20 p-3 flex flex-col cursor-pointer overflow-y-auto"
          onClick={() => setFlipMode(null)}
        >
          {/* Backdrop background (info flip only) */}
          {flipMode === "info" && movie.backdrop_path ? (
            <div className="absolute inset-0 -z-10">
              <SmartImage
                src={`https://image.tmdb.org/t/p/w780${movie.backdrop_path}`}
                alt=""
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-black/88" />
            </div>
          ) : (
            <div className="absolute inset-0 -z-10 bg-black/95" />
          )}
          {flipMode === "info" && (
            <>
              {/* Director */}
              {movie.director && (
                <h4 className="text-zinc-400 text-2xs font-bold tracking-[0.2em] uppercase mb-3">
                  DIRECTED BY <span className="text-white">{movie.director.toUpperCase()}</span>
                </h4>
              )}

              {/* Keywords */}
              {movie.keywords && movie.keywords.length > 0 && (
                <>
                  <h4 className="text-red-500 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
                    KEYWORDS
                  </h4>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {movie.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="text-2xs px-1.5 py-0.5 bg-red-950/40 text-red-400/80 border border-red-900/30 tracking-wider uppercase"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </>
              )}

              {/* Genres */}
              {movie.genres && movie.genres.length > 0 && (
                <>
                  <h4 className="text-zinc-500 text-2xs font-bold tracking-[0.2em] uppercase mb-1.5">
                    GENRES
                  </h4>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {movie.genres.map((g) => (
                      <span
                        key={g}
                        className="text-2xs px-1.5 py-0.5 bg-zinc-900 text-zinc-400 border border-zinc-800 tracking-wider uppercase"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                </>
              )}

              {/* Synopsis */}
              {movie.synopsis && (
                <>
                  <h4 className="text-zinc-500 text-2xs font-bold tracking-[0.2em] uppercase mb-1.5">
                    SYNOPSIS
                  </h4>
                  <p className="text-zinc-400 text-xs leading-relaxed flex-1">
                    {movie.synopsis}
                  </p>
                </>
              )}

              {/* External links */}
              {(movie.imdb_id || movie.tmdb_id) && (
                <div className="flex gap-2 mt-3 pt-2 border-t border-zinc-800/50">
                  {movie.imdb_id && (
                    <a
                      href={`https://www.imdb.com/title/${movie.imdb_id}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-2xs text-amber-500/70 hover:text-amber-400 tracking-wider uppercase transition-colors"
                    >
                      IMDB &rarr;
                    </a>
                  )}
                  {movie.tmdb_id && (
                    <a
                      href={`https://letterboxd.com/tmdb/${movie.tmdb_id}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-2xs text-emerald-500/70 hover:text-emerald-400 tracking-wider uppercase transition-colors"
                    >
                      LETTERBOXD &rarr;
                    </a>
                  )}
                </div>
              )}
            </>
          )}

          {flipMode === "watch" && (
            <>
              <h4 className="text-emerald-500 text-2xs font-bold tracking-[0.2em] uppercase mb-3">
                WHERE TO WATCH
              </h4>

              {streaming.theaters && (
                <div className="mb-3">
                  <h5 className="text-red-400 text-2xs font-bold tracking-[0.15em] uppercase mb-1">IN THEATERS</h5>
                  <p className="text-zinc-400 text-xs">Now showing in theaters</p>
                </div>
              )}

              {streaming.stream && streaming.stream.length > 0 && (
                <div className="mb-3">
                  <h5 className="text-emerald-400 text-2xs font-bold tracking-[0.15em] uppercase mb-1">STREAM</h5>
                  <div className="flex flex-wrap gap-1">
                    {streaming.stream.map((p) => (
                      <span key={p} className="text-2xs px-1.5 py-0.5 bg-emerald-950/50 text-emerald-300 border border-emerald-800/40 tracking-wider">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {streaming.free && streaming.free.length > 0 && (
                <div className="mb-3">
                  <h5 className="text-green-400 text-2xs font-bold tracking-[0.15em] uppercase mb-1">FREE</h5>
                  <div className="flex flex-wrap gap-1">
                    {streaming.free.map((p) => (
                      <span key={p} className="text-2xs px-1.5 py-0.5 bg-green-950/50 text-green-300 border border-green-800/40 tracking-wider">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {streaming.ads && streaming.ads.length > 0 && (
                <div className="mb-3">
                  <h5 className="text-cyan-400 text-2xs font-bold tracking-[0.15em] uppercase mb-1">FREE WITH ADS</h5>
                  <div className="flex flex-wrap gap-1">
                    {streaming.ads.map((p) => (
                      <span key={p} className="text-2xs px-1.5 py-0.5 bg-cyan-950/50 text-cyan-300 border border-cyan-800/40 tracking-wider">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {streaming.rent && streaming.rent.length > 0 && (
                <div className="mb-3">
                  <h5 className="text-amber-400 text-2xs font-bold tracking-[0.15em] uppercase mb-1">RENT</h5>
                  <div className="flex flex-wrap gap-1">
                    {streaming.rent.map((p) => (
                      <span key={p} className="text-2xs px-1.5 py-0.5 bg-amber-950/50 text-amber-300 border border-amber-800/40 tracking-wider">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {streaming.buy && streaming.buy.length > 0 && (
                <div className="mb-3">
                  <h5 className="text-zinc-400 text-2xs font-bold tracking-[0.15em] uppercase mb-1">BUY</h5>
                  <div className="flex flex-wrap gap-1">
                    {streaming.buy.map((p) => (
                      <span key={p} className="text-2xs px-1.5 py-0.5 bg-zinc-900 text-zinc-300 border border-zinc-700/40 tracking-wider">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <span className="text-zinc-700 text-2xs mt-auto pt-3 tracking-widest uppercase text-center shrink-0">
            TAP TO CLOSE
          </span>
        </div>
      )}
    </div>
  );
}
