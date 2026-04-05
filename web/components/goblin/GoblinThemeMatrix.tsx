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

  // Clear optimistic state when real data arrives
  useEffect(() => {
    setOptimisticToggles(new Map());
  }, [themes]);

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
      const currentState = isChecked(themeId, movieId);

      // Optimistic update
      setOptimisticToggles((prev) => {
        const next = new Map(prev);
        next.set(key, !currentState);
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
        if (!res.ok) {
          // Rollback
          setOptimisticToggles((prev) => {
            const next = new Map(prev);
            next.delete(key);
            return next;
          });
        }
      } catch {
        // Rollback on network error
        setOptimisticToggles((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [sessionId, isChecked]
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

  /* ---- Truncate title for column header ---- */
  const truncTitle = (title: string, max = 9) =>
    title.length > max ? title.slice(0, max - 1).trimEnd() + "\u2026" : title;

  /* ---- Render ---- */

  // Empty state: movies exist but no themes
  if (activeThemes.length === 0 && sortedMovies.length > 0) {
    return (
      <section>
        <h2 className="text-red-600 text-xs font-bold tracking-[0.2em] uppercase mb-3 border-b border-zinc-800 pb-2">
          THEME TRACKER
        </h2>
        {/* Show movie column headers as preview */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {sortedMovies.map((movie) => (
            <div key={movie.id} className="flex-shrink-0 w-16 text-center">
              <div className="w-8 h-12 mx-auto bg-zinc-900 overflow-hidden relative mb-1">
                {movie.poster_path ? (
                  <SmartImage
                    src={`${TMDB_IMAGE_BASE}${movie.poster_path}`}
                    alt={movie.title}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-700 text-2xs">?</div>
                )}
              </div>
              <span className="text-zinc-700 text-2xs tracking-wider uppercase block truncate">
                {truncTitle(movie.title)}
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
                className="sticky left-0 z-10 bg-zinc-950 min-w-[100px] max-w-[100px]"
                aria-label="Themes"
              />
              {sortedMovies.map((movie) => (
                <th
                  key={movie.id}
                  className="px-1 pb-2 text-center align-bottom"
                  style={{ minWidth: 70, maxWidth: 80 }}
                >
                  <div className="w-8 h-12 mx-auto bg-zinc-900 overflow-hidden relative mb-1">
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
                  <span className="text-zinc-500 text-2xs tracking-wider uppercase block truncate max-w-[70px] mx-auto">
                    {truncTitle(movie.title)}
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
                  className="sticky left-0 z-10 bg-zinc-950 min-w-[100px] max-w-[100px] pr-2 py-0.5 align-middle"
                  onTouchStart={() => startLongPress(theme.id)}
                  onTouchEnd={cancelLongPress}
                  onTouchCancel={cancelLongPress}
                >
                  <div className="group flex items-center gap-1 min-h-[44px]">
                    <span
                      className="text-red-400 text-2xs font-bold tracking-[0.15em] uppercase truncate flex-1 select-none"
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
                        className={`w-full min-h-[44px] border transition-colors ${
                          checked
                            ? "bg-red-900/60 border-red-800 text-white"
                            : "bg-zinc-900 border-zinc-800 text-transparent hover:border-zinc-700"
                        }`}
                        aria-label={`${theme.label} in ${movie.title}: ${checked ? "checked" : "unchecked"}`}
                      >
                        {checked && (
                          <span className="text-sm font-black">✕</span>
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
