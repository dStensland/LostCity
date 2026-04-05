# Goblin Day Theme Tracking Matrix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat theme tag list in the live goblin session view with an interactive themes × movies matrix where any member can check off intersections.

**Architecture:** One migration (repurpose `goblin_theme_movies`, extend timeline constraint), one new API route (toggle), modifications to the GET session endpoint and POST themes endpoint, and a new `ThemeMatrix` component replacing the themes section in `GoblinSessionView`. 15-second polling for live sync.

**Tech Stack:** Next.js API routes, Supabase/Postgres, React, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-05-goblin-theme-bingo-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/20260405000002_goblin_theme_matrix.sql` | Schema changes |
| Create | `web/app/api/goblinday/sessions/[id]/themes/[themeId]/toggle/route.ts` | Toggle endpoint |
| Modify | `web/app/api/goblinday/sessions/[id]/themes/route.ts` | Remove movie_ids from POST |
| Modify | `web/app/api/goblinday/sessions/[id]/route.ts:45-68` | Extend theme select, add checked_by to profile resolution |
| Create | `web/components/goblin/GoblinThemeMatrix.tsx` | Matrix UI component |
| Modify | `web/components/goblin/GoblinSessionView.tsx` | Replace themes section with matrix, update timeline renderer, remove old theme state |
| Modify | `web/components/goblin/GoblinDayPage.tsx:216-221` | Add 15-second polling for live sessions |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260405000002_goblin_theme_matrix.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Theme tracking matrix: repurpose goblin_theme_movies for live check-offs
-- and extend timeline event types.

-- 1. Clear old rows (from broken pre-tagging flow, no real data)
TRUNCATE goblin_theme_movies;

-- 2. Add check-off metadata
ALTER TABLE goblin_theme_movies
  ADD COLUMN IF NOT EXISTS checked_by uuid NOT NULL REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS checked_at timestamptz NOT NULL DEFAULT now();

-- 3. Extend timeline event types
ALTER TABLE goblin_timeline
  DROP CONSTRAINT goblin_timeline_event_type_check;

ALTER TABLE goblin_timeline
  ADD CONSTRAINT goblin_timeline_event_type_check
    CHECK (event_type IN (
      'movie_started', 'movie_finished',
      'theme_added', 'theme_canceled',
      'theme_checked', 'theme_unchecked'
    ));
```

- [ ] **Step 2: Push migration**

Run: `echo "Y" | npx supabase db push`

