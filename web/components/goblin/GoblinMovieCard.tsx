"use client";

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
}

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

interface Props {
  movie: GoblinMovie;
  onToggle: (id: number, field: string, value: boolean) => void;
}

export default function GoblinMovieCard({ movie, onToggle }: Props) {
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
      className={`bg-zinc-950 overflow-hidden border-2 transition-all font-mono ${
        movie.proposed && !movie.watched
          ? "border-red-700 shadow-[0_0_20px_rgba(185,28,28,0.2)]"
          : movie.watched
            ? "border-zinc-800 opacity-50"
            : "border-zinc-800 hover:border-zinc-600"
      }`}
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] bg-zinc-900">
        {posterUrl ? (
          <SmartImage
            src={posterUrl}
            alt={movie.title}
            fill
            className={`object-cover ${movie.watched ? "grayscale" : ""}`}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-700 text-xs tracking-widest uppercase">
            NO POSTER
          </div>
        )}
        {movie.watched && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-emerald-500 font-black text-xs tracking-[0.3em] uppercase rotate-[-12deg]">
              WATCHED
            </span>
          </div>
        )}
        {movie.proposed && !movie.watched && (
          <div className="absolute top-0 left-0 bg-red-700 px-2 py-0.5">
            <span className="text-white font-bold text-2xs tracking-widest uppercase">
              PROPOSED
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 space-y-1.5">
        <div>
          <h3 className="font-bold text-white text-xs leading-tight line-clamp-2 uppercase tracking-wide">
            {movie.title}
          </h3>
          <p className="text-zinc-600 text-2xs mt-0.5 tracking-widest">{releaseDate}</p>
        </div>

        {/* RT Scores — raw numbers */}
        <div className="flex gap-3 text-2xs">
          <span className={movie.rt_critics_score != null ? (movie.rt_critics_score >= 60 ? "text-red-500" : "text-zinc-500") : "text-zinc-700"}>
            RT {movie.rt_critics_score != null ? `${movie.rt_critics_score}%` : "--"}
          </span>
          <span className={movie.rt_audience_score != null ? (movie.rt_audience_score >= 60 ? "text-amber-500" : "text-zinc-500") : "text-zinc-700"}>
            AUD {movie.rt_audience_score != null ? `${movie.rt_audience_score}%` : "--"}
          </span>
        </div>

        {/* Availability */}
        <div className="flex flex-wrap gap-1">
          {inTheaters && (
            <span className="text-2xs px-1.5 py-0.5 bg-red-900/80 text-red-300 font-bold tracking-wider uppercase">
              THEATERS
            </span>
          )}
          {streamingProviders.map((provider) => (
            <span
              key={provider}
              className="text-2xs px-1.5 py-0.5 bg-emerald-900/60 text-emerald-400 tracking-wider uppercase"
            >
              {provider}
            </span>
          ))}
          {!isReleased && streaming.length === 0 && (
            <span className="text-2xs px-1.5 py-0.5 bg-zinc-900 text-zinc-600 tracking-wider uppercase">
              UNRELEASED
            </span>
          )}
        </div>

        {/* Trailer link */}
        <a
          href={trailerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-2xs text-zinc-600 hover:text-red-500 transition-colors tracking-widest uppercase block"
        >
          &#9654; TRAILER
        </a>

        {/* Actions — hard rectangles */}
        <div className="flex gap-1 pt-1.5 border-t border-zinc-800">
          <button
            onClick={() => onToggle(movie.id, "proposed", !movie.proposed)}
            className={`flex-1 text-2xs py-1.5 font-bold tracking-wider uppercase transition-colors ${
              movie.proposed
                ? "bg-red-800 text-white"
                : "bg-zinc-900 text-zinc-500 hover:text-white hover:bg-zinc-800 border border-zinc-800"
            }`}
          >
            {movie.proposed ? "PROPOSED" : "PROPOSE"}
          </button>
          <button
            onClick={() => onToggle(movie.id, "watched", !movie.watched)}
            className={`flex-1 text-2xs py-1.5 font-bold tracking-wider uppercase transition-colors ${
              movie.watched
                ? "bg-emerald-800 text-white"
                : "bg-zinc-900 text-zinc-500 hover:text-white hover:bg-zinc-800 border border-zinc-800"
            }`}
          >
            {movie.watched ? "WATCHED" : "WATCHED?"}
          </button>
        </div>
      </div>
    </div>
  );
}
