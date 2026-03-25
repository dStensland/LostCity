"use client";

import { useState } from "react";
import SmartImage from "@/components/SmartImage";

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
  streaming_info: string[] | null;
  year: number;
  synopsis: string | null;
}

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

interface Props {
  movie: GoblinMovie;
  onToggle: (id: number, field: string, value: boolean) => void;
}

export default function GoblinMovieCard({ movie, onToggle }: Props) {
  const [showSynopsis, setShowSynopsis] = useState(false);

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

  const streaming = movie.streaming_info ?? [];
  const inTheaters = streaming.includes("theaters");
  const streamingProviders = streaming.filter((s) => s !== "theaters");

  const trailerUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + " " + movie.year + " trailer")}`;

  return (
    <div
      className={`group bg-zinc-950 overflow-hidden border-2 transition-all font-mono relative flex flex-col ${
        movie.proposed && !movie.watched
          ? "border-red-700 shadow-[0_0_20px_rgba(185,28,28,0.25)] hover:shadow-[0_0_30px_rgba(185,28,28,0.4)]"
          : movie.watched
            ? "border-zinc-800 opacity-50"
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
            className={`object-cover transition-transform duration-500 group-hover:scale-105 ${movie.watched ? "grayscale" : ""}`}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-700 text-xs tracking-widest uppercase">
            NO POSTER
          </div>
        )}
        {/* Dark vignette overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />
        {movie.watched && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-emerald-500 font-black text-sm tracking-[0.3em] uppercase rotate-[-12deg] border-2 border-emerald-500/50 px-3 py-1">
              WATCHED
            </span>
          </div>
        )}
        {movie.proposed && !movie.watched && (
          <div className="absolute top-0 left-0 bg-red-700 px-2 py-0.5 shadow-[4px_4px_0_rgba(0,0,0,0.5)]">
            <span className="text-white font-bold text-2xs tracking-widest uppercase">
              PROPOSED
            </span>
          </div>
        )}
        {/* Info button */}
        {movie.synopsis && (
          <button
            onClick={() => setShowSynopsis(!showSynopsis)}
            className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/70 hover:bg-red-900/80 border border-zinc-600/50 hover:border-red-600/50 text-zinc-400 hover:text-white text-xs font-bold flex items-center justify-center transition-all"
          >
            i
          </button>
        )}
        {/* Synopsis overlay */}
        {showSynopsis && movie.synopsis && (
          <div
            className="absolute inset-0 bg-black/90 p-3 flex flex-col justify-center cursor-pointer"
            onClick={() => setShowSynopsis(false)}
          >
            <p className="text-zinc-300 text-2xs leading-relaxed line-clamp-[8]">
              {movie.synopsis}
            </p>
            <span className="text-zinc-600 text-2xs mt-2 tracking-widest uppercase text-center">
              TAP TO CLOSE
            </span>
          </div>
        )}
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

        {/* Availability */}
        <div className="flex flex-wrap gap-1">
          {inTheaters && (
            <span className="text-2xs px-1.5 py-0.5 bg-red-900/80 text-red-300 font-bold tracking-wider uppercase border-l-2 border-red-500">
              THEATERS
            </span>
          )}
          {streamingProviders.map((provider) => (
            <span
              key={provider}
              className="text-2xs px-1.5 py-0.5 bg-emerald-950/60 text-emerald-400 tracking-wider uppercase border-l-2 border-emerald-600"
            >
              {provider}
            </span>
          ))}
          {!isReleased && streaming.length === 0 && (
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
            onClick={() => onToggle(movie.id, "proposed", !movie.proposed)}
            className={`flex-1 text-2xs py-2 font-bold tracking-wider uppercase transition-all ${
              movie.proposed
                ? "bg-red-800 text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.3)] hover:bg-red-700"
                : "bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-red-400 hover:border-red-900/50 hover:bg-red-950/20 hover:shadow-[0_0_8px_rgba(120,10,10,0.2)]"
            }`}
          >
            {movie.proposed ? "\u2666 PROPOSED" : "PROPOSE"}
          </button>
          <button
            onClick={() => onToggle(movie.id, "watched", !movie.watched)}
            className={`flex-1 text-2xs py-2 font-bold tracking-wider uppercase transition-all ${
              movie.watched
                ? "bg-emerald-800 text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.3)] hover:bg-emerald-700"
                : "bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-emerald-400 hover:border-emerald-900/50 hover:bg-emerald-950/20 hover:shadow-[0_0_8px_rgba(10,80,40,0.2)]"
            }`}
          >
            {movie.watched ? "\u2620 WATCHED" : "WATCHED?"}
          </button>
        </div>
      </div>
    </div>
  );
}