Expected: All migrations applied successfully.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260405000002_goblin_theme_matrix.sql
git commit -m "feat: add checked_by/checked_at to goblin_theme_movies, extend timeline events"
```

---

### Task 2: Toggle API Endpoint

**Files:**
- Create: `web/app/api/goblinday/sessions/[id]/themes/[themeId]/toggle/route.ts`

- [ ] **Step 1: Create the toggle route**

```typescript
import { NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";
import { isSessionMember } from "@/lib/goblin-utils";

export const dynamic = "force-dynamic";

// POST /api/goblinday/sessions/[id]/themes/[themeId]/toggle
// Member-only: toggles a theme-movie check-off
export const POST = withAuthAndParams<{ id: string; themeId: string }>(
  async (request, { user, serviceClient, params }) => {
    const sessionId = parseInt(params.id);
    const themeId = parseInt(params.themeId);

    // Verify membership
    const isMember = await isSessionMember(serviceClient, sessionId, user.id);
    if (!isMember) {
      return NextResponse.json({ error: "Not a member of this session" }, { status: 403 });
    }

    // Verify theme belongs to this session
    const { data: theme } = await serviceClient
      .from("goblin_themes")
      .select("id")
      .eq("id", themeId)
      .eq("session_id", sessionId)
      .single();

    if (!theme) {
      return NextResponse.json({ error: "Theme not found in this session" }, { status: 404 });
    }

    const body = await request.json();
    const movieId = body.movie_id;
    if (typeof movieId !== "number") {
      return NextResponse.json({ error: "movie_id required" }, { status: 400 });
    }

    // Race-safe toggle: try insert, if conflict then delete
    const { data: inserted, error: insertError } = await serviceClient
      .from("goblin_theme_movies")
      .insert({
        theme_id: themeId,
        movie_id: movieId,
        checked_by: user.id,
      } as never)
      .select("theme_id")
      .maybeSingle();

    // If unique violation (conflict), row exists — delete it
    if (insertError && insertError.code === "23505") {
      await serviceClient
        .from("goblin_theme_movies")
        .delete()
        .eq("theme_id", themeId)
        .eq("movie_id", movieId);

      // Log uncheck
      await serviceClient
        .from("goblin_timeline")
        .insert({
          session_id: sessionId,
          event_type: "theme_unchecked",
          theme_id: themeId,
          movie_id: movieId,
          user_id: user.id,
        } as never);

      return NextResponse.json({ checked: false });
    }

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Insert succeeded — log check
    if (inserted) {
      await serviceClient
        .from("goblin_timeline")
        .insert({
          session_id: sessionId,
          event_type: "theme_checked",
          theme_id: themeId,
          movie_id: movieId,
          user_id: user.id,
        } as never);
    }

    return NextResponse.json({ checked: true });
  }
);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd web && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add web/app/api/goblinday/sessions/[id]/themes/[themeId]/toggle/route.ts
git commit -m "feat: add theme-movie toggle endpoint with race-safe insert"
```

---

### Task 3: Simplify POST Themes & Update GET Session

**Files:**
- Modify: `web/app/api/goblinday/sessions/[id]/themes/route.ts`
- Modify: `web/app/api/goblinday/sessions/[id]/route.ts`

- [ ] **Step 1: Remove movie_ids handling from POST themes**

In `web/app/api/goblinday/sessions/[id]/themes/route.ts`, remove lines 37–44 (the `movie_ids` block):

```typescript
    // DELETE this entire block:
    // Optionally link movies to the theme
    if (Array.isArray(body.movie_ids) && body.movie_ids.length > 0) {
      const rows = body.movie_ids.map((mid: number) => ({
        theme_id: t.id,
        movie_id: mid,
      }));
      await serviceClient.from("goblin_theme_movies").insert(rows as never);
    }
```

The route now just creates the theme label and logs the timeline event.

- [ ] **Step 2: Update GET session — extend theme select**

In `web/app/api/goblinday/sessions/[id]/route.ts`, change the themes query (line 47) from:

```
.select("id, label, status, created_at, canceled_at, goblin_theme_movies(movie_id)")
```

to:

```
.select("id, label, status, created_at, canceled_at, goblin_theme_movies(movie_id, checked_by, checked_at)")
```

- [ ] **Step 3: Update GET session — add checked_by to profile resolution**

In `web/app/api/goblinday/sessions/[id]/route.ts`, update the `allUserIds` collection (around line 65). Add `checked_by` UUIDs from theme_movies:

Change:

```typescript
    const allUserIds = [...new Set([
      ...(sessionMovies ?? []).map((sm: any) => sm.proposed_by).filter(Boolean),
      ...(timeline ?? []).map((t: any) => t.user_id).filter(Boolean),
      ...(members ?? []).map((m: any) => m.user_id),
    ])];
```

To:

```typescript
    // Collect checked_by UUIDs from theme_movies
    const themeCheckerIds = (themes ?? []).flatMap(
      (t: any) => ((t.goblin_theme_movies as any[]) ?? []).map((tm: any) => tm.checked_by)
    ).filter(Boolean);

    const allUserIds = [...new Set([
      ...(sessionMovies ?? []).map((sm: any) => sm.proposed_by).filter(Boolean),
      ...(timeline ?? []).map((t: any) => t.user_id).filter(Boolean),
      ...(members ?? []).map((m: any) => m.user_id),
      ...themeCheckerIds,
    ])];
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd web && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add web/app/api/goblinday/sessions/[id]/themes/route.ts web/app/api/goblinday/sessions/[id]/route.ts
git commit -m "feat: simplify POST themes, add checked_by to GET session profile resolution"
```

---

### Task 4: ThemeMatrix Component

**Files:**
- Create: `web/components/goblin/GoblinThemeMatrix.tsx`

- [ ] **Step 1: Create the component**

```tsx
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

  // Scroll new row into view
  useEffect(() => {
    if (newThemeId && newRowRef.current) {
      newRowRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setNewThemeId(null);
    }
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
    title.length > max ? title.slice(0, max - 1).trimEnd() + "…" : title;

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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd web && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/goblin/GoblinThemeMatrix.tsx
git commit -m "feat: add GoblinThemeMatrix component with optimistic toggle and long-press cancel"
```

---

### Task 5: Wire Matrix into GoblinSessionView

**Files:**
- Modify: `web/components/goblin/GoblinSessionView.tsx`

This task replaces the old themes section with the new matrix, updates the `SessionTheme` interface, adds new timeline event rendering, and removes dead state/code.

- [ ] **Step 1: Update the SessionTheme interface**

In `web/components/goblin/GoblinSessionView.tsx`, change the `SessionTheme` interface (around line 19):

From:

```typescript
interface SessionTheme {
  id: number;
  label: string;
  status: string;
  goblin_theme_movies: Array<{ movie_id: number }>;
}
```

To:

```typescript
interface SessionTheme {
  id: number;
  label: string;
  status: string;
  goblin_theme_movies: Array<{ movie_id: number; checked_by: string; checked_at: string }>;
}
```

- [ ] **Step 2: Remove old theme state and handlers**

Remove these state declarations and handlers from the component (they're replaced by the matrix component's internal state):

- `cancelingThemeId` / `setCancelingThemeId` state
- `themeLabel` / `setThemeLabel` state
- `themeMovieIds` / `setThemeMovieIds` state
- `submittingTheme` / `setSubmittingTheme` state
- `showThemeForm` / `setShowThemeForm` state
- `themeError` / `setThemeError` state
- `handleCancelTheme` callback
- `handleAddTheme` callback
- `toggleThemeMovie` callback
- `activeThemes` memo
- `canceledThemes` memo

- [ ] **Step 3: Add GoblinThemeMatrix import and replace themes section**

Add at top of file:

```typescript
import GoblinThemeMatrix from "./GoblinThemeMatrix";
```

Replace the entire `{/* ---- THEMES SECTION ---- */}` block (the `<section>` containing active themes, canceled themes, the add theme toggle, and the theme creation form — roughly lines 476–593) with:

```tsx
        {/* ---- THEME TRACKER ---- */}
        <GoblinThemeMatrix
          sessionId={session.id}
          movies={sortedMovies}
          themes={session.themes}
          onRefresh={onRefresh}
        />
```

- [ ] **Step 4: Update timeline renderer with new event types**

In the `renderTimelineEntry` function, add two new cases before the `default`:

```typescript
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
```

Note the `text-zinc-600` wrapper on both — quieter than the `text-zinc-400` default for milestone events.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd web && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add web/components/goblin/GoblinSessionView.tsx
git commit -m "feat: replace theme tag list with ThemeMatrix, add check/uncheck timeline events"
```

---

### Task 6: Add Pulse Animation CSS

**Files:**
- Modify: `web/app/globals.css`

- [ ] **Step 1: Add the one-shot pulse animation**

Add to `web/app/globals.css` (in the utilities/animations area):

```css
@keyframes pulse-once {
  0% { background-color: transparent; }
  30% { background-color: rgba(127, 29, 29, 0.4); }
  100% { background-color: transparent; }
}

.animate-pulse-once {
  animation: pulse-once 1s ease-out 1;
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/globals.css
git commit -m "feat: add one-shot pulse animation for new theme row highlight"
```

---

### Task 7: Add 15-Second Polling for Live Sessions

**Files:**
- Modify: `web/components/goblin/GoblinDayPage.tsx`

- [ ] **Step 1: Add polling useEffect**

In `GoblinDayPage`, find the `useEffect` that loads session data when the tab is active (around line 216):

```typescript
  useEffect(() => {
    if (activeTab === "next") {
      if (activeSession) fetchSession(activeSession.id);
      else fetchSessionsList();
    }
  }, [activeTab, activeSession, fetchSession, fetchSessionsList]);
```

Add a new `useEffect` directly after it for polling:

```typescript
  // Poll live sessions every 15 seconds for shared matrix sync
  useEffect(() => {
    if (activeTab !== "next" || !activeSession || activeSession.status !== "live") return;

    const interval = setInterval(() => {
      fetchSession(activeSession.id);
    }, 15_000);

    return () => clearInterval(interval);
  }, [activeTab, activeSession, fetchSession]);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd web && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/goblin/GoblinDayPage.tsx
git commit -m "feat: add 15-second polling for live goblin day sessions"
```

---

### Task 8: Browser Test

**Files:** None (manual verification)

- [ ] **Step 1: Start dev server**

Run: `cd web && npm run dev`

- [ ] **Step 2: Verify the matrix renders**

Navigate to a live goblin day session. Confirm:
- The old theme tag strip is gone
- The "THEME TRACKER" header appears
- If themes exist, the matrix grid renders with movie columns and theme rows
- Movie poster thumbnails and truncated titles show in column headers
- Cells are tappable and toggle between empty/red states

- [ ] **Step 3: Verify toggle round-trip**

Tap a cell → confirm it fills red with ✕ → refresh the page → confirm the cell is still checked. Tap it again → confirm it unchecks.

- [ ] **Step 4: Verify theme creation**

Click "+ ADD THEME" → enter a label → submit. Confirm:
- New row appears in matrix
- Row briefly pulses red
- Timeline shows the "ADDED THEME" entry

- [ ] **Step 5: Verify timeline events**

Check/uncheck a cell. Scroll to timeline. Confirm:
- "SPOTTED {THEME} IN {MOVIE}" appears for checks
- "REMOVED {THEME} FROM {MOVIE}" appears for unchecks
- These entries are visually quieter than movie/session events

- [ ] **Step 6: Verify mobile layout at 375px**

Open browser DevTools → set viewport to 375px width. Confirm:
- Theme labels pin to the left during horizontal scroll
- Cells are at least 44px tall (comfortable tap targets)
- Matrix scrolls horizontally when movies exceed viewport
- Labels have opaque background (no bleed-through)

- [ ] **Step 7: Verify empty states**

Test with: (a) movies but no themes → should show movie column preview + "ADD A THEME" hint. (b) themes but no movies → should show theme labels + "MOVIE COLUMNS APPEAR" hint.

- [ ] **Step 8: Run TypeScript check one final time**

Run: `cd web && npx tsc --noEmit`

Expected: No errors.
