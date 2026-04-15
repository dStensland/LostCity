"use client";

import { useState, useCallback } from "react";

type SessionStatus = "planning" | "live" | "ended" | "canceled";

interface SessionMember {
  user_id: string;
  role: string;
  display_name: string;
  avatar_url: string | null;
}

export interface SessionSummary {
  id: number;
  name: string | null;
  date: string;
  status: SessionStatus;
  invite_code?: string | null;
  movie_count: number;
  themes: string[];
  canceled_themes: string[];
  members?: SessionMember[];
}

interface Props {
  sessions: SessionSummary[];
  onStartSession: () => void;
  onDeleteSession: (id: number) => void;
  loading?: boolean;
}

function SatanicSkullSpinner() {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <svg
        viewBox="0 0 100 100"
        className="w-16 h-16 animate-skull-spin"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Skull */}
        <ellipse cx="50" cy="42" rx="28" ry="30" stroke="#dc2626" strokeWidth="2.5" fill="#0a0a0a" />
        {/* Left eye */}
        <path d="M36 38 L30 44 L36 50 L42 44 Z" fill="#dc2626" />
        {/* Right eye */}
        <path d="M58 38 L52 44 L58 50 L64 44 Z" fill="#dc2626" />
        {/* Nose */}
        <path d="M50 50 L47 56 L53 56 Z" fill="#dc2626" />
        {/* Jaw */}
        <path d="M32 60 Q50 75 68 60" stroke="#dc2626" strokeWidth="2" fill="none" />
        {/* Teeth */}
        <line x1="38" y1="60" x2="38" y2="66" stroke="#dc2626" strokeWidth="1.5" />
        <line x1="44" y1="61" x2="44" y2="68" stroke="#dc2626" strokeWidth="1.5" />
        <line x1="50" y1="62" x2="50" y2="69" stroke="#dc2626" strokeWidth="1.5" />
        <line x1="56" y1="61" x2="56" y2="68" stroke="#dc2626" strokeWidth="1.5" />
        <line x1="62" y1="60" x2="62" y2="66" stroke="#dc2626" strokeWidth="1.5" />
        {/* Inverted pentagram */}
        <polygon
          points="50,22 43,8 57,8"
          stroke="#dc2626"
          strokeWidth="1"
          fill="none"
          opacity="0.6"
        />
        <polygon
          points="50,22 35,14 65,14"
          stroke="#dc2626"
          strokeWidth="1"
          fill="none"
          opacity="0.6"
        />
        {/* Horns */}
        <path d="M25 30 Q15 10 22 2" stroke="#dc2626" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M75 30 Q85 10 78 2" stroke="#dc2626" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </svg>
      <span className="font-mono text-xs text-red-600 tracking-[0.3em] uppercase animate-pulse">
        SUMMONING...
      </span>
      <style>{`
        @keyframes skull-spin {
          0% { transform: rotateY(0deg); }
          100% { transform: rotateY(360deg); }
        }
        .animate-skull-spin {
          animation: skull-spin 1.5s ease-in-out infinite;
          transform-style: preserve-3d;
        }
      `}</style>
    </div>
  );
}

