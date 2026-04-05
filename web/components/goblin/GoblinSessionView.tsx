"use client";

import { useState, useCallback, useMemo } from "react";
import SmartImage from "@/components/SmartImage";
import GoblinThemeMatrix from "./GoblinThemeMatrix";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SessionMovie {
  id: number;
  title: string;
  poster_path: string | null;
  watch_order: number;
  rt_critics_score: number | null;
  rt_audience_score: number | null;
}

interface SessionTheme {
  id: number;
  label: string;
  status: string;
  goblin_theme_movies: Array<{ movie_id: number; checked_by: string; checked_at: string }>;
}

interface TimelineEntry {
  id: number;
  event_type: string;
  movie_id: number | null;
  theme_id: number | null;
  user_id?: string | null;
  user_name?: string | null;
  created_at: string;
}

interface SessionMember {
  user_id: string;
  role: string;
  display_name: string;
  avatar_url: string | null;
}

export interface SessionData {
  id: number;
  name: string | null;
  date: string;
  status: "planning" | "live" | "ended" | "canceled";
  invite_code?: string | null;
  members?: SessionMember[];
  movies: SessionMovie[];
  themes: SessionTheme[];
  timeline: TimelineEntry[];
}

interface ProposedMovie {
  id: number;
  title: string;
  poster_path: string | null;
}

