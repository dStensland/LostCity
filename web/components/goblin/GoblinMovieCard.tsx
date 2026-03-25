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
  daniel_list: boolean;
  ashley_list: boolean;
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
    <div className="bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-colors">
      {/* Poster */}
      <div className="relative aspect-[2/3] bg-zinc-800">
        {posterUrl ? (
          <SmartImage
            src={posterUrl}
            alt={movie.title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
            No Poster
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
            🍅 {movie.rt_critics_score != null ? `${movie.rt_critics_score}%` : "N/A"}
          </span>
          <span title="Audience Score">
            🍿 {movie.rt_audience_score != null ? `${movie.rt_audience_score}%` : "N/A"}
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

        {/* Checkboxes */}
        <div className="flex flex-col gap-1.5 pt-1 border-t border-zinc-800">
          {(["watched", "daniel_list", "ashley_list"] as const).map((field) => {
            const labels: Record<string, string> = {
              watched: "Watched",
              daniel_list: "Daniel's List",
              ashley_list: "Ashley's List",
            };
            return (
              <label
                key={field}
                className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer hover:text-white transition-colors"
              >
                <input
                  type="checkbox"
                  checked={movie[field]}
                  onChange={() => onToggle(movie.id, field, !movie[field])}
                  className="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/30 focus:ring-offset-0"
                />
                {labels[field]}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
