"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import SmartImage from "@/components/SmartImage";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w200";
const MAX_THEME_LENGTH = 24;

/* Quick-add theme suggestions */
const THEME_SUGGESTIONS = [
  "FINAL GIRL",
  "BODY HORROR",
  "JUMP SCARE",
  "DUMB DEATH",
  "THE PHONE IS DEAD",
  "CREEPY KID",
  "DON'T GO IN THERE",
  "FALSE ENDING",
  "BLOOD SPLATTER",
  "SLOW BURN",
  "POSSESSION",
  "FOUND FOOTAGE",
  "DARK BASEMENT",
  "TWIST VILLAIN",
];

/* ------------------------------------------------------------------ */
/*  Skull image component — realistic skull with CSS effects           */
/*  Checked: red-tinted skull with glow                                */
/*  Bingo: skull engulfed in flickering fire (CSS animation)           */
/* ------------------------------------------------------------------ */

function SkullIcon({ variant, size = 24 }: { variant: "checked" | "bingo"; size?: number }) {
  return (
    <span
      className={`inline-block ${variant === "bingo" ? "skull-on-fire" : "skull-checked"}`}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/goblin-day/icons/skull-checked.png"
        alt="skull"
        width={size}
        height={size}
        className="object-contain w-full h-full"
      />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

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
  const [optimisticToggles, setOptimisticToggles] = useState<Map<string, boolean>>(new Map());
  const inFlightKeys = useRef<Set<string>>(new Set());
  const [serverRevision, setServerRevision] = useState(0);
  const prevThemesRef = useRef<string>("");
  const [confirmingCancelId, setConfirmingCancelId] = useState<number | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Bingo detection: all real movies + wildcard checked for a theme
  const isRowComplete = useCallback(
    (themeId: number) => {
      if (sortedMovies.length === 0) return false;
      return sortedMovies.every((m) => isChecked(themeId, m.id));
    },
    [sortedMovies, isChecked]
  );

  // Per-movie trophy count
  const movieTrophyCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const movie of sortedMovies) {
      let count = 0;
      for (const theme of activeThemes) {
        if (isChecked(theme.id, movie.id)) count++;
      }
      counts.set(movie.id, count);
    }
    return counts;
  }, [sortedMovies, activeThemes, isChecked]);

  // Only bump revision when themes content actually changes
  useEffect(() => {
    const sig = JSON.stringify(
      themes.map((t) => [t.id, t.status, t.goblin_theme_movies.map((m) => m.movie_id).sort()])
    );
    if (sig !== prevThemesRef.current) {
      prevThemesRef.current = sig;
      setServerRevision((r) => r + 1);
    }
  }, [themes]);

  // Reconcile optimistic state when server data changes
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

  // Scroll new row into view
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
      inFlightKeys.current.add(key);

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
          onRefresh();
          setTimeout(() => { inFlightKeys.current.delete(key); }, 2000);
        } else {
          inFlightKeys.current.delete(key);
          setOptimisticToggles((prev) => { const next = new Map(prev); next.delete(key); return next; });
        }
      } catch {
        inFlightKeys.current.delete(key);
        setOptimisticToggles((prev) => { const next = new Map(prev); next.delete(key); return next; });
      }
    },
    [sessionId, checkedSet, onRefresh]
  );

  /* ---- Add theme ---- */
  const handleAddTheme = useCallback(
    async (label?: string) => {
      const finalLabel = (label ?? themeLabel).trim();
      if (!finalLabel) return;
      setSubmittingTheme(true);
      setThemeError(null);
      try {
        const res = await fetch(
          `/api/goblinday/sessions/${sessionId}/themes`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label: finalLabel }),
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

  const handleFormSubmit = useCallback(
    (e: React.FormEvent) => { e.preventDefault(); handleAddTheme(); },
    [handleAddTheme]
  );

  /* ---- Cancel theme — inline confirm ---- */
  const handleCancelTheme = useCallback(
    async (themeId: number) => {
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
        setConfirmingCancelId(null);
      }
    },
    [sessionId, onRefresh]
  );

  const initiateCancel = useCallback((themeId: number) => {
    setConfirmingCancelId(themeId);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => setConfirmingCancelId(null), 3000);
  }, []);

  const confirmCancel = useCallback((themeId: number) => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    handleCancelTheme(themeId);
  }, [handleCancelTheme]);

  /* ---- Already-used labels for filtering suggestions ---- */
  const usedLabels = useMemo(
    () => new Set(themes.map((t) => t.label.toUpperCase())),
    [themes]
  );
  const availableSuggestions = useMemo(
    () => THEME_SUGGESTIONS.filter((s) => !usedLabels.has(s)),
    [usedLabels]
  );

  /* ---- Render helpers ---- */

  const sectionHeader = (
    <div className="flex items-center justify-between mb-3 border-b border-zinc-800 pb-2">
      <h2 className="text-red-600 text-xs font-bold tracking-[0.2em] uppercase">
        THEME TRACKER
      </h2>
      {!showThemeForm && (
        <button
          onClick={() => setShowThemeForm(true)}
          className="text-zinc-600 hover:text-red-400 text-xs font-bold tracking-[0.15em] uppercase transition-colors"
        >
          + ADD
        </button>
      )}
    </div>
  );

  /* ---- Render a single matrix cell ---- */
  const renderCell = (themeId: number, movieId: number, complete: boolean) => {
    const checked = isChecked(themeId, movieId);
    return (
      <td key={movieId} className="px-1 py-0.5 text-center">
        <button
          onClick={() => handleToggle(themeId, movieId)}
          className={`w-full min-h-[48px] border-2 transition-all active:scale-95 ${
            checked
              ? complete
                ? "bg-orange-950/30 border-orange-600/50 shadow-[0_0_16px_rgba(255,120,0,0.25)]"
                : "bg-red-950/80 border-red-700/80 shadow-[0_0_10px_rgba(185,28,28,0.25)]"
              : "bg-zinc-900/40 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/60"
          }`}
          aria-label={`${checked ? "checked" : "unchecked"}`}
        >
          {checked ? (
            <span className="flex items-center justify-center">
              <SkullIcon variant={complete ? "bingo" : "checked"} size={22} />
            </span>
          ) : (
            <span className="text-sm text-zinc-600">&#x25CB;</span>
          )}
        </button>
      </td>
    );
  };

  // Empty state: movies exist but no themes
  if (activeThemes.length === 0 && sortedMovies.length > 0) {
    return (
      <section>
        {sectionHeader}
        <p className="text-zinc-600 text-xs tracking-[0.15em] uppercase py-4 text-center mb-2">
          // ADD A THEME TO START TRACKING
        </p>
        <ThemeForm
          showForm={true}
          setShowForm={setShowThemeForm}
          themeLabel={themeLabel}
          setThemeLabel={setThemeLabel}
          submitting={submittingTheme}
          error={themeError}
          onSubmit={handleFormSubmit}
          onCancel={() => { setShowThemeForm(false); setThemeLabel(""); setThemeError(null); }}
          suggestions={availableSuggestions}
          onSuggestionTap={handleAddTheme}
        />
      </section>
    );
  }

  // Empty state: no movies at all
  if (sortedMovies.length === 0) {
    return (
      <section>
        {sectionHeader}
        {activeThemes.length > 0 && (
          <div className="space-y-1 mb-3">
            {activeThemes.map((theme) => (
              <div key={theme.id} className="text-zinc-500 text-xs tracking-[0.15em] uppercase px-3 py-2 border border-zinc-800">
                {theme.label}
              </div>
            ))}
          </div>
        )}
        <p className="text-zinc-600 text-xs tracking-[0.15em] uppercase py-3 text-center mb-3">
          // MOVIE COLUMNS APPEAR WHEN MOVIES ARE ADDED
        </p>
        <ThemeForm
          showForm={showThemeForm}
          setShowForm={setShowThemeForm}
          themeLabel={themeLabel}
          setThemeLabel={setThemeLabel}
          submitting={submittingTheme}
          error={themeError}
          onSubmit={handleFormSubmit}
          onCancel={() => { setShowThemeForm(false); setThemeLabel(""); setThemeError(null); }}
          suggestions={availableSuggestions}
          onSuggestionTap={handleAddTheme}
        />
      </section>
    );
  }

  // Full matrix
  return (
    <section>
      {sectionHeader}

      <div className="overflow-x-auto -mx-3 px-3 pb-1">
        <table className="border-collapse w-max min-w-full">
            <thead>
              <tr>
                {/* Corner cell */}
                <th
                  className="sticky left-0 z-10 bg-zinc-950 min-w-[110px] sm:min-w-[140px] max-w-[140px]"
                  aria-label="Themes"
                />
                {sortedMovies.map((movie) => {
                  const trophyCount = movieTrophyCounts.get(movie.id) ?? 0;
                  return (
                    <th
                      key={movie.id}
                      className="px-1.5 pb-2 text-center align-bottom"
                      style={{ minWidth: 90, maxWidth: 110 }}
                    >
                      <div className="w-14 h-20 sm:w-16 sm:h-24 mx-auto bg-zinc-900 border border-zinc-800 overflow-hidden relative mb-1.5 shadow-[0_0_10px_rgba(0,0,0,0.6)]">
                        {movie.poster_path ? (
                          <SmartImage
                            src={`${TMDB_IMAGE_BASE}${movie.poster_path}`}
                            alt={movie.title}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs font-bold">?</div>
                        )}
                      </div>
                      <span className="text-zinc-400 text-2xs font-bold tracking-wider uppercase block leading-tight max-w-[100px] mx-auto line-clamp-2">
                        {movie.title}
                      </span>
                      {trophyCount > 0 && (
                        <span className="text-2xs mt-1 block">
                          <span className="text-red-500 font-bold">{trophyCount}</span>
                          <span className="ml-0.5 inline-block w-3"><SkullIcon variant="checked" size={12} /></span>
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {activeThemes.map((theme) => {
                const complete = isRowComplete(theme.id);
                const confirming = confirmingCancelId === theme.id;
                return (
                  <tr
                    key={theme.id}
                    ref={theme.id === newThemeId ? newRowRef : undefined}
                    className={[
                      theme.id === newThemeId ? "animate-pulse-once" : "",
                      complete ? "animate-bingo-glow" : "",
                    ].filter(Boolean).join(" ")}
                  >
                    {/* Theme label — sticky left */}
                    <td
                      className={`sticky left-0 z-10 min-w-[110px] sm:min-w-[140px] max-w-[140px] pr-2 py-0.5 align-middle transition-colors ${
                        complete ? "bg-zinc-950/90" : "bg-zinc-950"
                      }`}
                    >
                      <div className="group flex items-center gap-1 min-h-[48px]">
                        <span
                          className={`text-xs font-bold tracking-[0.1em] uppercase leading-tight flex-1 select-none line-clamp-2 transition-colors ${
                            complete ? "text-amber-400" : "text-red-400"
                          }`}
                          title={theme.label}
                        >
                          {complete && <SkullIcon variant="bingo" size={14} />}
                          {" "}{theme.label}
                        </span>
                        <button
                          onClick={() => confirming ? confirmCancel(theme.id) : initiateCancel(theme.id)}
                          className={`flex-shrink-0 text-xs font-bold transition-all ${
                            confirming
                              ? "text-red-500 opacity-100"
                              : "text-zinc-700 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 hover:text-red-500"
                          }`}
                          title={confirming ? "Tap again to remove" : "Remove theme"}
                        >
                          {confirming ? "RM?" : "✕"}
                        </button>
                      </div>
                    </td>
                    {/* Matrix cells */}
                    {sortedMovies.map((movie) => renderCell(theme.id, movie.id, complete))}
                  </tr>
                );
              })}
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
          onSubmit={handleFormSubmit}
          onCancel={() => { setShowThemeForm(false); setThemeLabel(""); setThemeError(null); }}
          suggestions={availableSuggestions}
          onSuggestionTap={handleAddTheme}
        />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Theme creation form                                                */
/* ------------------------------------------------------------------ */

function ThemeForm({
  showForm,
  setShowForm,
  themeLabel,
  setThemeLabel,
  submitting,
  error,
  onSubmit,
  onCancel,
  suggestions,
  onSuggestionTap,
}: {
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  themeLabel: string;
  setThemeLabel: (v: string) => void;
  submitting: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  suggestions: string[];
  onSuggestionTap: (label: string) => void;
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
    <div className="border-2 border-zinc-800 bg-black p-4 space-y-3">
      {/* Quick-add suggestions */}
      {suggestions.length > 0 && (
        <div>
          <label className="text-zinc-600 text-2xs tracking-[0.2em] uppercase block mb-2">
            QUICK ADD
          </label>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.slice(0, 8).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSuggestionTap(s)}
                disabled={submitting}
                className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 hover:border-red-800 hover:bg-red-950/30 text-zinc-400 hover:text-red-300 text-2xs font-bold tracking-[0.1em] uppercase transition-colors disabled:opacity-40 min-h-[32px]"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Custom input */}
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-zinc-600 text-2xs tracking-[0.2em] uppercase">
              CUSTOM THEME
            </label>
            <span className={`text-2xs tracking-wider ${
              themeLabel.length > MAX_THEME_LENGTH ? "text-red-500" : "text-zinc-700"
            }`}>
              {themeLabel.length}/{MAX_THEME_LENGTH}
            </span>
          </div>
          <input
            type="text"
            value={themeLabel}
            onChange={(e) => setThemeLabel(e.target.value.slice(0, MAX_THEME_LENGTH))}
            placeholder="E.G. DUMB DEATH, THE CAR WON'T START..."
            className="w-full px-3 py-2 bg-zinc-900 border-2 border-zinc-700 text-white text-xs font-mono tracking-wider uppercase placeholder:text-zinc-700 focus:outline-none focus:border-red-700 transition-colors"
            maxLength={MAX_THEME_LENGTH}
          />
        </div>

        {error && (
          <p className="text-red-400 text-xs tracking-wider uppercase">{error}</p>
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
    </div>
  );
}