interface Props {
  session: SessionData;
  proposedMovies: ProposedMovie[];
  onRefresh: () => void;
  onEndSession: () => void;
  onCancelSession: () => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "JUST NOW";
  if (mins < 60) return `${mins}M AGO`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}H AGO`;
  const days = Math.floor(hrs / 24);
  return `${days}D AGO`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function GoblinSessionView({
  session,
  proposedMovies,
  onRefresh,
  onEndSession,
  onCancelSession,
}: Props) {
  const [addingMovieId, setAddingMovieId] = useState<number | null>(null);

  /* Lookup maps for timeline display */
  const movieMap = useMemo(() => {
    const m = new Map<number, SessionMovie>();
    for (const movie of session.movies) m.set(movie.id, movie);
    return m;
  }, [session.movies]);

  const themeMap = useMemo(() => {
    const m = new Map<number, SessionTheme>();
    for (const theme of session.themes) m.set(theme.id, theme);
    return m;
  }, [session.themes]);

  /* Sorted movies by watch order */
  const sortedMovies = useMemo(
    () => [...session.movies].sort((a, b) => a.watch_order - b.watch_order),
    [session.movies]
  );

  /* Chronological timeline (newest first) */
  const sortedTimeline = useMemo(
    () =>
      [...session.timeline].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [session.timeline]
  );

  /* Session display date */
  const displayDate = new Date(session.date + "T00:00:00").toLocaleDateString(
    "en-US",
    { weekday: "short", month: "short", day: "numeric", year: "numeric" }
  );

  /* ---- Actions ---- */

  const handleAddMovie = useCallback(
    async (movieId: number) => {
      setAddingMovieId(movieId);
      try {
        const res = await fetch(
          `/api/goblinday/sessions/${session.id}/movies`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ movie_id: movieId }),
          }
        );
        if (res.ok) onRefresh();
      } finally {
        setAddingMovieId(null);
      }
    },
    [session.id, onRefresh]
  );

  /* Already-added movie IDs for filtering proposed list */
  const addedMovieIds = useMemo(
    () => new Set(session.movies.map((m) => m.id)),
    [session.movies]
  );
  const availableProposed = proposedMovies.filter(
    (m) => !addedMovieIds.has(m.id)
  );

  /* ---- Timeline renderer ---- */

  function renderTimelineEntry(entry: TimelineEntry) {
    const actor = entry.user_name ? (
      <span className="text-zinc-300 font-bold mr-1">
        {entry.user_name.toUpperCase()}
      </span>
    ) : null;

    switch (entry.event_type) {
      case "movie_started": {
        const movie = entry.movie_id ? movieMap.get(entry.movie_id) : null;
        return (
          <span>
            <span className="text-red-500 mr-2">&#9654;</span>
            {actor}
            STARTED WATCHING{" "}
            <span className="text-white font-bold">
              {movie?.title ?? `#${entry.movie_id}`}
            </span>
          </span>
        );
      }
      case "theme_added": {
        const theme = entry.theme_id ? themeMap.get(entry.theme_id) : null;
        return (
          <span>
            <span className="text-red-500 mr-2">+</span>
            {actor}
            ADDED THEME{" "}
            <span className="text-white font-bold">
              &quot;{theme?.label ?? `#${entry.theme_id}`}&quot;
            </span>
          </span>
        );
      }
      case "theme_canceled": {
        const theme = entry.theme_id ? themeMap.get(entry.theme_id) : null;
        return (
          <span>
            <span className="text-zinc-500 mr-2">&#10005;</span>
            {actor}
            CANCELED THEME{" "}
            <span className="text-zinc-500 line-through">
              &quot;{theme?.label ?? `#${entry.theme_id}`}&quot;
            </span>
          </span>
        );
      }
      case "theme_checked": {
        const theme = entry.theme_id ? themeMap.get(entry.theme_id) : null;
        const movie = entry.movie_id ? movieMap.get(entry.movie_id) : null;
        return (
          <span className="text-zinc-600">
            <span className="text-zinc-700 mr-2">✓</span>
            {actor}
            SPOTTED{" "}
            <span className="text-zinc-500 font-bold">
              &quot;{theme?.label ?? `#${entry.theme_id}`}&quot;
            </span>
            {" "}IN{" "}
            <span className="text-zinc-500 font-bold">
              {movie?.title ?? `#${entry.movie_id}`}
            </span>
          </span>
        );
      }
      case "theme_unchecked": {
        const theme = entry.theme_id ? themeMap.get(entry.theme_id) : null;
        const movie = entry.movie_id ? movieMap.get(entry.movie_id) : null;
        return (
          <span className="text-zinc-600">
            <span className="text-zinc-700 mr-2">−</span>
            {actor}
            REMOVED{" "}
            <span className="text-zinc-600">
              &quot;{theme?.label ?? `#${entry.theme_id}`}&quot;
            </span>
            {" "}FROM{" "}
            <span className="text-zinc-600">
              {movie?.title ?? `#${entry.movie_id}`}
            </span>
          </span>
        );
      }
      default:
        return (
          <span>
            <span className="text-zinc-600 mr-2">?</span>
            {actor}
            {entry.event_type.toUpperCase()}
          </span>
        );
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-400 font-mono">
      {/* ---- HEADER BAR ---- */}
      <div className="border-b-2 border-zinc-800 bg-black">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4">
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center gap-1 text-2xs font-bold tracking-[0.2em] uppercase border border-red-700 bg-red-950/40 text-red-400 px-1.5 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                  LIVE
                </span>
              </div>
              <h1 className="text-white font-black text-lg sm:text-xl tracking-[0.15em] uppercase truncate">
                {session.name ?? "GOBLIN DAY"}
              </h1>
              <p className="text-zinc-600 text-xs tracking-[0.2em] uppercase mt-0.5">
                {displayDate}
              </p>
              {/* Members strip */}
              {session.members && session.members.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {session.members.map((m) => (
                    <span
                      key={m.user_id}
                      className="text-2xs px-1.5 py-0.5 border border-zinc-800 text-zinc-500 tracking-wider uppercase"
                    >
                      {m.display_name}
                      {m.role === "host" && (
                        <span className="text-red-700 ml-1">[H]</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {/* Desktop: side buttons */}
            <div className="hidden sm:flex flex-col gap-2 flex-shrink-0">
              <button
                onClick={onEndSession}
                className="px-4 py-2 bg-red-900 hover:bg-red-800 text-red-100 font-black text-xs tracking-[0.2em] uppercase border-2 border-red-700 hover:border-red-600 transition-colors shadow-[0_0_20px_rgba(185,28,28,0.3)] hover:shadow-[0_0_30px_rgba(185,28,28,0.5)]"
              >
                END GOBLIN DAY
              </button>
              <button
                onClick={onCancelSession}
                className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 font-bold text-2xs tracking-[0.2em] uppercase border border-zinc-700 hover:border-zinc-600 transition-colors"
              >
                CANCEL SESSION
              </button>
            </div>
          </div>
          {/* Mobile: full-width buttons below header */}
          <div className="flex sm:hidden gap-2 mt-3">
            <button
              onClick={onEndSession}
              className="flex-1 px-3 py-2.5 bg-red-900 hover:bg-red-800 text-red-100 font-black text-xs tracking-[0.15em] uppercase border-2 border-red-700 transition-colors shadow-[0_0_20px_rgba(185,28,28,0.3)] min-h-[44px]"
            >
              END GOBLIN DAY
            </button>
            <button
              onClick={onCancelSession}
              className="px-3 py-2.5 bg-zinc-900 text-zinc-500 font-bold text-2xs tracking-[0.15em] uppercase border border-zinc-700 transition-colors min-h-[44px]"
            >
              CANCEL
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-6 sm:space-y-8">
        {/* ---- ADD MOVIE SECTION ---- */}
        {availableProposed.length > 0 && (
          <section>
            <h2 className="text-red-600 text-xs font-bold tracking-[0.2em] uppercase mb-3 border-b border-zinc-800 pb-2">
              + ADD MOVIE
            </h2>
            <div className="space-y-1">
              {availableProposed.map((movie) => (
                <div
                  key={movie.id}
                  className="flex items-center gap-3 py-2 px-3 border border-zinc-800 bg-black hover:border-zinc-700 transition-colors"
                >
                  <div className="w-8 h-12 flex-shrink-0 bg-zinc-900 overflow-hidden relative">
                    {movie.poster_path ? (
                      <SmartImage
                        src={`${TMDB_IMAGE_BASE}${movie.poster_path}`}
                        alt={movie.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700 text-2xs">
                        ?
                      </div>
                    )}
                  </div>
                  <span className="text-white text-xs font-bold tracking-wider uppercase flex-1 min-w-0 truncate">
                    {movie.title}
                  </span>
                  <button
                    onClick={() => handleAddMovie(movie.id)}
                    disabled={addingMovieId === movie.id}
                    className="flex-shrink-0 px-3 py-2 sm:py-1.5 bg-red-900/60 hover:bg-red-800 text-red-300 hover:text-white text-xs font-black tracking-[0.15em] uppercase border border-red-800 hover:border-red-600 transition-colors disabled:opacity-40 min-h-[40px]"
                  >
                    {addingMovieId === movie.id ? "..." : "ADD"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---- MOVIES WATCHED ---- */}
        <section>
          <h2 className="text-red-600 text-xs font-bold tracking-[0.2em] uppercase mb-3 border-b border-zinc-800 pb-2">
            MOVIES WATCHED [{sortedMovies.length}]
          </h2>
          {sortedMovies.length === 0 ? (
            <p className="text-zinc-700 text-xs tracking-[0.2em] uppercase py-6 text-center">
              // NO MOVIES YET — ADD ONE ABOVE
            </p>
          ) : (
            <div className="space-y-1">
              {sortedMovies.map((movie) => (
                <div
                  key={movie.id}
                  className="flex items-center gap-3 py-2 px-3 border border-zinc-800 bg-black"
                >
                  <span className="text-red-700 font-black text-sm w-6 text-center flex-shrink-0">
                    {movie.watch_order}
                  </span>
                  <div className="w-8 h-12 flex-shrink-0 bg-zinc-900 overflow-hidden relative">
                    {movie.poster_path ? (
                      <SmartImage
                        src={`${TMDB_IMAGE_BASE}${movie.poster_path}`}
                        alt={movie.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700 text-2xs">
                        ?
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-white text-xs font-bold tracking-wider uppercase block truncate">
                      {movie.title}
                    </span>
                    <div className="flex gap-2 mt-0.5">
                      {movie.rt_critics_score != null && (
                        <span className="text-2xs text-red-500/70">
                          RT {movie.rt_critics_score}%
                        </span>
                      )}
                      {movie.rt_audience_score != null && (
                        <span className="text-2xs text-amber-500/70">
                          AUD {movie.rt_audience_score}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ---- THEME TRACKER ---- */}
        <GoblinThemeMatrix
          sessionId={session.id}
          movies={sortedMovies}
          themes={session.themes}
          onRefresh={onRefresh}
        />

        {/* ---- TIMELINE ---- */}
        <section>
          <h2 className="text-red-600 text-xs font-bold tracking-[0.2em] uppercase mb-3 border-b border-zinc-800 pb-2">
            TIMELINE
          </h2>
          {sortedTimeline.length === 0 ? (
            <p className="text-zinc-700 text-xs tracking-[0.2em] uppercase py-6 text-center">
              // NO ACTIVITY YET
            </p>
          ) : (
            <div className="space-y-0">
              {sortedTimeline.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 py-2 px-3 border-l-2 border-zinc-800"
                >
                  <span className="text-zinc-700 text-2xs tracking-[0.15em] uppercase flex-shrink-0 w-16 pt-0.5 text-right">
                    {relativeTime(entry.created_at)}
                  </span>
                  <span className="text-zinc-400 text-xs tracking-wider uppercase leading-relaxed">
                    {renderTimelineEntry(entry)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