interface SessionDetail {
  id: number;
  name: string | null;
  date: string;
  status: SessionStatus;
  invite_code?: string | null;
  members?: SessionMember[];
  guest_names?: string[];
  movies: {
    id: number;
    title: string;
    watch_order: number;
    added_at: string;
    poster_path: string | null;
    dnf: boolean;
  }[];
  themes: {
    id: number;
    label: string;
    status: string;
    created_at: string;
    canceled_at: string | null;
    goblin_theme_movies: Array<{ movie_id: number }>;
  }[];
  timeline: {
    id: number;
    event_type: string;
    movie_id: number | null;
    theme_id: number | null;
    user_name?: string | null;
    created_at: string;
  }[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d
    .toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
}

function formatTimestamp(isoStr: string): string {
  const d = new Date(isoStr);
  return d
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toUpperCase();
}

function StatusBadge({ status }: { status: SessionStatus }) {
  if (status === "live") {
    return (
      <span className="flex items-center gap-1 text-2xs font-bold tracking-[0.2em] uppercase border border-red-700 bg-red-950/40 text-red-400 px-1.5 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
        LIVE
      </span>
    );
  }
  if (status === "planning") {
    return (
      <span className="text-2xs font-bold tracking-[0.2em] uppercase border border-amber-800/60 bg-amber-950/30 text-amber-500 px-1.5 py-0.5">
        PLANNING
      </span>
    );
  }
  if (status === "canceled") {
    return (
      <span className="text-2xs font-bold tracking-[0.2em] uppercase border border-zinc-700 bg-zinc-900/30 text-zinc-500 px-1.5 py-0.5 line-through">
        CANCELED
      </span>
    );
  }
  return (
    <span className="text-2xs font-bold tracking-[0.2em] uppercase border border-zinc-800 bg-zinc-900/30 text-zinc-600 px-1.5 py-0.5">
      ENDED
    </span>
  );
}

function SessionDetailView({
  detail,
  onRefresh,
}: {
  detail: SessionDetail;
  onRefresh: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(detail.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [guestInput, setGuestInput] = useState("");
  const [savingGuests, setSavingGuests] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== "undefined" && detail.invite_code
    ? `${window.location.origin}${window.location.pathname.replace(/\/$/, "")}/s/${detail.invite_code}`
    : null;

  const handleCopyShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail
    }
  };

  const guests = detail.guest_names ?? [];

  const handleAddGuest = async () => {
    const name = guestInput.trim();
    if (!name) return;
    setSavingGuests(true);
    try {
      const updated = [...guests, name];
      const res = await fetch(`/api/goblinday/sessions/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guest_names: updated }),
      });
      if (res.ok) {
        setGuestInput("");
        onRefresh();
      }
    } finally {
      setSavingGuests(false);
    }
  };

  const handleRemoveGuest = async (index: number) => {
    setSavingGuests(true);
    try {
      const updated = guests.filter((_, i) => i !== index);
      const res = await fetch(`/api/goblinday/sessions/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guest_names: updated }),
      });
      if (res.ok) onRefresh();
    } finally {
      setSavingGuests(false);
    }
  };

  const sortedMovies = [...detail.movies].sort(
    (a, b) => (a.watch_order ?? 0) - (b.watch_order ?? 0)
  );
  const watchedMovies = sortedMovies.filter((m) => !m.dnf);
  const dnfMovies = sortedMovies.filter((m) => m.dnf);
  const activeThemes = detail.themes.filter((t) => t.status === "active");
  const canceledThemes = detail.themes.filter((t) => t.status === "canceled");

  // Compute which themes were "completed" (checked in every watched movie)
  const watchedMovieIds = new Set(watchedMovies.map((m) => m.id));
  const completedThemes = activeThemes.filter(
    (t) =>
      watchedMovieIds.size > 0 &&
      watchedMovies.every((m) =>
        t.goblin_theme_movies.some((tm) => tm.movie_id === m.id)
      )
  );
  const completedThemeIds = new Set(completedThemes.map((t) => t.id));
  const incompleteThemes = activeThemes.filter(
    (t) => !completedThemeIds.has(t.id)
  );

  const handleSaveName = async () => {
    setSavingName(true);
    try {
      const res = await fetch(`/api/goblinday/sessions/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameValue.trim() }),
      });
      if (res.ok) {
        setEditingName(false);
        onRefresh();
      }
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="border-t-2 border-zinc-800 bg-black/60 px-3 sm:px-4 py-4 space-y-5">
      {/* Share link */}
      {detail.status === "ended" && shareUrl && (
        <div>
          <h4 className="text-red-600 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
            SHARE RECAP
          </h4>
          <div className="flex items-center gap-2 border border-zinc-800 bg-zinc-950 p-2">
            <code className="text-zinc-400 text-2xs tracking-wider flex-1 min-w-0 truncate font-mono overflow-hidden">
              {shareUrl}
            </code>
            <button
              onClick={handleCopyShare}
              className={`flex-shrink-0 px-3 py-1.5 text-2xs font-black tracking-[0.2em] uppercase border transition-colors ${
                copied
                  ? "bg-emerald-900/40 text-emerald-400 border-emerald-700"
                  : "bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white hover:border-zinc-500"
              }`}
            >
              {copied ? "COPIED!" : "COPY"}
            </button>
          </div>
        </div>
      )}

      {/* Editable name */}
      <div>
        <h4 className="text-red-600 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
          SESSION NAME
        </h4>
        {editingName ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              maxLength={40}
              className="flex-1 px-2 py-1.5 bg-zinc-900 border border-zinc-700 text-white text-xs font-mono tracking-wider uppercase placeholder:text-zinc-700 focus:outline-none focus:border-red-700"
              placeholder="NAME THIS GOBLIN DAY..."
              autoFocus
            />
            <button
              onClick={handleSaveName}
              disabled={savingName}
              className="px-3 py-1.5 bg-red-900 text-red-100 text-2xs font-bold tracking-wider uppercase border border-red-700 disabled:opacity-40"
            >
              {savingName ? "..." : "SAVE"}
            </button>
            <button
              onClick={() => {
                setEditingName(false);
                setNameValue(detail.name ?? "");
              }}
              className="px-2 py-1.5 text-zinc-600 text-2xs font-bold tracking-wider uppercase border border-zinc-800 hover:border-zinc-600"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="text-zinc-300 text-xs font-bold tracking-wider uppercase hover:text-red-400 transition-colors"
          >
            {detail.name || "UNNAMED SESSION"}{" "}
            <span className="text-zinc-700 text-2xs ml-1">EDIT</span>
          </button>
        )}
      </div>

      {/* Members */}
      {detail.members && detail.members.length > 0 && (
        <div>
          <h4 className="text-red-600 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
            GOBLINS
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {detail.members.map((m) => (
              <span
                key={m.user_id}
                className="text-2xs px-2 py-0.5 border border-zinc-800 text-zinc-400 tracking-wider uppercase"
              >
                {m.display_name}
                {m.role === "host" && (
                  <span className="text-red-700 ml-1">[HOST]</span>
                )}
              </span>
            ))}
            {(detail.guest_names ?? []).map((guestName, i) => (
              <span
                key={`guest-${i}`}
                className="text-2xs px-2 py-0.5 border border-zinc-800 text-zinc-400 tracking-wider uppercase"
              >
                {guestName}
                <span className="text-zinc-700 ml-1">[GUEST]</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Guest attendees */}
      <div>
        <h4 className="text-red-600 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
          GUESTS
        </h4>
        {guests.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {guests.map((name, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 text-2xs px-2 py-0.5 border border-zinc-800 text-zinc-400 tracking-wider uppercase"
              >
                {name}
                <button
                  onClick={() => handleRemoveGuest(i)}
                  disabled={savingGuests}
                  className="text-zinc-600 hover:text-red-500 transition-colors disabled:opacity-40 font-black"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={guestInput}
            onChange={(e) => setGuestInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddGuest();
              }
            }}
            maxLength={30}
            className="flex-1 px-2 py-1.5 bg-zinc-900 border border-zinc-700 text-white text-xs font-mono tracking-wider uppercase placeholder:text-zinc-700 focus:outline-none focus:border-red-700"
            placeholder="ADD GUEST NAME..."
            disabled={savingGuests}
          />
          <button
            onClick={handleAddGuest}
            disabled={savingGuests || !guestInput.trim()}
            className="px-3 py-1.5 bg-red-900 text-red-100 text-2xs font-bold tracking-wider uppercase border border-red-700 disabled:opacity-40"
          >
            {savingGuests ? "..." : "ADD"}
          </button>
        </div>
      </div>

      {/* Completed themes */}
      {completedThemes.length > 0 && (
        <div>
          <h4 className="text-amber-500 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
            {"\u{1F525}"} COMPLETED THEMES [{completedThemes.length}]
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {completedThemes.map((t) => (
              <span
                key={t.id}
                className="text-2xs px-2.5 py-1 border-2 border-amber-700/60 bg-amber-950/30 text-amber-400 font-bold tracking-wider uppercase"
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Incomplete active themes */}
      {incompleteThemes.length > 0 && (
        <div>
          <h4 className="text-red-600 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
            ACTIVE THEMES [{incompleteThemes.length}]
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {incompleteThemes.map((t) => (
              <span
                key={t.id}
                className="text-2xs px-2 py-0.5 border border-red-700 text-red-400 font-bold tracking-wider uppercase"
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Canceled themes */}
      {canceledThemes.length > 0 && (
        <div>
          <h4 className="text-zinc-600 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
            CANCELED THEMES [{canceledThemes.length}]
          </h4>
          <div className="flex flex-wrap gap-1.5">
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

      {/* Watch order with posters */}
      {watchedMovies.length > 0 && (
        <div>
          <h4 className="text-red-600 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
            WATCH ORDER
          </h4>
          <div className="space-y-1.5">
            {watchedMovies.map((movie, i) => (
              <div key={movie.id} className="flex items-center gap-2.5">
                <span className="text-red-700 font-black text-xs tabular-nums w-5 text-right shrink-0">
                  {i + 1}.
                </span>
                {movie.poster_path && (
                  <div className="w-6 h-9 flex-shrink-0 bg-zinc-900 overflow-hidden relative">
                    <img
                      src={`https://image.tmdb.org/t/p/w200${movie.poster_path}`}
                      alt={movie.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <span className="text-zinc-300 text-xs uppercase tracking-wide font-bold">
                  {movie.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DNF movies */}
      {dnfMovies.length > 0 && (
        <div>
          <h4 className="text-zinc-600 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
            DID NOT FINISH [{dnfMovies.length}]
          </h4>
          <div className="space-y-1.5">
            {dnfMovies.map((movie) => (
              <div key={movie.id} className="flex items-center gap-2.5 opacity-50">
                <span className="text-zinc-700 font-black text-xs tabular-nums w-5 text-right shrink-0 line-through">
                  {movie.watch_order}.
                </span>
                {movie.poster_path && (
                  <div className="w-6 h-9 flex-shrink-0 bg-zinc-900 overflow-hidden relative grayscale">
                    <img
                      src={`https://image.tmdb.org/t/p/w200${movie.poster_path}`}
                      alt={movie.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <span className="text-zinc-500 text-xs uppercase tracking-wide line-through">
                  {movie.title}
                </span>
                <span className="text-zinc-700 text-2xs font-bold tracking-wider">
                  DNF
                </span>
              </div>
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
                <div
                  key={entry.id}
                  className="flex items-baseline gap-2 text-2xs"
                >
                  <span className="text-zinc-600 tabular-nums shrink-0">
                    {formatTimestamp(entry.created_at)}
                  </span>
                  <span className="text-zinc-500 uppercase tracking-wider">
                    {entry.user_name && (
                      <span className="text-zinc-400 font-bold mr-1">
                        {entry.user_name.toUpperCase()}
                      </span>
                    )}
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
            {"// EMPTY SESSION — NO DATA RECORDED"}
          </p>
        )}
    </div>
  );
}

export default function GoblinSessionHistory({
  sessions,
  onStartSession,
  onDeleteSession,
  loading = false,
}: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailCache, setDetailCache] = useState<Record<number, SessionDetail>>(
    {}
  );
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const hasActiveSession = sessions.some(
    (s) => s.status === "live" || s.status === "planning"
  );

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

  const pastSessions = sessions.filter((s) => s.status === "ended" || s.status === "canceled");

  return (
    <div className="space-y-8">
      {/* START GOBLIN DAY button */}
      {loading ? (
        <SatanicSkullSpinner />
      ) : (
        <div className="flex justify-center px-4">
          <button
            onClick={onStartSession}
            disabled={hasActiveSession}
            className={`w-full sm:w-auto px-8 sm:px-12 py-4 font-mono font-black text-base sm:text-lg tracking-[0.2em] sm:tracking-[0.25em] uppercase border-2 transition-all min-h-[52px] ${
              hasActiveSession
                ? "border-zinc-700 bg-zinc-900 text-zinc-600 cursor-not-allowed"
                : "border-red-600 bg-red-900/40 text-red-400 hover:bg-red-800/60 hover:text-red-300 hover:shadow-[0_0_30px_rgba(220,38,38,0.4)] hover:border-red-500 active:scale-95"
            }`}
          >
            {hasActiveSession ? "SESSION IN PROGRESS" : "START GOBLIN DAY"}
          </button>
        </div>
      )}

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
                session.name || `GOBLIN DAY #${pastSessions.length - index}`;
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
                    className="w-full text-left px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3 hover:bg-zinc-900/60 transition-colors group min-h-[52px]"
                  >
                    {/* Expand indicator */}
                    <span
                      className={`text-red-700 text-xs font-bold transition-transform duration-200 shrink-0 ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    >
                      &#9654;
                    </span>

                    {/* Date — hidden on mobile, shown on sm+ */}
                    <span className="hidden sm:inline text-zinc-500 text-2xs tracking-wider tabular-nums shrink-0 w-32">
                      {formatDate(session.date)}
                    </span>

                    {/* Name + mobile date */}
                    <div className="flex-1 min-w-0">
                      <span className="text-zinc-300 text-xs font-bold tracking-wider uppercase truncate block group-hover:text-red-400 transition-colors">
                        {displayName}
                      </span>
                      <span className="sm:hidden text-zinc-600 text-2xs tracking-wider tabular-nums">
                        {formatDate(session.date)}
                      </span>
                    </div>

                    {/* Status badge */}
                    <div className="shrink-0">
                      <StatusBadge status={session.status} />
                    </div>

                    {/* Movie count */}
                    <span className="text-zinc-600 text-2xs tracking-wider shrink-0">
                      {session.movie_count}{" "}
                      <span className="hidden sm:inline">{session.movie_count === 1 ? "MOVIE" : "MOVIES"}</span>
                      <span className="sm:hidden">{session.movie_count === 1 ? "M" : "M"}</span>
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
                      {detail && (
                        <SessionDetailView
                          detail={detail}
                          onRefresh={() => {
                            setDetailCache((prev) => {
                              const next = { ...prev };
                              delete next[session.id];
                              return next;
                            });
                            handleExpand(session.id);
                          }}
                        />
                      )}
                      <div className="border-t border-zinc-800 px-3 sm:px-4 py-3 flex justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSession(session.id);
                          }}
                          className="text-2xs font-bold tracking-widest uppercase text-zinc-600 hover:text-red-500 transition-colors px-3 py-2 sm:py-1.5 border border-zinc-800 hover:border-red-800 hover:bg-red-950/20 min-h-[40px]"
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
