"use client";

import { useState } from "react";
import SmartImage from "@/components/SmartImage";
import { formatWatchedDate, TMDB_POSTER_W342, type LogEntry } from "@/lib/goblin-log-utils";

interface Props {
  entry: LogEntry;
  index: number;
  onEdit: (entry: LogEntry) => void;
  /** If true, render read-only (for public page) */
  readOnly?: boolean;
}

export default function GoblinLogEntryCard({ entry, index, onEdit, readOnly }: Props) {
  const [expanded, setExpanded] = useState(false);
  const movie = entry.movie;
  const hasDetails = entry.note || entry.watched_with;

  return (
    <div
      className="group relative animate-slide-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Poster */}
      <button
        onClick={() => (readOnly ? setExpanded(!expanded) : onEdit(entry))}
        className="relative w-full aspect-[2/3] rounded-lg overflow-hidden
          bg-[var(--twilight)] shadow-card-sm
          transition-all duration-300 ease-out
          hover:shadow-card-lg hover:-translate-y-1 hover:scale-[1.02]
          focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]"
      >
        {movie.poster_path ? (
          <SmartImage
            src={`${TMDB_POSTER_W342}${movie.poster_path}`}
            alt={movie.title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full p-3">
            <span className="text-sm text-[var(--muted)] text-center font-mono">
              {movie.title}
            </span>
          </div>
        )}

        {/* Hover overlay */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent
            opacity-0 group-hover:opacity-100 transition-opacity duration-300
            flex flex-col justify-end p-3"
        >
          <p className="text-sm font-semibold text-white leading-tight">
            {movie.title}
          </p>
          {movie.director && (
            <p className="text-xs text-white/60 mt-0.5">{movie.director}</p>
          )}
          {!readOnly && (
            <p className="text-xs text-[var(--coral)] font-mono mt-1">Edit</p>
          )}
        </div>

        {/* Date badge */}
        <div
          className="absolute top-2 left-2 px-1.5 py-0.5 rounded
            bg-black/60 backdrop-blur-sm"
        >
          <span className="text-2xs font-mono font-bold text-white/80">
            {formatWatchedDate(entry.watched_date)}
          </span>
        </div>
      </button>

      {/* Title + tags below poster */}
      <div className="mt-2 px-0.5">
        <p className="text-sm font-medium text-[var(--cream)] leading-tight truncate">
          {movie.title}
        </p>

        {/* Tags */}
        {entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
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
        )}

        {/* Watched with */}
        {entry.watched_with && (
          <p className="text-xs text-[var(--muted)] mt-1 truncate">
            w/ {entry.watched_with}
          </p>
        )}
      </div>

      {/* Expanded details (public page click-to-expand) */}
      {readOnly && expanded && hasDetails && (
        <div className="mt-2 px-0.5 animate-fade-in">
          {entry.note && (
            <p className="text-xs text-[var(--soft)] leading-relaxed">
              {entry.note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
