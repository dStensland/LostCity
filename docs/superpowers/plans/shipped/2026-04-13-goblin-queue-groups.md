# Goblin Queue Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add curated movie groups (by director, genre, or custom) as collapsible sections in the Goblin Day queue, and migrate recommendations to use the same group treatment.

**Architecture:** Extend existing `goblin_lists` / `goblin_list_movies` tables with new columns (description, sort_order, is_recommendations). Extract shared `ensureMovie` utility. Add group-specific API routes for movie CRUD + TMDB person/filmography endpoints. Build `useGoblinGroups` hook and `GoblinGroupSection` component. Modify `GoblinWatchlistView` to render groups below the ranked queue. Modify recommendation accept action to target groups instead of watchlist entries.

**Tech Stack:** Next.js 16 App Router, Supabase (service client), TMDB API, React hooks, Tailwind v4

**Spec:** `docs/superpowers/specs/2026-04-13-goblin-queue-groups-design.md`

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260413100000_goblin_queue_groups.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Goblin Queue Groups — extend goblin_lists and goblin_list_movies
-- for curated movie groups in the watchlist queue

-- 1. goblin_lists — add description, sort_order, is_recommendations
ALTER TABLE goblin_lists
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS sort_order integer,
  ADD COLUMN IF NOT EXISTS is_recommendations boolean NOT NULL DEFAULT false;

-- 2. goblin_list_movies — add sort_order and note
ALTER TABLE goblin_list_movies
  ADD COLUMN IF NOT EXISTS sort_order integer,
  ADD COLUMN IF NOT EXISTS note text;

