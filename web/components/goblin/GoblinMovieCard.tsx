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

  return (
    <div
      className={`bg-zinc-900 rounded-lg overflow-hidden border transition-colors ${
        movie.proposed && !movie.watched
          ? "border-orange-500/50 shadow-[0_0_12px_rgba(249,115,22,0.15)]"
          : movie.watched
            ? "border-zinc-800/50 opacity-75"
            : "border-zinc-800 hover:border-zinc-700"
      }`}
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] bg-zinc-800">
        {posterUrl ? (
          <SmartImage
            src={posterUrl}
            alt={movie.title}
            fill
            className={`object-cover ${movie.watched ? "grayscale" : ""}`}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
            No Poster
          </div>
        )}
        {movie.watched && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-3xl select-none">&#x2705;</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <div>
          <h3 className="font-semibold text-white text-sm leading-tight truncate">
            {movie.title}
          </h3>
          <p className="text-zinc-400 text-xs mt-0.5">{releaseDate}</p>
        </div>

        {/* RT Scores */}
        <div className="flex gap-3 text-xs">
          <span title="Critics Score">
            {movie.rt_critics_score != null ? (
              <span
                className={
                  movie.rt_critics_score >= 60
                    ? "text-red-400"
                    : "text-green-400"
                }
              >
                {movie.rt_critics_score >= 60 ? "\uD83C\uDF45" : "\uD83E\uDD6C"}{" "}
                {movie.rt_critics_score}%
              </span>
            ) : (
              <span className="text-zinc-500">{"\uD83C\uDF45"} --</span>
            )}
          </span>
          <span title="Audience Score">
            {movie.rt_audience_score != null ? (
              <span
                className={
                  movie.rt_audience_score >= 60
                    ? "text-yellow-400"
                    : "text-zinc-400"
                }
              >
                {"\uD83C\uDF7F"} {movie.rt_audience_score}%
              </span>
            ) : (
              <span className="text-zinc-500">{"\uD83C\uDF7F"} --</span>
            )}
          </span>
        </div>

        {/* Availability */}
        <div className="flex flex-wrap gap-1">
          {inTheaters && (
            <span className="text-2xs px-1.5 py-0.5 rounded bg-red-900/50 text-red-300 border border-red-800/50">
              In Theaters
            </span>
          )}
          {streamingProviders.map((provider) => (
            <span
              key={provider}
              className="text-2xs px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-300 border border-emerald-800/50"
            >
              {provider}
            </span>
          ))}
          {!isReleased && streaming.length === 0 && (
            <span className="text-2xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700/50">
              Not Released
            </span>
          )}
        </div>

        {/* Trailer */}
        <a
          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + " " + movie.year + " trailer")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-2xs text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1"
        >
          <span>&#9654;</span> Trailer
        </a>

        {/* Actions */}
        <div className="flex gap-2 pt-1 border-t border-zinc-800">
          <button
            onClick={() => onToggle(movie.id, "proposed", !movie.proposed)}
            className={`flex-1 text-2xs py-1.5 rounded font-medium transition-colors ${
              movie.proposed
                ? "bg-orange-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
            }`}
          >
            {movie.proposed ? "Proposed" : "Propose"}
          </button>
          <button
            onClick={() => onToggle(movie.id, "watched", !movie.watched)}
            className={`flex-1 text-2xs py-1.5 rounded font-medium transition-colors ${
              movie.watched
                ? "bg-emerald-700 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
            }`}
          >
            {movie.watched ? "Watched" : "Mark Watched"}
          </button>
        </div>
      </div>
    </div>
  );
}
