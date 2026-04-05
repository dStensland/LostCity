"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import SmartImage from "@/components/SmartImage";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w200";

interface MatrixMovie {
  id: number;
  title: string;
  poster_path: string | null;
  watch_order: number;
}

interface ThemeCheck {
  movie_id: number;
  checked_by: string;
  checked_at: string;
}

interface MatrixTheme {
  id: number;
  label: string;
  status: string;
  goblin_theme_movies: ThemeCheck[];
}

interface Props {
  sessionId: number;
  movies: MatrixMovie[];
  themes: MatrixTheme[];
  onRefresh: () => void;
}

export default function GoblinThemeMatrix({
  sessionId,
  movies,
  themes,
  onRefresh,
}: Props) {
  const [themeLabel, setThemeLabel] = useState("");
  const [submittingTheme, setSubmittingTheme] = useState(false);
  const [showThemeForm, setShowThemeForm] = useState(false);
  const [themeError, setThemeError] = useState<string | null>(null);
  const [newThemeId, setNewThemeId] = useState<number | null>(null);
  // Optimistic toggle state: Map<"themeId-movieId", boolean>
  const [optimisticToggles, setOptimisticToggles] = useState<Map<string, boolean>>(new Map());
  // Track keys with in-flight API calls + pending refresh — polling must not clear these
  const inFlightKeys = useRef<Set<string>>(new Set());
  // Revision counter: only reconcile when this changes (not on every themes reference change)
  const [serverRevision, setServerRevision] = useState(0);
  const prevThemesRef = useRef<string>("");
  const [cancelingThemeId, setCancelingThemeId] = useState<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newRowRef = useRef<HTMLTableRowElement | null>(null);

  const sortedMovies = useMemo(
    () => [...movies].sort((a, b) => a.watch_order - b.watch_order),
    [movies]
  );

  const activeThemes = useMemo(
    () => themes.filter((t) => t.status === "active"),
    [themes]
  );

  // Build checked set from theme data
  const checkedSet = useMemo(() => {
    const s = new Set<string>();
    for (const theme of activeThemes) {
      for (const tm of theme.goblin_theme_movies) {
        s.add(`${theme.id}-${tm.movie_id}`);
      }
    }
    return s;
  }, [activeThemes]);

  // Resolve checked state with optimistic overrides
  const isChecked = useCallback(
    (themeId: number, movieId: number) => {
      const key = `${themeId}-${movieId}`;
      if (optimisticToggles.has(key)) return optimisticToggles.get(key)!;
      return checkedSet.has(key);
    },
    [checkedSet, optimisticToggles]
  );

  // Only bump revision when themes content actually changes (Bug 4 fix)
  useEffect(() => {
    const sig = JSON.stringify(
      themes.map((t) => [t.id, t.status, t.goblin_theme_movies.map((m) => m.movie_id).sort()])
    );
    if (sig !== prevThemesRef.current) {
      prevThemesRef.current = sig;
      setServerRevision((r) => r + 1);
    }
  }, [themes]);

  // Reconcile optimistic state when server data actually changes — keep in-flight keys
  useEffect(() => {
    setOptimisticToggles((prev) => {
      if (prev.size === 0) return prev;
      if (inFlightKeys.current.size === 0) return new Map();
      const kept = new Map<string, boolean>();
      for (const [key, val] of prev) {
        if (inFlightKeys.current.has(key)) kept.set(key, val);
      }
      return kept;
    });
  }, [serverRevision]);

  // Scroll new row into view (requestAnimationFrame ensures DOM has rendered)
  useEffect(() => {
    if (!newThemeId) return;
    requestAnimationFrame(() => {
      if (newRowRef.current) {
        newRowRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      setNewThemeId(null);
    });
  }, [newThemeId, activeThemes]);

  /* ---- Toggle a cell ---- */
  const handleToggle = useCallback(
    async (themeId: number, movieId: number) => {
      const key = `${themeId}-${movieId}`;

      // Mark in-flight so polling doesn't wipe optimistic state.
      // Key stays in-flight until AFTER the refresh response renders.
      inFlightKeys.current.add(key);

      // Bug 3 fix: read current state inside the updater to avoid stale closure on double-tap
      setOptimisticToggles((prev) => {
        const next = new Map(prev);
        const currentlyChecked = prev.has(key) ? prev.get(key)! : checkedSet.has(key);
        next.set(key, !currentlyChecked);
        return next;
      });

      try {
        const res = await fetch(
          `/api/goblinday/sessions/${sessionId}/themes/${themeId}/toggle`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ movie_id: movieId }),
          }
        );
        if (res.ok) {
          // Bug 1 fix: DON'T delete from inFlightKeys yet — keep protected
          // until the refresh data arrives. The refresh triggers a themes
          // change which bumps serverRevision, and THEN reconciliation runs.
          // We schedule the key removal after a short delay to let the
          // refresh response render first.
          onRefresh();
          setTimeout(() => {
            inFlightKeys.current.delete(key);
          }, 2000);
        } else {
          inFlightKeys.current.delete(key);
          setOptimisticToggles((prev) => {
            const next = new Map(prev);
            next.delete(key);
            return next;
          });
        }
      } catch {
        inFlightKeys.current.delete(key);
        setOptimisticToggles((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [sessionId, checkedSet, onRefresh]
  );

  /* ---- Add theme ---- */
  const handleAddTheme = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!themeLabel.trim()) return;
      setSubmittingTheme(true);
      setThemeError(null);
      try {
        const res = await fetch(
          `/api/goblinday/sessions/${sessionId}/themes`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label: themeLabel.trim() }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          setThemeLabel("");
          setShowThemeForm(false);
          setNewThemeId(data.id);
          onRefresh();
        } else {
          const body = await res.json().catch(() => null);
          setThemeError(body?.error ?? "Failed to add theme");
        }
      } finally {
        setSubmittingTheme(false);
      }
    },
    [sessionId, themeLabel, onRefresh]
  );

  /* ---- Cancel theme (long-press on mobile, click X on desktop) ---- */
  const handleCancelTheme = useCallback(
    async (themeId: number) => {
      setCancelingThemeId(themeId);
      try {
        const res = await fetch(
          `/api/goblinday/sessions/${sessionId}/themes/${themeId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "canceled" }),
          }
        );
        if (res.ok) onRefresh();
      } finally {
        setCancelingThemeId(null);
      }
    },
    [sessionId, onRefresh]
  );

  const startLongPress = useCallback(
    (themeId: number) => {
      longPressTimer.current = setTimeout(() => {
        if (confirm("Cancel this theme?")) {
          handleCancelTheme(themeId);
        }
      }, 600);
    },
    [handleCancelTheme]
  );

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  /* ---- Skull for checked state ---- */
  const SKULL = "\u{1F480}";

  /* ---- Render ---- */

  // Empty state: movies exist but no themes
  if (activeThemes.length === 0 && sortedMovies.length > 0) {
    return (
      <section>
        <h2 className="text-red-600 text-xs font-bold tracking-[0.2em] uppercase mb-3 border-b border-zinc-800 pb-2">
          THEME TRACKER
        </h2>
        {/* Show movie column headers as preview */}
        <div className="flex gap-3 mb-4 overflow-x-auto pb-1">
          {sortedMovies.map((movie) => (
            <div key={movie.id} className="flex-shrink-0 w-20 text-center">
              <div className="w-14 h-20 mx-auto bg-zinc-900 border border-zinc-800 overflow-hidden relative mb-1.5 shadow-[0_0_8px_rgba(0,0,0,0.5)]">
                {movie.poster_path ? (
                  <SmartImage
                    src={`${TMDB_IMAGE_BASE}${movie.poster_path}`}
                    alt={movie.title}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs font-bold">?</div>
                )}
              </div>
              <span className="text-zinc-500 text-2xs font-bold tracking-wider uppercase block leading-tight">
                {movie.title}
              </span>
            </div>
          ))}
        </div>
        <p className="text-zinc-700 text-xs tracking-[0.2em] uppercase py-3 text-center mb-3">
          // ADD A THEME TO START TRACKING
        </p>
        <ThemeForm
          showForm={showThemeForm}
          setShowForm={setShowThemeForm}
          themeLabel={themeLabel}
          setThemeLabel={setThemeLabel}
          submitting={submittingTheme}
          error={themeError}
          onSubmit={handleAddTheme}
          onCancel={() => {
            setShowThemeForm(false);
            setThemeLabel("");
            setThemeError(null);
          }}
        />
      </section>
    );
  }

  // Empty state: no movies at all
  if (sortedMovies.length === 0) {
    return (
      <section>
        <h2 className="text-red-600 text-xs font-bold tracking-[0.2em] uppercase mb-3 border-b border-zinc-800 pb-2">
          THEME TRACKER
        </h2>
        {activeThemes.length > 0 && (
          <div className="space-y-1 mb-3">
            {activeThemes.map((theme) => (
              <div key={theme.id} className="text-zinc-500 text-xs tracking-[0.15em] uppercase px-3 py-2 border border-zinc-800">
                {theme.label}
              </div>
            ))}
          </div>
        )}
        <p className="text-zinc-700 text-xs tracking-[0.2em] uppercase py-3 text-center mb-3">
          // MOVIE COLUMNS APPEAR WHEN MOVIES ARE ADDED
        </p>
        <ThemeForm
          showForm={showThemeForm}
          setShowForm={setShowThemeForm}
          themeLabel={themeLabel}
          setThemeLabel={setThemeLabel}
          submitting={submittingTheme}
          error={themeError}
          onSubmit={handleAddTheme}
          onCancel={() => {
            setShowThemeForm(false);
            setThemeLabel("");
            setThemeError(null);
          }}
        />
      </section>
    );
  }

  // Full matrix
  return (
    <section>
      <h2 className="text-red-600 text-xs font-bold tracking-[0.2em] uppercase mb-3 border-b border-zinc-800 pb-2">
        THEME TRACKER
      </h2>

      <div className="overflow-x-auto -mx-3 px-3">
        <table className="border-collapse w-max min-w-full">
          <thead>
            <tr>
              {/* Empty corner cell */}
              <th
                className="sticky left-0 z-10 bg-zinc-950 min-w-[90px] sm:min-w-[120px] max-w-[120px]"
                aria-label="Themes"
              />
              {sortedMovies.map((movie) => (
                <th
                  key={movie.id}
                  className="px-1.5 pb-2 text-center align-bottom"
                  style={{ minWidth: 90, maxWidth: 110 }}
                >
                  <div className="w-14 h-20 sm:w-16 sm:h-24 mx-auto bg-zinc-900 border border-zinc-800 overflow-hidden relative mb-1.5 shadow-[0_0_8px_rgba(0,0,0,0.5)]">
                    {movie.poster_path ? (
                      <SmartImage
                        src={`${TMDB_IMAGE_BASE}${movie.poster_path}`}
                        alt={movie.title}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs font-bold">
                        ?
                      </div>
                    )}
                  </div>
                  <span className="text-zinc-400 text-2xs font-bold tracking-wider uppercase block leading-tight max-w-[100px] mx-auto">
                    {movie.title}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeThemes.map((theme) => (
              <tr
                key={theme.id}
                ref={theme.id === newThemeId ? newRowRef : undefined}
                className={
                  theme.id === newThemeId
                    ? "animate-pulse-once"
                    : ""
                }
              >
                {/* Theme label — sticky left */}
                <td
                  className="sticky left-0 z-10 bg-zinc-950 min-w-[90px] sm:min-w-[120px] max-w-[120px] pr-2 py-0.5 align-middle"
                  onTouchStart={() => startLongPress(theme.id)}
                  onTouchEnd={cancelLongPress}
                  onTouchCancel={cancelLongPress}
                >
                  <div className="group flex items-center gap-1 min-h-[48px]">
                    <span
                      className="text-red-400 text-xs sm:text-xs font-bold tracking-[0.1em] uppercase leading-tight flex-1 select-none break-words"
                      title={theme.label}
                    >
                      {theme.label}
                    </span>
                    {/* Desktop-only cancel X (hidden on touch) */}
                    <button
                      onClick={() => {
                        if (confirm("Cancel this theme?")) handleCancelTheme(theme.id);
                      }}
                      disabled={cancelingThemeId === theme.id}
                      className="hidden sm:block opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-500 text-xs font-bold transition-opacity disabled:opacity-40 flex-shrink-0"
                      title="Cancel theme"
                    >
                      ✕
                    </button>
                  </div>
                </td>
                {/* Matrix cells */}
                {sortedMovies.map((movie) => {
                  const checked = isChecked(theme.id, movie.id);
                  return (
                    <td key={movie.id} className="px-1 py-0.5 text-center">
                      <button
                        onClick={() => handleToggle(theme.id, movie.id)}
                        className={`w-full min-h-[48px] border-2 transition-all active:scale-95 ${
                          checked
                            ? "bg-red-950 border-red-700 shadow-[0_0_12px_rgba(185,28,28,0.3)]"
                            : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900"
                        }`}
                        aria-label={`${theme.label} in ${movie.title}: ${checked ? "checked" : "unchecked"}`}
                      >
                        {checked ? (
                          <span className="text-xl leading-none" role="img" aria-label="skull">{SKULL}</span>
                        ) : (
                          <span className="text-zinc-800 text-xs">&#x2022;</span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add theme */}
      <div className="mt-3">
        <ThemeForm
          showForm={showThemeForm}
          setShowForm={setShowThemeForm}
          themeLabel={themeLabel}
          setThemeLabel={setThemeLabel}
          submitting={submittingTheme}
          error={themeError}
          onSubmit={handleAddTheme}
          onCancel={() => {
            setShowThemeForm(false);
            setThemeLabel("");
            setThemeError(null);
          }}
        />
      </div>
    </section>
  );
}

/* ---- Theme creation form (shared between empty states and matrix) ---- */

function ThemeForm({
  showForm,
  setShowForm,
  themeLabel,
  setThemeLabel,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  themeLabel: string;
  setThemeLabel: (v: string) => void;
  submitting: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="px-4 py-3 sm:py-2 border-2 border-dashed border-zinc-700 hover:border-red-800 text-zinc-600 hover:text-red-400 text-xs font-bold tracking-[0.2em] uppercase transition-colors w-full min-h-[44px]"
      >
        + ADD THEME
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border-2 border-zinc-800 bg-black p-4 space-y-3"
    >
      <div>
        <label className="text-zinc-600 text-2xs tracking-[0.2em] uppercase block mb-1">
          THEME LABEL
        </label>
        <input
          type="text"
          value={themeLabel}
          onChange={(e) => setThemeLabel(e.target.value)}
          placeholder="E.G. FINAL GIRL, BODY HORROR..."
          className="w-full px-3 py-2 bg-zinc-900 border-2 border-zinc-700 text-white text-xs font-mono tracking-wider uppercase placeholder:text-zinc-700 focus:outline-none focus:border-red-700 transition-colors"
        />
      </div>

      {error && (
        <p className="text-red-400 text-xs tracking-wider uppercase">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!themeLabel.trim() || submitting}
          className="flex-1 px-4 py-2 bg-red-900 hover:bg-red-800 text-red-100 font-black text-xs tracking-[0.15em] uppercase border-2 border-red-700 transition-colors disabled:opacity-40"
        >
          {submitting ? "ADDING..." : "ADD THEME"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-zinc-900 text-zinc-500 text-xs tracking-[0.15em] uppercase border-2 border-zinc-700 hover:border-zinc-600 transition-colors"
        >
          CANCEL
        </button>
      </div>
    </form>
  );
}
