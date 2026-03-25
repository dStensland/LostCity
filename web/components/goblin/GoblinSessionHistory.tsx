"use client";

import { useState, useCallback } from "react";

interface SessionSummary {
  id: number;
  name: string | null;
  date: string;
  is_active: boolean;
  movie_count: number;
  themes: string[];
  canceled_themes: string[];
}

interface Props {
  sessions: SessionSummary[];
  onStartSession: () => void;
  onDeleteSession: (id: number) => void;
}

interface SessionDetail {
  id: number;
  name: string | null;
  date: string;
  is_active: boolean;
  movies: {
    id: number;
    title: string;
    watch_order: number;
    added_at: string;
  }[];
  themes: {
    id: number;
    label: string;
    status: string;
    created_at: string;
    canceled_at: string | null;
  }[];
  timeline: {
    id: number;
    event_type: string;
    movie_id: number | null;
    theme_id: number | null;
    created_at: string;
  }[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).toUpperCase();
}

function formatTimestamp(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).toUpperCase();
}

function SessionDetailView({ detail }: { detail: SessionDetail }) {
  const sortedMovies = [...detail.movies].sort(
    (a, b) => (a.watch_order ?? 0) - (b.watch_order ?? 0)
  );
  const activeThemes = detail.themes.filter((t) => t.status === "active");
  const canceledThemes = detail.themes.filter((t) => t.status === "canceled");

  return (
    <div className="border-t-2 border-zinc-800 bg-black/60 px-4 py-4 space-y-4">
      {/* Movies */}
      {sortedMovies.length > 0 && (
        <div>
          <h4 className="text-red-600 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
            WATCH ORDER
          </h4>
          <div className="space-y-1">
            {sortedMovies.map((movie, i) => (
              <div key={movie.id} className="flex items-baseline gap-2">
                <span className="text-red-700 font-bold text-xs tabular-nums w-5 text-right shrink-0">
                  {i + 1}.
                </span>
                <span className="text-zinc-300 text-xs uppercase tracking-wide">
                  {movie.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Themes */}
      {(activeThemes.length > 0 || canceledThemes.length > 0) && (
        <div>
          <h4 className="text-red-600 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
            THEMES
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {activeThemes.map((t) => (
              <span
                key={t.id}
                className="text-2xs px-2 py-0.5 border border-red-700 text-red-400 font-bold tracking-wider uppercase"
              >
                {t.label}
              </span>
            ))}
            {canceledThemes.map((t) => (
              <span
                key={t.id}
                className="text-2xs px-2 py-0.5 border border-zinc-800 text-zinc-600 font-bold tracking-wider uppercase line-through"
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      {detail.timeline.length > 0 && (
        <div>
          <h4 className="text-red-600 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
            TIMELINE
          </h4>
          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {detail.timeline.map((entry) => {
              const movie = entry.movie_id
                ? detail.movies.find((m) => m.id === entry.movie_id)
                : null;
              const theme = entry.theme_id
                ? detail.themes.find((t) => t.id === entry.theme_id)
                : null;

              return (
                <div key={entry.id} className="flex items-baseline gap-2 text-2xs">
                  <span className="text-zinc-600 tabular-nums shrink-0">
                    {formatTimestamp(entry.created_at)}
                  </span>
                  <span className="text-zinc-500 uppercase tracking-wider">
                    {entry.event_type.replace(/_/g, " ")}
                    {movie && (
                      <span className="text-zinc-400"> — {movie.title}</span>
                    )}
                    {theme && (
                      <span className="text-zinc-400"> — {theme.label}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sortedMovies.length === 0 &&
        activeThemes.length === 0 &&
        canceledThemes.length === 0 &&
        detail.timeline.length === 0 && (
          <p className="text-zinc-700 text-xs tracking-widest uppercase text-center py-2">
            // EMPTY SESSION — NO DATA RECORDED
          </p>
        )}
    </div>
  );
}

export default function GoblinSessionHistory({
  sessions,
  onStartSession,
  onDeleteSession,
}: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailCache, setDetailCache] = useState<Record<number, SessionDetail>>(
    {}
  );
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const hasActiveSesssion = sessions.some((s) => s.is_active);

  const handleExpand = useCallback(
    async (id: number) => {
      if (expandedId === id) {
        setExpandedId(null);
        return;
      }

      setExpandedId(id);

      if (detailCache[id]) return;

      setLoadingId(id);
      try {
        const res = await fetch(`/api/goblinday/sessions/${id}`);
        if (res.ok) {
          const data = await res.json();
          setDetailCache((prev) => ({ ...prev, [id]: data }));
        }
      } catch {
        // Silently fail — user can retry by collapsing and re-expanding
      } finally {
        setLoadingId(null);
      }
    },
    [expandedId, detailCache]
  );

  const pastSessions = sessions.filter((s) => !s.is_active);

  return (
    <div className="space-y-8">
      {/* START GOBLIN DAY button */}
      <div className="flex justify-center">
        <button
          onClick={onStartSession}
          disabled={hasActiveSesssion}
          className={`px-12 py-4 font-mono font-black text-lg tracking-[0.25em] uppercase border-2 transition-all ${
            hasActiveSesssion
              ? "border-zinc-700 bg-zinc-900 text-zinc-600 cursor-not-allowed"
              : "border-red-600 bg-red-900/40 text-red-400 hover:bg-red-800/60 hover:text-red-300 hover:shadow-[0_0_30px_rgba(220,38,38,0.4)] hover:border-red-500 active:scale-95"
          }`}
        >
          {hasActiveSesssion ? "SESSION IN PROGRESS" : "START GOBLIN DAY"}
        </button>
      </div>

      {/* Past sessions list */}
      {pastSessions.length === 0 ? (
        <p className="text-center text-zinc-600 py-16 text-sm tracking-[0.2em] uppercase font-mono">
          NO PAST SESSIONS — START YOUR FIRST GOBLIN DAY
        </p>
      ) : (
        <div className="space-y-0">
          <h2 className="text-red-600 text-2xs font-bold tracking-[0.2em] uppercase mb-3 font-mono">
            PAST SESSIONS [{pastSessions.length}]
          </h2>

          <div className="border-2 border-zinc-800">
            {pastSessions.map((session, index) => {
              const displayName =
                session.name ||
                `GOBLIN DAY #${pastSessions.length - index}`;
              const isExpanded = expandedId === session.id;
              const isLoading = loadingId === session.id;
              const detail = detailCache[session.id];

              return (
                <div
                  key={session.id}
                  className={`border-b border-zinc-800 last:border-b-0 ${
                    isExpanded ? "bg-zinc-950" : "bg-black"
                  }`}
                >
                  {/* Summary row */}
                  <button
                    onClick={() => handleExpand(session.id)}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-zinc-900/60 transition-colors group"
                  >
                    {/* Expand indicator */}
                    <span
                      className={`text-red-700 text-xs font-bold transition-transform duration-200 shrink-0 ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    >
                      &#9654;
                    </span>

                    {/* Date */}
                    <span className="text-zinc-500 text-2xs tracking-wider tabular-nums shrink-0 w-32">
                      {formatDate(session.date)}
                    </span>

                    {/* Name */}
                    <span className="text-zinc-300 text-xs font-bold tracking-wider uppercase truncate flex-1 group-hover:text-red-400 transition-colors">
                      {displayName}
                    </span>

                    {/* Movie count */}
                    <span className="text-zinc-600 text-2xs tracking-wider shrink-0">
                      {session.movie_count}{" "}
                      {session.movie_count === 1 ? "MOVIE" : "MOVIES"}
                    </span>

                    {/* Theme pills */}
                    <div className="hidden sm:flex items-center gap-1 shrink-0">
                      {session.themes.slice(0, 3).map((theme) => (
                        <span
                          key={theme}
                          className="text-2xs px-1.5 py-0.5 border border-red-800/60 text-red-500/80 tracking-wider uppercase"
                        >
                          {theme}
                        </span>
                      ))}
                      {session.themes.length > 3 && (
                        <span className="text-2xs text-zinc-600">
                          +{session.themes.length - 3}
                        </span>
                      )}
                      {session.canceled_themes.length > 0 && (
                        <span className="text-2xs text-zinc-700 line-through tracking-wider">
                          {session.canceled_themes.length} CANCELED
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <>
                      {isLoading && !detail && (
                        <div className="border-t-2 border-zinc-800 px-4 py-6 flex items-center justify-center">
                          <span className="text-red-700 text-xs tracking-[0.3em] uppercase animate-pulse">
                            LOADING...
                          </span>
                        </div>
                      )}
                      {detail && <SessionDetailView detail={detail} />}
                      <div className="border-t border-zinc-800 px-4 py-3 flex justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSession(session.id);
                          }}
                          className="text-2xs font-bold tracking-widest uppercase text-zinc-600 hover:text-red-500 transition-colors px-3 py-1.5 border border-zinc-800 hover:border-red-800 hover:bg-red-950/20"
                        >
                          DELETE SESSION
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