-- 3. Indexes for efficient ordering
CREATE INDEX IF NOT EXISTS idx_goblin_lists_user_sort
  ON goblin_lists (user_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_goblin_list_movies_list_sort
  ON goblin_list_movies (list_id, sort_order);

-- 4. Unique constraint: only one recommendations list per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_goblin_lists_user_recommendations
  ON goblin_lists (user_id) WHERE is_recommendations = true;
```

- [ ] **Step 2: Apply the migration locally**

Run: `npx supabase db push` (or apply via Supabase dashboard)
Expected: Migration applies cleanly, no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260413100000_goblin_queue_groups.sql
git commit -m "feat(goblin): migration for queue groups — extend goblin_lists with description, sort_order, is_recommendations"
```

---

### Task 2: Extract Shared `ensureMovie` Utility

**Files:**
- Create: `web/lib/goblin-movie-utils.ts`
- Modify: `web/app/api/goblinday/me/watchlist/route.ts` (remove inline `ensureMovie`, import shared one)
- Modify: `web/app/api/goblinday/me/log/route.ts` (remove inline `ensureMovie`, import shared one)
- Modify: `web/app/api/goblinday/queue/[slug]/recommend/route.ts` (remove inline `ensureMovie`, import shared one)

- [ ] **Step 1: Create shared utility**

```typescript
// web/lib/goblin-movie-utils.ts
const TMDB_BASE = "https://api.themoviedb.org/3";

/** Ensure a movie exists in goblin_movies by TMDB ID, fetching from TMDB if needed */
export async function ensureMovie(
  serviceClient: any,
  tmdbId: number
): Promise<{ id: number } | null> {
  // Check if already exists
  const { data: existing } = await serviceClient
    .from("goblin_movies")
    .select("id")
    .eq("tmdb_id", tmdbId)
    .maybeSingle();

  if (existing) return existing as { id: number };

  // Fetch from TMDB
  const tmdbKey = process.env.TMDB_API_KEY;
  if (!tmdbKey) return null;

  const url = `${TMDB_BASE}/movie/${tmdbId}?api_key=${tmdbKey}&append_to_response=credits`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;

    const m = await res.json();
    const director =
      m.credits?.crew?.find((c: any) => c.job === "Director")?.name || null;
    const releaseYear = m.release_date
      ? parseInt(m.release_date.split("-")[0])
      : null;

    const { data: inserted, error } = await serviceClient
      .from("goblin_movies")
      .insert({
        tmdb_id: tmdbId,
        title: m.title,
        release_date: m.release_date || null,
        poster_path: m.poster_path || null,
        backdrop_path: m.backdrop_path || null,
        year: releaseYear,
        synopsis: m.overview || null,
        genres: m.genres?.map((g: any) => g.name) || null,
        runtime_minutes: m.runtime || null,
        director,
        tmdb_vote_average: m.vote_average || null,
        tmdb_vote_count: m.vote_count || null,
        tmdb_popularity: m.popularity || null,
      } as never)
      .select("id")
      .single();

    if (error || !inserted) return null;
    return inserted as { id: number };
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}
```

- [ ] **Step 2: Update watchlist route to use shared utility**

In `web/app/api/goblinday/me/watchlist/route.ts`:
- Remove the entire `ensureMovie` function (lines ~52–110)
- Remove the `const TMDB_BASE` line
- Add import at top: `import { ensureMovie } from "@/lib/goblin-movie-utils";`

- [ ] **Step 3: Update log route to use shared utility**

In `web/app/api/goblinday/me/log/route.ts`:
- Remove the entire `ensureMovie` function and `TMDB_BASE` constant
- Add import: `import { ensureMovie } from "@/lib/goblin-movie-utils";`

- [ ] **Step 4: Update recommend route to use shared utility**

In `web/app/api/goblinday/queue/[slug]/recommend/route.ts`:
- Remove the entire `ensureMovie` function and `TMDB_BASE` constant
- Add import: `import { ensureMovie } from "@/lib/goblin-movie-utils";`

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: Clean compilation, no errors.

- [ ] **Step 6: Commit**

```bash
git add web/lib/goblin-movie-utils.ts web/app/api/goblinday/me/watchlist/route.ts web/app/api/goblinday/me/log/route.ts web/app/api/goblinday/queue/[slug]/recommend/route.ts
git commit -m "refactor(goblin): extract shared ensureMovie utility from 3 API routes"
```

---

### Task 3: Group Types and Hook

**Files:**
- Create: `web/lib/goblin-group-utils.ts`
- Create: `web/lib/hooks/useGoblinGroups.ts`

- [ ] **Step 1: Create type definitions**

```typescript
// web/lib/goblin-group-utils.ts

export interface GoblinGroupMovie {
  movie_id: number;
  sort_order: number | null;
  note: string | null;
  added_at: string;
  movie: {
    id: number;
    tmdb_id: number | null;
    title: string;
    poster_path: string | null;
    backdrop_path: string | null;
    release_date: string | null;
    genres: string[] | null;
    runtime_minutes: number | null;
    director: string | null;
    year: number | null;
    rt_critics_score: number | null;
    rt_audience_score: number | null;
    tmdb_vote_average: number | null;
    tmdb_vote_count: number | null;
    mpaa_rating: string | null;
    imdb_id: string | null;
    synopsis: string | null;
    trailer_url: string | null;
  };
}

export interface GoblinGroup {
  id: number;
  name: string;
  description: string | null;
  sort_order: number | null;
  is_recommendations: boolean;
  created_at: string;
  movies: GoblinGroupMovie[];
}

export interface TMDBPerson {
  id: number;
  name: string;
  known_for_department: string | null;
  profile_path: string | null;
}

export interface TMDBFilmographyMovie {
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  release_date: string | null;
  year: number | null;
  overview: string | null;
}
```

- [ ] **Step 2: Create the hook**

```typescript
// web/lib/hooks/useGoblinGroups.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  GoblinGroup,
  TMDBPerson,
  TMDBFilmographyMovie,
} from "@/lib/goblin-group-utils";

export function useGoblinGroups(isAuthenticated: boolean) {
  const [groups, setGroups] = useState<GoblinGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/goblinday/me/lists");
      if (!res.ok) return;
      const data = await res.json();
      setGroups(data.groups || []);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchGroups().finally(() => setLoading(false));
  }, [isAuthenticated, fetchGroups]);

  const createGroup = useCallback(
    async (data: {
      name: string;
      description?: string;
      movie_tmdb_ids?: number[];
    }): Promise<GoblinGroup | null> => {
      try {
        const res = await fetch("/api/goblinday/me/lists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) return null;
        await fetchGroups();
        const result = await res.json();
        return result.group || null;
      } catch {
        return null;
      }
    },
    [fetchGroups]
  );

  const updateGroup = useCallback(
    async (
      groupId: number,
      data: Partial<{ name: string; description: string }>
    ): Promise<boolean> => {
      try {
        const res = await fetch(`/api/goblinday/me/lists/${groupId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) return false;
        await fetchGroups();
        return true;
      } catch {
        return false;
      }
    },
    [fetchGroups]
  );

  const deleteGroup = useCallback(
    async (groupId: number): Promise<boolean> => {
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      try {
        const res = await fetch(`/api/goblinday/me/lists/${groupId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          await fetchGroups();
          return false;
        }
        return true;
      } catch {
        await fetchGroups();
        return false;
      }
    },
    [fetchGroups]
  );

  const addMovie = useCallback(
    async (
      groupId: number,
      tmdbId: number,
      note?: string
    ): Promise<boolean> => {
      try {
        const res = await fetch(
          `/api/goblinday/me/lists/${groupId}/movies`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tmdb_id: tmdbId, note }),
          }
        );
        if (!res.ok) return false;
        await fetchGroups();
        return true;
      } catch {
        return false;
      }
    },
    [fetchGroups]
  );

  const removeMovie = useCallback(
    async (groupId: number, movieId: number): Promise<boolean> => {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, movies: g.movies.filter((m) => m.movie_id !== movieId) }
            : g
        )
      );
      try {
        const res = await fetch(
          `/api/goblinday/me/lists/${groupId}/movies/${movieId}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          await fetchGroups();
          return false;
        }
        return true;
      } catch {
        await fetchGroups();
        return false;
      }
    },
    [fetchGroups]
  );

  const markWatched = useCallback(
    async (
      groupId: number,
      movieId: number,
      logData: {
        watched_date: string;
        note?: string;
        watched_with?: string;
        log_tag_ids?: number[];
      }
    ): Promise<{ log_entry_id: number } | null> => {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, movies: g.movies.filter((m) => m.movie_id !== movieId) }
            : g
        )
      );
      try {
        const res = await fetch(
          `/api/goblinday/me/lists/${groupId}/movies/${movieId}/watched`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(logData),
          }
        );
        if (!res.ok) {
          await fetchGroups();
          return null;
        }
        const data = await res.json();
        return data.log_entry_id != null
          ? { log_entry_id: data.log_entry_id }
          : null;
      } catch {
        await fetchGroups();
        return null;
      }
    },
    [fetchGroups]
  );

  const reorderMovies = useCallback(
    async (
      groupId: number,
      order: { movie_id: number; sort_order: number }[]
    ): Promise<boolean> => {
      try {
        const res = await fetch(
          `/api/goblinday/me/lists/${groupId}/movies/reorder`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order }),
          }
        );
        if (!res.ok) return false;
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const reorderGroups = useCallback(
    async (
      order: { id: number; sort_order: number }[]
    ): Promise<boolean> => {
      try {
        const res = await fetch("/api/goblinday/me/lists/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order }),
        });
        if (!res.ok) return false;
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const searchPerson = useCallback(
    async (query: string): Promise<TMDBPerson[]> => {
      if (query.length < 2) return [];
      try {
        const res = await fetch(
          `/api/goblinday/tmdb/person?q=${encodeURIComponent(query)}`
        );
        if (!res.ok) return [];
        const data = await res.json();
        return data.results || [];
      } catch {
        return [];
      }
    },
    []
  );

  const getFilmography = useCallback(
    async (
      personId: number
    ): Promise<{
      person: { name: string };
      movies: TMDBFilmographyMovie[];
    } | null> => {
      try {
        const res = await fetch(
          `/api/goblinday/tmdb/person/${personId}/filmography`
        );
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    },
    []
  );

  return {
    groups,
    loading,
    createGroup,
    updateGroup,
    deleteGroup,
    addMovie,
    removeMovie,
    markWatched,
    reorderMovies,
    reorderGroups,
    searchPerson,
    getFilmography,
    refreshGroups: fetchGroups,
  };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: Clean compilation.

- [ ] **Step 4: Commit**

```bash
git add web/lib/goblin-group-utils.ts web/lib/hooks/useGoblinGroups.ts
git commit -m "feat(goblin): add group types and useGoblinGroups hook"
```

---

### Task 4: Enhanced Lists API (GET with full movies, POST with seed)

**Files:**
- Modify: `web/app/api/goblinday/me/lists/route.ts`

- [ ] **Step 1: Rewrite GET to return full movie objects and POST to support description + TMDB seeds**

Replace the entire file content:

```typescript
// web/app/api/goblinday/me/lists/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { ensureMovie } from "@/lib/goblin-movie-utils";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_request: NextRequest, { user, serviceClient }) => {
  const { data: lists, error } = await serviceClient
    .from("goblin_lists")
    .select("id, name, description, sort_order, is_recommendations, created_at")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch lists" }, { status: 500 });
  }

  // Fetch movies for all lists in one query
  const listIds = (lists || []).map((l: any) => l.id);
  let listMovies: Record<number, any[]> = {};

  if (listIds.length > 0) {
    const { data: movieRows } = await serviceClient
      .from("goblin_list_movies")
      .select(`
        list_id, movie_id, sort_order, note, added_at,
        movie:goblin_movies!movie_id (
          id, tmdb_id, title, poster_path, backdrop_path, release_date, genres,
          runtime_minutes, director, year, rt_critics_score, rt_audience_score,
          tmdb_vote_average, tmdb_vote_count, mpaa_rating, imdb_id, synopsis, trailer_url
        )
      `)
      .in("list_id", listIds)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("added_at", { ascending: true });

    for (const row of movieRows || []) {
      const r = row as any;
      if (!listMovies[r.list_id]) listMovies[r.list_id] = [];
      listMovies[r.list_id].push({
        movie_id: r.movie_id,
        sort_order: r.sort_order,
        note: r.note,
        added_at: r.added_at,
        movie: r.movie,
      });
    }
  }

  const groups = (lists || []).map((l: any) => ({
    ...l,
    movies: listMovies[l.id] || [],
  }));

  return NextResponse.json({ groups });
});

export const POST = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  const body = await request.json();
  const { name, description, movie_tmdb_ids } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  // Auto-assign sort_order
  const { data: maxRow } = await serviceClient
    .from("goblin_lists")
    .select("sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const nextSortOrder = ((maxRow as any)?.sort_order ?? 0) + 1;

  const { data: list, error: listError } = await serviceClient
    .from("goblin_lists")
    .insert({
      user_id: user.id,
      name,
      description: description?.trim() || null,
      sort_order: nextSortOrder,
    } as never)
    .select("id, name, description, sort_order, is_recommendations, created_at")
    .single();

  if (listError || !list) {
    return NextResponse.json({ error: "Failed to create list" }, { status: 500 });
  }

  const listId = (list as { id: number }).id;

  // Seed movies from TMDB IDs if provided
  if (Array.isArray(movie_tmdb_ids) && movie_tmdb_ids.length > 0) {
    const movieRows: { list_id: number; movie_id: number; sort_order: number }[] = [];

    for (let i = 0; i < movie_tmdb_ids.length; i++) {
      const movie = await ensureMovie(serviceClient, movie_tmdb_ids[i]);
      if (movie) {
        movieRows.push({
          list_id: listId,
          movie_id: movie.id,
          sort_order: i + 1,
        });
      }
    }

    if (movieRows.length > 0) {
      await serviceClient.from("goblin_list_movies").insert(movieRows as never);
    }
  }

  return NextResponse.json({ group: list }, { status: 201 });
});
```

- [ ] **Step 2: Update PATCH handler to support description**

In `web/app/api/goblinday/me/lists/[id]/route.ts`, update the PATCH handler to handle `description` alongside `name`, and remove the movie_ids replace logic (movies are now managed via dedicated endpoints):

Replace the PATCH handler body (keep DELETE as-is):

```typescript
export const PATCH = withAuthAndParams<{ id: string }>(
  async (request, { user, serviceClient, params }) => {
    const listId = parseInt(params.id);
    if (isNaN(listId)) {
      return NextResponse.json({ error: "Invalid list ID" }, { status: 400 });
    }

    // Verify ownership
    const { data: existing } = await serviceClient
      .from("goblin_lists")
      .select("id")
      .eq("id", listId)
      .eq("user_id", user.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description?.trim() || null;
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order;

    if (Object.keys(updates).length > 0) {
      await serviceClient
        .from("goblin_lists")
        .update(updates as never)
        .eq("id", listId);
    }

    return NextResponse.json({ success: true });
  }
);
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: Clean compilation.

- [ ] **Step 4: Commit**

```bash
git add web/app/api/goblinday/me/lists/route.ts web/app/api/goblinday/me/lists/[id]/route.ts
git commit -m "feat(goblin): enhance lists API — full movie objects, description, TMDB seed support"
```

---

### Task 5: Group Movie CRUD API Routes

**Files:**
- Create: `web/app/api/goblinday/me/lists/[id]/movies/route.ts`
- Create: `web/app/api/goblinday/me/lists/[id]/movies/[movieId]/route.ts`
- Create: `web/app/api/goblinday/me/lists/[id]/movies/[movieId]/watched/route.ts`
- Create: `web/app/api/goblinday/me/lists/[id]/movies/reorder/route.ts`
- Create: `web/app/api/goblinday/me/lists/reorder/route.ts`

- [ ] **Step 1: Create add-movie-to-group route**

```typescript
// web/app/api/goblinday/me/lists/[id]/movies/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";
import { ensureMovie } from "@/lib/goblin-movie-utils";

export const dynamic = "force-dynamic";

export const POST = withAuthAndParams<{ id: string }>(
  async (request: NextRequest, { user, serviceClient, params }) => {
    const listId = parseInt(params.id);
    if (isNaN(listId)) {
      return NextResponse.json({ error: "Invalid list ID" }, { status: 400 });
    }

    // Verify ownership
    const { data: list } = await serviceClient
      .from("goblin_lists")
      .select("id")
      .eq("id", listId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    const body = await request.json();
    const { tmdb_id, note } = body;

    if (!tmdb_id) {
      return NextResponse.json({ error: "tmdb_id required" }, { status: 400 });
    }

    const movie = await ensureMovie(serviceClient, tmdb_id);
    if (!movie) {
      return NextResponse.json(
        { error: "Failed to find or create movie" },
        { status: 500 }
      );
    }

    // Auto-assign sort_order within the group
    const { data: maxRow } = await serviceClient
      .from("goblin_list_movies")
      .select("sort_order")
      .eq("list_id", listId)
      .order("sort_order", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    const nextSortOrder = ((maxRow as any)?.sort_order ?? 0) + 1;

    const { error } = await serviceClient
      .from("goblin_list_movies")
      .insert({
        list_id: listId,
        movie_id: movie.id,
        sort_order: nextSortOrder,
        note: note?.trim() || null,
      } as never);

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Movie already in this group" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to add movie" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, movie_id: movie.id }, { status: 201 });
  }
);
```

- [ ] **Step 2: Create remove-movie and watched routes**

```typescript
// web/app/api/goblinday/me/lists/[id]/movies/[movieId]/route.ts
import { NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

export const DELETE = withAuthAndParams<{ id: string; movieId: string }>(
  async (_request, { user, serviceClient, params }) => {
    const listId = parseInt(params.id);
    const movieId = parseInt(params.movieId);
    if (isNaN(listId) || isNaN(movieId)) {
      return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
    }

    // Verify list ownership
    const { data: list } = await serviceClient
      .from("goblin_lists")
      .select("id")
      .eq("id", listId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    const { error } = await serviceClient
      .from("goblin_list_movies")
      .delete()
      .eq("list_id", listId)
      .eq("movie_id", movieId);

    if (error) {
      return NextResponse.json({ error: "Failed to remove movie" }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  }
);
```

```typescript
// web/app/api/goblinday/me/lists/[id]/movies/[movieId]/watched/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

export const POST = withAuthAndParams<{ id: string; movieId: string }>(
  async (request: NextRequest, { user, serviceClient, params }) => {
    const listId = parseInt(params.id);
    const movieId = parseInt(params.movieId);
    if (isNaN(listId) || isNaN(movieId)) {
      return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
    }

    // Verify list ownership
    const { data: list } = await serviceClient
      .from("goblin_lists")
      .select("id")
      .eq("id", listId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    const body = await request.json();
    const { watched_date, note, watched_with, log_tag_ids } = body;

    if (!watched_date) {
      return NextResponse.json({ error: "watched_date required" }, { status: 400 });
    }

    // Create log entry
    const { data: logEntry, error: logError } = await serviceClient
      .from("goblin_log_entries")
      .insert({
        user_id: user.id,
        movie_id: movieId,
        watched_date,
        note: note?.trim() || null,
        watched_with: watched_with?.trim() || null,
      } as never)
      .select("id")
      .single();

    if (logError || !logEntry) {
      return NextResponse.json({ error: "Failed to create log entry" }, { status: 500 });
    }

    // Attach log tags if provided
    if (log_tag_ids && log_tag_ids.length > 0) {
      const tagRows = log_tag_ids.map((tagId: number) => ({
        entry_id: (logEntry as { id: number }).id,
        tag_id: tagId,
      }));
      await serviceClient
        .from("goblin_log_entry_tags")
        .insert(tagRows as never);
    }

    // Remove movie from group
    await serviceClient
      .from("goblin_list_movies")
      .delete()
      .eq("list_id", listId)
      .eq("movie_id", movieId);

    return NextResponse.json(
      { log_entry_id: (logEntry as { id: number }).id },
      { status: 201 }
    );
  }
);
```

- [ ] **Step 3: Create reorder routes**

```typescript
// web/app/api/goblinday/me/lists/[id]/movies/reorder/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

export const POST = withAuthAndParams<{ id: string }>(
  async (request: NextRequest, { user, serviceClient, params }) => {
    const listId = parseInt(params.id);
    if (isNaN(listId)) {
      return NextResponse.json({ error: "Invalid list ID" }, { status: 400 });
    }

    // Verify ownership
    const { data: list } = await serviceClient
      .from("goblin_lists")
      .select("id")
      .eq("id", listId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    const { order } = await request.json();
    if (!Array.isArray(order) || order.length === 0) {
      return NextResponse.json({ error: "order array required" }, { status: 400 });
    }

    const updates = order.map((item: { movie_id: number; sort_order: number }) =>
      serviceClient
        .from("goblin_list_movies")
        .update({ sort_order: item.sort_order } as never)
        .eq("list_id", listId)
        .eq("movie_id", item.movie_id)
    );

    await Promise.all(updates);

    return NextResponse.json({ success: true });
  }
);
```

```typescript
// web/app/api/goblinday/me/lists/reorder/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  const { order } = await request.json();
  if (!Array.isArray(order) || order.length === 0) {
    return NextResponse.json({ error: "order array required" }, { status: 400 });
  }

  const updates = order.map((item: { id: number; sort_order: number }) =>
    serviceClient
      .from("goblin_lists")
      .update({ sort_order: item.sort_order } as never)
      .eq("id", item.id)
      .eq("user_id", user.id)
  );

  await Promise.all(updates);

  return NextResponse.json({ success: true });
});
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: Clean compilation.

- [ ] **Step 5: Commit**

```bash
git add web/app/api/goblinday/me/lists/[id]/movies/ web/app/api/goblinday/me/lists/reorder/
git commit -m "feat(goblin): group movie CRUD + reorder API routes"
```

---

### Task 6: TMDB Person Search and Filmography API Routes

**Files:**
- Create: `web/app/api/goblinday/tmdb/person/route.ts`
- Create: `web/app/api/goblinday/tmdb/person/[id]/filmography/route.ts`

- [ ] **Step 1: Create person search route**

```typescript
// web/app/api/goblinday/tmdb/person/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

const TMDB_BASE = "https://api.themoviedb.org/3";

export const GET = withAuth(async (request: NextRequest) => {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const tmdbKey = process.env.TMDB_API_KEY;
  if (!tmdbKey) {
    return NextResponse.json({ error: "TMDB not configured" }, { status: 500 });
  }

  const url = `${TMDB_BASE}/search/person?api_key=${tmdbKey}&query=${encodeURIComponent(q)}&language=en-US&page=1`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return NextResponse.json({ error: "TMDB search failed" }, { status: 502 });
    }

    const data = await res.json();

    const results = (data.results || []).slice(0, 10).map((p: any) => ({
      id: p.id,
      name: p.name,
      known_for_department: p.known_for_department || null,
      profile_path: p.profile_path || null,
    }));

    return NextResponse.json({ results });
  } catch {
    clearTimeout(timeoutId);
    return NextResponse.json({ error: "TMDB request timed out" }, { status: 504 });
  }
});
```

- [ ] **Step 2: Create filmography route**

```typescript
// web/app/api/goblinday/tmdb/person/[id]/filmography/route.ts
import { NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

const TMDB_BASE = "https://api.themoviedb.org/3";

export const GET = withAuthAndParams<{ id: string }>(
  async (_request, { params }) => {
    const personId = parseInt(params.id);
    if (isNaN(personId)) {
      return NextResponse.json({ error: "Invalid person ID" }, { status: 400 });
    }

    const tmdbKey = process.env.TMDB_API_KEY;
    if (!tmdbKey) {
      return NextResponse.json({ error: "TMDB not configured" }, { status: 500 });
    }

    const url = `${TMDB_BASE}/person/${personId}/movie_credits?api_key=${tmdbKey}&language=en-US`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return NextResponse.json({ error: "TMDB request failed" }, { status: 502 });
      }

      const data = await res.json();

      // Get person name from a separate call
      const personUrl = `${TMDB_BASE}/person/${personId}?api_key=${tmdbKey}&language=en-US`;
      const personRes = await fetch(personUrl, {
        signal: AbortSignal.timeout(5000),
      });
      const personData = personRes.ok ? await personRes.json() : null;

      // Combine crew (directed) and cast, deduplicate, prefer directing credits
      const directedIds = new Set<number>();
      const movies: any[] = [];

      // Directing credits first
      for (const m of data.crew || []) {
        if (m.job === "Director" && !directedIds.has(m.id)) {
          directedIds.add(m.id);
          movies.push(m);
        }
      }

      // Acting credits (skip duplicates from directing)
      for (const m of data.cast || []) {
        if (!directedIds.has(m.id)) {
          directedIds.add(m.id);
          movies.push(m);
        }
      }

      // Sort by release date descending
      movies.sort((a, b) => {
        const da = a.release_date || "";
        const db = b.release_date || "";
        return db.localeCompare(da);
      });

      const result = movies.slice(0, 50).map((m: any) => ({
        tmdb_id: m.id,
        title: m.title,
        poster_path: m.poster_path || null,
        release_date: m.release_date || null,
        year: m.release_date ? parseInt(m.release_date.split("-")[0]) : null,
        overview: m.overview || null,
      }));

      return NextResponse.json({
        person: { name: personData?.name || "Unknown" },
        movies: result,
      });
    } catch {
      clearTimeout(timeoutId);
      return NextResponse.json({ error: "TMDB request timed out" }, { status: 504 });
    }
  }
);
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: Clean compilation.

- [ ] **Step 4: Commit**

```bash
git add web/app/api/goblinday/tmdb/person/
git commit -m "feat(goblin): TMDB person search and filmography API routes"
```

---

### Task 7: Modify Recommendation Accept to Target Groups

**Files:**
- Modify: `web/app/api/goblinday/me/recommendations/[id]/action/route.ts`

- [ ] **Step 1: Update the "add" action to insert into recommendations group instead of watchlist**

Replace the entire file:

```typescript
// web/app/api/goblinday/me/recommendations/[id]/action/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

export const POST = withAuthAndParams<{ id: string }>(
  async (request: NextRequest, { user, serviceClient, params }) => {
    const recId = parseInt(params.id);
    if (isNaN(recId)) {
      return NextResponse.json({ error: "Invalid recommendation ID" }, { status: 400 });
    }

    const body = await request.json();
    const action = body.action;

    if (action !== "add" && action !== "dismiss") {
      return NextResponse.json({ error: "action must be 'add' or 'dismiss'" }, { status: 400 });
    }

    // Verify ownership and get movie_id + recommender name
    const { data: rec } = await serviceClient
      .from("goblin_watchlist_recommendations")
      .select("id, movie_id, status, recommender_name")
      .eq("id", recId)
      .eq("target_user_id", user.id)
      .maybeSingle();

    if (!rec) {
      return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
    }

    const typedRec = rec as { movie_id: number; status: string; recommender_name: string };

    if (typedRec.status !== "pending") {
      return NextResponse.json({ error: "Recommendation already handled" }, { status: 409 });
    }

    if (action === "add") {
      // Find or create the recommendations group
      let { data: recsGroup } = await serviceClient
        .from("goblin_lists")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_recommendations", true)
        .maybeSingle();

      if (!recsGroup) {
        // Auto-assign sort_order
        const { data: maxRow } = await serviceClient
          .from("goblin_lists")
          .select("sort_order")
          .eq("user_id", user.id)
          .order("sort_order", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        const nextSortOrder = ((maxRow as any)?.sort_order ?? 0) + 1;

        const { data: created } = await serviceClient
          .from("goblin_lists")
          .insert({
            user_id: user.id,
            name: "Recommendations",
            is_recommendations: true,
            sort_order: nextSortOrder,
          } as never)
          .select("id")
          .single();

        recsGroup = created;
      }

      if (recsGroup) {
        const groupId = (recsGroup as { id: number }).id;

        // Auto-assign sort_order within group
        const { data: maxMovie } = await serviceClient
          .from("goblin_list_movies")
          .select("sort_order")
          .eq("list_id", groupId)
          .order("sort_order", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        const nextMovieOrder = ((maxMovie as any)?.sort_order ?? 0) + 1;

        await serviceClient
          .from("goblin_list_movies")
          .insert({
            list_id: groupId,
            movie_id: typedRec.movie_id,
            sort_order: nextMovieOrder,
            note: `Recommended by ${typedRec.recommender_name}`,
          } as never);
      }
    }

    // Update recommendation status
    await serviceClient
      .from("goblin_watchlist_recommendations")
      .update({ status: action === "add" ? "added" : "dismissed" } as never)
      .eq("id", recId)
      .eq("target_user_id", user.id);

    return NextResponse.json({ success: true, action });
  }
);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: Clean compilation.

- [ ] **Step 3: Commit**

```bash
git add web/app/api/goblinday/me/recommendations/[id]/action/route.ts
git commit -m "feat(goblin): route accepted recommendations to group instead of watchlist"
```

---

### Task 8: GoblinGroupSection Component

**Files:**
- Create: `web/components/goblin/GoblinGroupSection.tsx`

- [ ] **Step 1: Build the collapsible group section**

```typescript
// web/components/goblin/GoblinGroupSection.tsx
"use client";

import { useState, useCallback } from "react";
import GoblinWatchlistCard from "./GoblinWatchlistCard";
import GoblinWatchlistWatchedModal from "./GoblinWatchlistWatchedModal";
import type { GoblinGroup, GoblinGroupMovie } from "@/lib/goblin-group-utils";
import type { WatchlistEntry } from "@/lib/goblin-watchlist-utils";

interface Props {
  group: GoblinGroup;
  onAddMovie: () => void;
  onRemoveMovie: (groupId: number, movieId: number) => Promise<boolean>;
  onMarkWatched: (
    groupId: number,
    movieId: number,
    logData: {
      watched_date: string;
      note?: string;
      watched_with?: string;
      log_tag_ids?: number[];
    }
  ) => Promise<{ log_entry_id: number } | null>;
  onEditGroup: (group: GoblinGroup) => void;
  onDeleteGroup: (groupId: number) => void;
  onReorderMovies: (
    groupId: number,
    newOrder: GoblinGroupMovie[]
  ) => Promise<void>;
  logTags: { id: number; name: string; color: string | null }[];
  onCreateLogTag: (name: string) => Promise<{ id: number; name: string; color: string | null } | null>;
}

function groupMovieToWatchlistEntry(gm: GoblinGroupMovie): WatchlistEntry {
  return {
    id: gm.movie_id, // use movie_id as the entry key for group movies
    movie_id: gm.movie_id,
    note: gm.note,
    sort_order: gm.sort_order,
    added_at: gm.added_at,
    movie: gm.movie,
    tags: [],
  };
}

export default function GoblinGroupSection({
  group,
  onAddMovie,
  onRemoveMovie,
  onMarkWatched,
  onEditGroup,
  onDeleteGroup,
  onReorderMovies,
  logTags,
  onCreateLogTag,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [watchedMovie, setWatchedMovie] = useState<GoblinGroupMovie | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const handleDrop = useCallback(
    async (toIndex: number) => {
      if (dragFrom === null || dragFrom === toIndex) {
        setDragFrom(null);
        setDragOver(null);
        return;
      }
      const reordered = [...group.movies];
      const [moved] = reordered.splice(dragFrom, 1);
      reordered.splice(toIndex, 0, moved);
      setDragFrom(null);
      setDragOver(null);
      await onReorderMovies(group.id, reordered);
    },
    [dragFrom, group.movies, group.id, onReorderMovies]
  );

  const handleWatched = useCallback(
    async (
      _entryId: number,
      logData: {
        watched_date: string;
        note?: string;
        watched_with?: string;
        log_tag_ids?: number[];
      }
    ) => {
      if (!watchedMovie) return null;
      const result = await onMarkWatched(group.id, watchedMovie.movie_id, logData);
      if (result) setWatchedMovie(null);
      return result;
    },
    [group.id, watchedMovie, onMarkWatched]
  );

  return (
    <div className="relative">
      {/* Section header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-3 py-3 group/header"
      >
        {/* Collapse chevron */}
        <span
          className="text-zinc-600 text-xs transition-transform duration-200"
          style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0)" }}
        >
          &#x25BC;
        </span>

        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-white uppercase tracking-[0.08em] text-sm leading-none truncate">
              {group.name}
            </h3>
            <span className="text-2xs text-zinc-600 font-mono flex-shrink-0">
              {group.movies.length} film{group.movies.length !== 1 ? "s" : ""}
            </span>
          </div>
          {group.description && (
            <p className="text-2xs text-zinc-500 italic mt-1 truncate">
              {group.description}
            </p>
          )}
        </div>

        {/* Overflow menu button */}
        <div
          className="relative flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="px-2 py-1 text-zinc-700 hover:text-zinc-400
              text-sm font-mono transition-colors"
          >
            ...
          </button>
          {showMenu && (
            <div
              className="absolute right-0 top-full mt-1 z-20 bg-[var(--night)]
                border border-[var(--twilight)] rounded-lg shadow-2xl py-1 min-w-[140px]"
            >
              <button
                onClick={() => {
                  setShowMenu(false);
                  onAddMovie();
                }}
                className="w-full px-3 py-2 text-left text-xs font-mono text-[var(--cream)]
                  hover:bg-[var(--dusk)] transition-colors"
              >
                Add Movie
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  onEditGroup(group);
                }}
                className="w-full px-3 py-2 text-left text-xs font-mono text-[var(--cream)]
                  hover:bg-[var(--dusk)] transition-colors"
              >
                Edit Group
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  onDeleteGroup(group.id);
                }}
                className="w-full px-3 py-2 text-left text-xs font-mono text-red-400
                  hover:bg-[var(--dusk)] transition-colors"
              >
                Delete Group
              </button>
            </div>
          )}
        </div>
      </button>

      {/* Divider */}
      <div
        className="h-px mb-3"
        style={{ background: "rgba(255,217,61,0.1)" }}
      />

      {/* Movie cards */}
      {!collapsed && (
        <>
          {group.movies.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-zinc-600 font-mono text-xs tracking-widest uppercase mb-3">
                // No movies yet
              </p>
              <button
                onClick={onAddMovie}
                className="px-4 py-1.5 border border-dashed border-zinc-700
                  text-zinc-500 font-mono text-2xs uppercase tracking-wider
                  hover:border-amber-500/40 hover:text-amber-400 transition-colors"
              >
                Add a movie
              </button>
            </div>
          ) : (
            <div
              className="space-y-1.5"
              onDragLeave={() => setDragOver(null)}
            >
              {group.movies.map((gm, i) => (
                <GoblinWatchlistCard
                  key={gm.movie_id}
                  entry={groupMovieToWatchlistEntry(gm)}
                  rank={i + 1}
                  hideRank
                  onEdit={() => {}} // no inline edit for group movies
                  onWatched={() => setWatchedMovie(gm)}
                  onRemove={() => onRemoveMovie(group.id, gm.movie_id)}
                  onMoveUp={
                    i > 0
                      ? () => {
                          const reordered = [...group.movies];
                          [reordered[i], reordered[i - 1]] = [reordered[i - 1], reordered[i]];
                          onReorderMovies(group.id, reordered);
                        }
                      : undefined
                  }
                  onMoveDown={
                    i < group.movies.length - 1
                      ? () => {
                          const reordered = [...group.movies];
                          [reordered[i], reordered[i + 1]] = [reordered[i + 1], reordered[i]];
                          onReorderMovies(group.id, reordered);
                        }
                      : undefined
                  }
                  isFirst={i === 0}
                  isLast={i === group.movies.length - 1}
                  onDragStart={() => setDragFrom(i)}
                  onDragOver={() => setDragOver(i)}
                  onDrop={() => handleDrop(i)}
                  isDragging={dragFrom === i}
                  isDragTarget={dragOver === i && dragFrom !== i}
                />
              ))}
            </div>
          )}

          {/* Add movie inline button */}
          {group.movies.length > 0 && (
            <button
              onClick={onAddMovie}
              className="mt-2 w-full py-2 border border-dashed border-zinc-800
                text-zinc-600 font-mono text-2xs uppercase tracking-wider
                hover:border-amber-700/40 hover:text-amber-500/60 transition-colors"
            >
              + Add Movie
            </button>
          )}
        </>
      )}

      {/* Watched modal */}
      <GoblinWatchlistWatchedModal
        entry={watchedMovie ? groupMovieToWatchlistEntry(watchedMovie) : null}
        open={watchedMovie !== null}
        onClose={() => setWatchedMovie(null)}
        onSubmit={handleWatched}
        logTags={logTags}
        onCreateLogTag={onCreateLogTag}
      />
    </div>
  );
}
```

- [ ] **Step 2: Add `hideRank` prop to GoblinWatchlistCard**

In `web/components/goblin/GoblinWatchlistCard.tsx`, add `hideRank?: boolean` to the Props interface and conditionally hide the rank column:

In the Props interface (around line 8), add:
```typescript
  hideRank?: boolean;
```

In the destructuring (around line 33), add `hideRank`:
```typescript
export default function GoblinWatchlistCard({
  entry, rank, hideRank, onEdit, onWatched, onRemove,
```

Replace the rank column div (lines 76–118) with a conditional:
```typescript
      {/* Rank column */}
      {!hideRank && (
        <div className={`relative flex flex-col items-center justify-center flex-shrink-0
          ${isHero ? "w-14 sm:w-16" : "w-11 sm:w-14"}`}>
          {onMoveUp && !isFirst && (
            <button onClick={onMoveUp}
              className="text-zinc-700 hover:text-amber-400 text-xs sm:text-2xs transition-colors
                sm:opacity-0 sm:group-hover:opacity-100 absolute top-0 w-full py-1">
              &#x25B2;
            </button>
          )}
          {editingRank ? (
            <input type="number" min={1} autoFocus value={rankInput}
              onChange={(e) => setRankInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { const v = parseInt(rankInput); if (!isNaN(v) && v >= 1) onMoveToRank?.(v); setEditingRank(false); }
                else if (e.key === "Escape") setEditingRank(false);
              }}
              onBlur={() => setEditingRank(false)}
              className="w-10 text-center bg-transparent border-b-2 border-amber-500
                text-amber-300 font-mono text-lg font-black
                focus:outline-none
                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          ) : (
            <button
              onClick={() => { setRankInput(String(rank)); setEditingRank(true); }}
              className="font-mono font-black leading-none transition-all"
              style={{
                fontSize: isHero ? "2rem" : isMid ? "1.25rem" : "0.875rem",
                color: tier.color,
                textShadow: tier.glow,
              }}
            >
              {rank}
            </button>
          )}
          {onMoveDown && !isLast && (
            <button onClick={onMoveDown}
              className="text-zinc-700 hover:text-amber-400 text-xs sm:text-2xs transition-colors
                sm:opacity-0 sm:group-hover:opacity-100 absolute bottom-0 w-full py-1">
              &#x25BC;
            </button>
          )}
        </div>
      )}
```

Also update the `isHero` / `isMid` / `tier` logic to default to `rest` tier when `hideRank` is true, so cards in groups don't get the hero/mid sizing. After the existing tier computation (around line 44), add:

```typescript
  const isHero = !hideRank && rank <= 3;
  const isMid = !hideRank && rank > 3 && rank <= 10;
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: Clean compilation.

- [ ] **Step 4: Commit**

```bash
git add web/components/goblin/GoblinGroupSection.tsx web/components/goblin/GoblinWatchlistCard.tsx
git commit -m "feat(goblin): GoblinGroupSection component + hideRank prop on watchlist card"
```

---

### Task 9: Create Group Modal with TMDB Seed

**Files:**
- Create: `web/components/goblin/GoblinCreateGroupModal.tsx`

- [ ] **Step 1: Build the two-phase create group modal**

```typescript
// web/components/goblin/GoblinCreateGroupModal.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import SmartImage from "@/components/SmartImage";
import { TMDB_POSTER_W185 } from "@/lib/goblin-log-utils";
import type { TMDBPerson, TMDBFilmographyMovie } from "@/lib/goblin-group-utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description?: string;
    movie_tmdb_ids?: number[];
  }) => Promise<any>;
  searchPerson: (query: string) => Promise<TMDBPerson[]>;
  getFilmography: (
    personId: number
  ) => Promise<{
    person: { name: string };
    movies: TMDBFilmographyMovie[];
  } | null>;
}

export default function GoblinCreateGroupModal({
  open,
  onClose,
  onSubmit,
  searchPerson,
  getFilmography,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // TMDB seed state
  const [seedMode, setSeedMode] = useState<"none" | "person">("none");
  const [personQuery, setPersonQuery] = useState("");
  const [personResults, setPersonResults] = useState<TMDBPerson[]>([]);
  const [personSearching, setPersonSearching] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<TMDBPerson | null>(null);
  const [filmography, setFilmography] = useState<TMDBFilmographyMovie[]>([]);
  const [selectedTmdbIds, setSelectedTmdbIds] = useState<Set<number>>(new Set());
  const [loadingFilmography, setLoadingFilmography] = useState(false);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Focus name input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => nameRef.current?.focus(), 100);
    } else {
      // Reset all state
      setName("");
      setDescription("");
      setSeedMode("none");
      setPersonQuery("");
      setPersonResults([]);
      setSelectedPerson(null);
      setFilmography([]);
      setSelectedTmdbIds(new Set());
    }
  }, [open]);

  // Debounced person search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (personQuery.length < 2) {
      setPersonResults([]);
      return;
    }
    setPersonSearching(true);
    debounceRef.current = setTimeout(async () => {
      const r = await searchPerson(personQuery);
      setPersonResults(r);
      setPersonSearching(false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [personQuery, searchPerson]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const handleSelectPerson = useCallback(
    async (person: TMDBPerson) => {
      setSelectedPerson(person);
      setPersonResults([]);
      setPersonQuery("");
      setLoadingFilmography(true);

      // Auto-fill name if empty
      if (!name.trim()) {
        setName(`Films of ${person.name}`);
      }

      const result = await getFilmography(person.id);
      if (result) {
        setFilmography(result.movies);
        // Select all by default
        setSelectedTmdbIds(new Set(result.movies.map((m) => m.tmdb_id)));
      }
      setLoadingFilmography(false);
    },
    [getFilmography, name]
  );

  const toggleMovie = useCallback((tmdbId: number) => {
    setSelectedTmdbIds((prev) => {
      const next = new Set(prev);
      if (next.has(tmdbId)) next.delete(tmdbId);
      else next.add(tmdbId);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedTmdbIds.size === filmography.length) {
      setSelectedTmdbIds(new Set());
    } else {
      setSelectedTmdbIds(new Set(filmography.map((m) => m.tmdb_id)));
    }
  }, [selectedTmdbIds.size, filmography]);

  const handleSubmit = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);

    const tmdbIds =
      filmography.length > 0 ? Array.from(selectedTmdbIds) : undefined;

    await onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      movie_tmdb_ids: tmdbIds,
    });

    setSubmitting(false);
    onClose();
  };

  if (!open) return null;

  const showFilmography = selectedPerson && filmography.length > 0;

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4
        bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative bg-[var(--night)] border border-[var(--twilight)]
          rounded-xl p-6 max-w-lg w-full shadow-2xl max-h-[85vh] overflow-y-auto"
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full
            hover:bg-[var(--twilight)] transition-colors
            flex items-center justify-center text-[var(--muted)]"
        >
          ✕
        </button>

        <h2 className="text-xl font-semibold text-[var(--cream)] mb-6">
          New Group
        </h2>

        {/* Name */}
        <div className="mb-4">
          <label className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
            Name
          </label>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Films of Denis Villeneuve"
            className="w-full px-3 py-2.5 rounded-lg
              bg-[var(--dusk)] border border-[var(--twilight)]
              text-[var(--cream)] font-mono text-sm
              placeholder:text-[var(--muted)]
              focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        {/* Description */}
        <div className="mb-4">
          <label className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional — flavor text for this group"
            className="w-full px-3 py-2.5 rounded-lg
              bg-[var(--dusk)] border border-[var(--twilight)]
              text-[var(--cream)] font-mono text-sm
              placeholder:text-[var(--muted)]
              focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        {/* Seed from TMDB */}
        {!showFilmography && (
          <div className="mb-6">
            <label className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2 block">
              Seed from TMDB
            </label>

            {seedMode === "none" ? (
              <button
                onClick={() => setSeedMode("person")}
                className="px-3 py-2 border border-dashed border-zinc-700
                  text-zinc-500 font-mono text-2xs uppercase tracking-wider
                  hover:border-amber-500/40 hover:text-amber-400 transition-colors w-full"
              >
                Search by Director / Actor
              </button>
            ) : (
              <div>
                <input
                  type="text"
                  value={personQuery}
                  onChange={(e) => setPersonQuery(e.target.value)}
                  placeholder="Search for a director or actor..."
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-lg
                    bg-[var(--dusk)] border border-[var(--twilight)]
                    text-[var(--cream)] font-mono text-sm
                    placeholder:text-[var(--muted)]
                    focus:outline-none focus:border-amber-500 transition-colors"
                />

                {personSearching && (
                  <p className="mt-2 text-xs text-[var(--muted)] font-mono">
                    Searching...
                  </p>
                )}

                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                  {personResults.map((person) => (
                    <button
                      key={person.id}
                      onClick={() => handleSelectPerson(person)}
                      className="w-full flex items-center gap-2 p-2 rounded-lg
                        hover:bg-[var(--dusk)] transition-colors text-left"
                    >
                      <span className="text-sm text-[var(--cream)]">
                        {person.name}
                      </span>
                      {person.known_for_department && (
                        <span className="text-2xs text-[var(--muted)] font-mono">
                          {person.known_for_department}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    setSeedMode("none");
                    setPersonQuery("");
                    setPersonResults([]);
                  }}
                  className="mt-2 text-2xs text-[var(--muted)] font-mono
                    hover:text-[var(--cream)] transition-colors"
                >
                  Cancel seed
                </button>
              </div>
            )}
          </div>
        )}

        {/* Filmography selection */}
        {loadingFilmography && (
          <p className="text-xs text-[var(--muted)] font-mono mb-4">
            Loading filmography...
          </p>
        )}

        {showFilmography && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
                {selectedPerson.name}&apos;s Films ({selectedTmdbIds.size}/{filmography.length})
              </label>
              <button
                onClick={toggleAll}
                className="text-2xs font-mono text-amber-500 hover:text-amber-400 transition-colors"
              >
                {selectedTmdbIds.size === filmography.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>

            <div className="space-y-1 max-h-60 overflow-y-auto border border-[var(--twilight)] rounded-lg p-2">
              {filmography.map((movie) => {
                const isSelected = selectedTmdbIds.has(movie.tmdb_id);
                return (
                  <button
                    key={movie.tmdb_id}
                    onClick={() => toggleMovie(movie.tmdb_id)}
                    className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg
                      transition-colors text-left ${
                        isSelected
                          ? "bg-amber-950/30"
                          : "hover:bg-[var(--dusk)]"
                      }`}
                  >
                    {/* Checkbox */}
                    <div
                      className={`w-4 h-4 rounded border flex-shrink-0
                        flex items-center justify-center text-2xs font-bold
                        ${
                          isSelected
                            ? "bg-amber-600 border-amber-500 text-black"
                            : "border-zinc-700 text-transparent"
                        }`}
                    >
                      ✓
                    </div>

                    {/* Poster */}
                    <div className="w-8 h-12 flex-shrink-0 rounded overflow-hidden bg-[var(--twilight)]">
                      {movie.poster_path && (
                        <SmartImage
                          src={`${TMDB_POSTER_W185}${movie.poster_path}`}
                          alt={movie.title}
                          width={32}
                          height={48}
                          className="object-cover w-full h-full"
                        />
                      )}
                    </div>

                    {/* Title + year */}
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm truncate ${
                          isSelected
                            ? "text-[var(--cream)]"
                            : "text-[var(--soft)]"
                        }`}
                      >
                        {movie.title}
                        {movie.year && (
                          <span className="text-[var(--muted)] ml-1.5 text-xs">
                            ({movie.year})
                          </span>
                        )}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => {
                setSelectedPerson(null);
                setFilmography([]);
                setSelectedTmdbIds(new Set());
                setSeedMode("none");
              }}
              className="mt-2 text-2xs text-[var(--muted)] font-mono
                hover:text-[var(--cream)] transition-colors"
            >
              Clear selection
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-[var(--twilight)] text-[var(--cream)] rounded-lg
              font-mono text-sm hover:bg-[var(--dusk)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || submitting}
            className="flex-1 py-2.5 bg-amber-600 text-black rounded-lg
              font-mono text-sm font-medium disabled:opacity-50
              hover:bg-amber-500 transition-colors"
          >
            {submitting
              ? "Creating..."
              : filmography.length > 0
                ? `Create (${selectedTmdbIds.size} films)`
                : "Create Group"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: Clean compilation.

- [ ] **Step 3: Commit**

```bash
git add web/components/goblin/GoblinCreateGroupModal.tsx
git commit -m "feat(goblin): GoblinCreateGroupModal with TMDB person seed"
```

---

### Task 10: Wire Groups into GoblinWatchlistView

**Files:**
- Modify: `web/components/goblin/GoblinWatchlistView.tsx`

- [ ] **Step 1: Add group imports and hook**

Add these imports at the top of the file:

```typescript
import { useGoblinGroups } from "@/lib/hooks/useGoblinGroups";
import GoblinGroupSection from "./GoblinGroupSection";
import GoblinCreateGroupModal from "./GoblinCreateGroupModal";
import GoblinAddToWatchlistModal from "./GoblinAddToWatchlistModal";
import type { GoblinGroup, GoblinGroupMovie } from "@/lib/goblin-group-utils";
```

Inside the component, after the existing `useGoblinWatchlist` hook call, add:

```typescript
  const groupsHook = useGoblinGroups(isAuthenticated);
```

Add state for group modals:

```typescript
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [addToGroupId, setAddToGroupId] = useState<number | null>(null);
  const [editingGroup, setEditingGroup] = useState<GoblinGroup | null>(null);
```

- [ ] **Step 2: Add group handlers**

```typescript
  const handleGroupReorderMovies = useCallback(
    async (groupId: number, newOrder: GoblinGroupMovie[]) => {
      const order = newOrder.map((m, i) => ({
        movie_id: m.movie_id,
        sort_order: i + 1,
      }));
      await groupsHook.reorderMovies(groupId, order);
      await groupsHook.refreshGroups();
    },
    [groupsHook]
  );

  // handleAddMovieToGroup is handled inline in the GoblinAddToWatchlistModal onSubmit below
```

- [ ] **Step 3: Add "+ GROUP" button to header**

In the header button area (after the "+ ADD" button), add:

```typescript
            <button
              onClick={() => setCreateGroupOpen(true)}
              className="px-4 py-1.5 text-zinc-400
                font-mono text-2xs font-bold tracking-[0.2em] uppercase
                border border-zinc-700
                hover:text-amber-300 hover:border-amber-700 hover:shadow-[0_0_12px_rgba(255,217,61,0.15)]
                active:scale-95 transition-all"
            >
              + GROUP
            </button>
```

- [ ] **Step 4: Remove the standalone recommendations block**

Remove the entire `{/* Recommendations */}` section (the `{recommendationCount > 0 && (...)}` block, lines ~266–321). Recommendations will now render as a group section.

- [ ] **Step 5: Add group sections below the ranked queue**

After the closing `</div>` of the ranked list section (the `filteredEntries.map` block) and before the modals, add:

```typescript
      {/* Group sections */}
      {groupsHook.groups.length > 0 && (
        <div className="mt-10 space-y-6 relative z-10">
          <div
            className="h-px"
            style={{ background: "linear-gradient(to right, transparent, rgba(255,217,61,0.15), transparent)" }}
          />
          {groupsHook.groups.map((group) => (
            <GoblinGroupSection
              key={group.id}
              group={group}
              onAddMovie={() => setAddToGroupId(group.id)}
              onRemoveMovie={groupsHook.removeMovie}
              onMarkWatched={groupsHook.markWatched}
              onEditGroup={setEditingGroup}
              onDeleteGroup={groupsHook.deleteGroup}
              onReorderMovies={handleGroupReorderMovies}
              logTags={logHook.tags}
              onCreateLogTag={logHook.createTag}
            />
          ))}
        </div>
      )}
```

- [ ] **Step 6: Add group modals at the bottom of the component**

Before the closing `</div>` of the component, add:

```typescript
      {/* Create Group Modal */}
      <GoblinCreateGroupModal
        open={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
        onSubmit={async (data) => {
          await groupsHook.createGroup(data);
        }}
        searchPerson={groupsHook.searchPerson}
        getFilmography={groupsHook.getFilmography}
      />

      {/* Add Movie to Group Modal — reuses the same TMDB search modal */}
      <GoblinAddToWatchlistModal
        open={addToGroupId !== null}
        onClose={() => setAddToGroupId(null)}
        onSubmit={async (data) => {
          if (addToGroupId === null) return false;
          return await groupsHook.addMovie(addToGroupId, data.tmdb_id, data.note);
        }}
        searchTMDB={searchTMDB}
        tags={[]}
        onCreateTag={async () => null}
      />
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: Clean compilation.

- [ ] **Step 8: Browser test**

Run: `cd /Users/coach/Projects/LostCity/web && npm run dev`

Test in browser at `http://localhost:3000/goblinday?tab=watchlist`:
1. Ranked queue still renders and works (drag, reorder, watched, remove)
2. "+ GROUP" button appears in header
3. Clicking "+ GROUP" opens create group modal
4. Can create an empty group (appears below ranked queue)
5. Can create a group with TMDB person seed (search "Denis Villeneuve", see filmography, select movies)
6. Group sections are collapsible
7. Can add movies to a group via the "Add Movie" button
8. Can remove movies from a group via `[×]`
9. Can mark a movie watched from a group via `[WATCHED]`
10. Accepting a recommendation creates/uses the Recommendations group

- [ ] **Step 9: Commit**

```bash
git add web/components/goblin/GoblinWatchlistView.tsx
git commit -m "feat(goblin): wire queue groups into watchlist view — groups below ranked list, create modal, TMDB seed"
```

---

### Task 11: Final Verification and Cleanup

- [ ] **Step 1: Full TypeScript check**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 2: Lint check**

Run: `cd /Users/coach/Projects/LostCity/web && npm run lint`
Expected: No new errors.

- [ ] **Step 3: Run existing tests**

Run: `cd /Users/coach/Projects/LostCity/web && npx vitest run --reporter=verbose 2>&1 | tail -20`
Expected: All existing tests pass. No regressions.

- [ ] **Step 4: Browser smoke test checklist**

Navigate to `http://localhost:3000/goblinday?tab=watchlist` and verify:

| Feature | Expected |
|---------|----------|
| Ranked queue | Unchanged behavior — rank, drag, reorder, edit, remove, watched |
| `[×]` on ranked queue | Removes without watched modal (already worked) |
| "+ GROUP" button | Opens create group modal |
| Create empty group | Group section appears below queue with "No movies yet" |
| Create seeded group | Search person → filmography → select → group with movies |
| Group collapse/expand | Chevron toggles, movies hide/show |
| Group overflow menu | Edit, Delete, Add Movie options |
| Add movie to group | TMDB search modal, movie appears in group |
| Remove movie from group | `[×]` removes optimistically |
| Watched from group | Opens watched modal → creates log entry → removes from group |
| Recommendations | Accepting adds to Recommendations group section |
| Multiple groups | Each renders independently, correct ordering |
