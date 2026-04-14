# Goblin Day: To-Watch List (The Queue) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a personal To-Watch List ("The Queue") to Goblin Day with TMDB search, manual ordering, watchlist-specific tags, and a "Watched" funnel into The Log.

**Architecture:** New `goblin_watchlist_entries` / `goblin_watchlist_tags` / `goblin_watchlist_entry_tags` tables. CRUD API routes following existing Log patterns (`withAuth`/`withAuthAndParams`). New `useGoblinWatchlist` hook mirroring `useGoblinLog`. New "Watchlist" tab in GoblinDayPage with amber/gold accent. Horror card bookmarks rewired to create watchlist entries. "Watched" action atomically creates a Log entry and deletes the watchlist entry.

**Tech Stack:** Next.js 16 App Router API routes, Supabase (service client), React hooks, Tailwind v4, existing TMDB integration.

**Spec:** `docs/superpowers/specs/2026-04-10-goblin-watchlist-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/20260410100000_goblin_watchlist.sql` | Create | Tables, RLS, indexes, bookmark backfill |
| `web/lib/goblin-watchlist-utils.ts` | Create | Types (`WatchlistEntry`, `WatchlistTag`) + shared constants |
| `web/app/api/goblinday/me/watchlist/route.ts` | Create | GET (list) + POST (add) watchlist entries |
| `web/app/api/goblinday/me/watchlist/[id]/route.ts` | Create | PATCH + DELETE individual entries |
| `web/app/api/goblinday/me/watchlist/[id]/watched/route.ts` | Create | POST — atomic move to Log |
| `web/app/api/goblinday/me/watchlist/reorder/route.ts` | Create | POST — reorder entries |
| `web/app/api/goblinday/me/watchlist-tags/route.ts` | Create | GET + POST watchlist tags |
| `web/app/api/goblinday/me/watchlist-tags/[id]/route.ts` | Create | PATCH + DELETE individual tags |
| `web/lib/hooks/useGoblinWatchlist.ts` | Create | Hook: entries, tags, CRUD, reorder, markWatched |
| `web/components/goblin/GoblinWatchlistView.tsx` | Create | Main watchlist tab UI |
| `web/components/goblin/GoblinWatchlistCard.tsx` | Create | Individual watchlist entry card |
| `web/components/goblin/GoblinAddToWatchlistModal.tsx` | Create | TMDB search → add to watchlist |
| `web/components/goblin/GoblinWatchlistWatchedModal.tsx` | Create | "Watched" form → move to Log |
| `web/components/goblin/GoblinDayPage.tsx` | Modify | Add "Watchlist" tab, rewire bookmark toggle |
| `web/app/api/goblinday/me/route.ts` | Modify | Include watchlist movie_ids in response |
| `web/lib/hooks/useGoblinUser.ts` | Modify | Expose `watchlistMovieIds`, rewire `toggleBookmark` |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260410100000_goblin_watchlist.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Goblin Day: To-Watch List (The Queue)
-- New tables for personal watchlist with tags and ordering.
-- Backfills existing goblin_user_movies.bookmarked rows.

-- 1. Watchlist tags (separate from log tags)
CREATE TABLE goblin_watchlist_tags (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE goblin_watchlist_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own watchlist tags" ON goblin_watchlist_tags
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public read watchlist tags" ON goblin_watchlist_tags
  FOR SELECT USING (true);

CREATE INDEX idx_goblin_watchlist_tags_user ON goblin_watchlist_tags(user_id);

-- 2. Watchlist entries
CREATE TABLE goblin_watchlist_entries (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id integer NOT NULL REFERENCES goblin_movies(id),
  note text,
  sort_order integer,
  added_at timestamptz DEFAULT now(),
  UNIQUE(user_id, movie_id)
);

ALTER TABLE goblin_watchlist_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own watchlist entries" ON goblin_watchlist_entries
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public read watchlist entries" ON goblin_watchlist_entries
  FOR SELECT USING (true);

CREATE INDEX idx_goblin_watchlist_entries_user_order
  ON goblin_watchlist_entries(user_id, sort_order);

-- 3. Watchlist entry <-> tag join table
CREATE TABLE goblin_watchlist_entry_tags (
  entry_id integer NOT NULL REFERENCES goblin_watchlist_entries(id) ON DELETE CASCADE,
  tag_id integer NOT NULL REFERENCES goblin_watchlist_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, tag_id)
);

ALTER TABLE goblin_watchlist_entry_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own watchlist entry tags" ON goblin_watchlist_entry_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM goblin_watchlist_entries
      WHERE id = entry_id AND user_id = auth.uid()
    )
  );
CREATE POLICY "Public read watchlist entry tags" ON goblin_watchlist_entry_tags
  FOR SELECT USING (true);

-- 4. Backfill existing bookmarks into watchlist
INSERT INTO goblin_watchlist_entries (user_id, movie_id, sort_order, added_at)
SELECT user_id, movie_id,
  ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at),
  created_at
FROM goblin_user_movies
WHERE bookmarked = true
ON CONFLICT (user_id, movie_id) DO NOTHING;
```

- [ ] **Step 2: Verify migration applies locally**

Run: `cd /Users/coach/Projects/LostCity && npx supabase db push --local` (or whatever local migration command is used)

Alternatively, if using direct Supabase: verify the SQL is syntactically valid by reading it.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260410100000_goblin_watchlist.sql
git commit -m "feat(goblin): add watchlist tables, RLS, and bookmark backfill"
```

---

## Task 2: Watchlist Types & Utils

**Files:**
- Create: `web/lib/goblin-watchlist-utils.ts`

- [ ] **Step 1: Create the types file**

```typescript
// Watchlist-specific types — separate tag system from The Log

export interface WatchlistEntry {
  id: number;
  movie_id: number;
  note: string | null;
  sort_order: number | null;
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
  tags: WatchlistTag[];
}

export interface WatchlistTag {
  id: number;
  name: string;
  color: string | null;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/lib/goblin-watchlist-utils.ts
git commit -m "feat(goblin): add watchlist types"
```

---

## Task 3: Watchlist Tag API Routes

**Files:**
- Create: `web/app/api/goblinday/me/watchlist-tags/route.ts`
- Create: `web/app/api/goblinday/me/watchlist-tags/[id]/route.ts`

These follow the exact same pattern as the existing `web/app/api/goblinday/me/tags/route.ts` and `web/app/api/goblinday/me/tags/[id]/route.ts`, but target `goblin_watchlist_tags` instead of `goblin_tags`.

- [ ] **Step 1: Create GET + POST route for watchlist tags**

Create `web/app/api/goblinday/me/watchlist-tags/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { getNextTagColor } from "@/lib/goblin-log-utils";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_request: NextRequest, { user, serviceClient }) => {
  const { data, error } = await serviceClient
    .from("goblin_watchlist_tags")
    .select("id, name, color, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch watchlist tags" }, { status: 500 });
  }

  return NextResponse.json({ tags: data || [] });
});

export const POST = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  const body = await request.json();
  const name = body.name?.trim()?.toLowerCase();

  if (!name || name.length > 50) {
    return NextResponse.json({ error: "Tag name required (max 50 chars)" }, { status: 400 });
  }

  let color = body.color?.trim() || null;
  if (!color) {
    const { count } = await serviceClient
      .from("goblin_watchlist_tags")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    color = getNextTagColor(count || 0);
  }

  const { data, error } = await serviceClient
    .from("goblin_watchlist_tags")
    .insert({ user_id: user.id, name, color } as never)
    .select("id, name, color, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Tag already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create tag" }, { status: 500 });
  }

  return NextResponse.json({ tag: data }, { status: 201 });
});
```

- [ ] **Step 2: Create PATCH + DELETE route for individual watchlist tags**

Create `web/app/api/goblinday/me/watchlist-tags/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

export const PATCH = withAuthAndParams<{ id: string }>(
  async (request: NextRequest, { user, serviceClient, params }) => {
    const tagId = parseInt(params.id);
    if (isNaN(tagId)) {
      return NextResponse.json({ error: "Invalid tag ID" }, { status: 400 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name.trim().toLowerCase();
    if (body.color !== undefined) updates.color = body.color.trim();

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { data, error } = await serviceClient
      .from("goblin_watchlist_tags")
      .update(updates as never)
      .eq("id", tagId)
      .eq("user_id", user.id)
      .select("id, name, color")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Tag not found or update failed" }, { status: 404 });
    }

    return NextResponse.json({ tag: data });
  }
);

export const DELETE = withAuthAndParams<{ id: string }>(
  async (_request: NextRequest, { user, serviceClient, params }) => {
    const tagId = parseInt(params.id);
    if (isNaN(tagId)) {
      return NextResponse.json({ error: "Invalid tag ID" }, { status: 400 });
    }

    const { error } = await serviceClient
      .from("goblin_watchlist_tags")
      .delete()
      .eq("id", tagId)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: "Failed to delete tag" }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  }
);
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add web/app/api/goblinday/me/watchlist-tags/route.ts web/app/api/goblinday/me/watchlist-tags/\[id\]/route.ts
git commit -m "feat(goblin): add watchlist tag CRUD API routes"
```

---

## Task 4: Watchlist Entry API Routes

**Files:**
- Create: `web/app/api/goblinday/me/watchlist/route.ts`
- Create: `web/app/api/goblinday/me/watchlist/[id]/route.ts`
- Create: `web/app/api/goblinday/me/watchlist/reorder/route.ts`

- [ ] **Step 1: Create GET + POST route for watchlist entries**

Create `web/app/api/goblinday/me/watchlist/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

const TMDB_BASE = "https://api.themoviedb.org/3";

/** Ensure a movie exists in goblin_movies by TMDB ID, fetching from TMDB if needed */
async function ensureMovie(
  serviceClient: any,
  tmdbId: number
): Promise<{ id: number } | null> {
  const { data: existing } = await serviceClient
    .from("goblin_movies")
    .select("id")
    .eq("tmdb_id", tmdbId)
    .maybeSingle();

  if (existing) return existing as { id: number };

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
    const director = m.credits?.crew?.find((c: any) => c.job === "Director")?.name || null;
    const releaseYear = m.release_date ? parseInt(m.release_date.split("-")[0]) : null;

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

export const GET = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  const tag = request.nextUrl.searchParams.get("tag");

  const { data: entries, error } = await serviceClient
    .from("goblin_watchlist_entries")
    .select(`
      id, note, sort_order, added_at,
      movie:goblin_movies!movie_id (
        id, tmdb_id, title, poster_path, backdrop_path, release_date, genres,
        runtime_minutes, director, year, rt_critics_score, rt_audience_score,
        tmdb_vote_average, tmdb_vote_count, mpaa_rating, imdb_id, synopsis, trailer_url
      )
    `)
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("added_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch watchlist" }, { status: 500 });
  }

  // Fetch tags for all entries
  const entryIds = (entries || []).map((e: any) => e.id);
  let entryTags: Record<number, { id: number; name: string; color: string | null }[]> = {};

  if (entryIds.length > 0) {
    const { data: tagRows } = await serviceClient
      .from("goblin_watchlist_entry_tags")
      .select("entry_id, tag:goblin_watchlist_tags!tag_id (id, name, color)")
      .in("entry_id", entryIds);

    for (const row of tagRows || []) {
      const r = row as any;
      if (!entryTags[r.entry_id]) entryTags[r.entry_id] = [];
      if (r.tag) entryTags[r.entry_id].push(r.tag);
    }
  }

  const result = (entries || []).map((e: any) => ({
    ...e,
    tags: entryTags[e.id] || [],
  }));

  if (tag) {
    const filtered = result.filter((e: any) =>
      e.tags.some((t: any) => t.name === tag.toLowerCase())
    );
    return NextResponse.json({ entries: filtered });
  }

  return NextResponse.json({ entries: result });
});

export const POST = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  const body = await request.json();
  const { tmdb_id, note, tag_ids } = body;

  if (!tmdb_id) {
    return NextResponse.json({ error: "tmdb_id required" }, { status: 400 });
  }

  const movie = await ensureMovie(serviceClient, tmdb_id);
  if (!movie) {
    return NextResponse.json({ error: "Failed to find or create movie" }, { status: 500 });
  }

  // Get next sort_order
  const { data: maxRow } = await serviceClient
    .from("goblin_watchlist_entries")
    .select("sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = ((maxRow as { sort_order: number } | null)?.sort_order ?? 0) + 1;

  const { data: entry, error } = await serviceClient
    .from("goblin_watchlist_entries")
    .insert({
      user_id: user.id,
      movie_id: movie.id,
      note: note?.trim() || null,
      sort_order: nextOrder,
    } as never)
    .select("id, movie_id, note, sort_order, added_at")
    .single();

  if (error || !entry) {
    if (error?.code === "23505") {
      return NextResponse.json({ error: "Movie already on watchlist" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to add to watchlist" }, { status: 500 });
  }

  // Attach tags if provided
  if (tag_ids && tag_ids.length > 0) {
    const tagRows = tag_ids.map((tagId: number) => ({
      entry_id: (entry as any).id,
      tag_id: tagId,
    }));
    await serviceClient
      .from("goblin_watchlist_entry_tags")
      .insert(tagRows as never);
  }

  return NextResponse.json({ entry }, { status: 201 });
});
```

- [ ] **Step 2: Create PATCH + DELETE route for individual entries**

Create `web/app/api/goblinday/me/watchlist/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

export const PATCH = withAuthAndParams<{ id: string }>(
  async (request: NextRequest, { user, serviceClient, params }) => {
    const entryId = parseInt(params.id);
    if (isNaN(entryId)) {
      return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
    }

    const { data: existing } = await serviceClient
      .from("goblin_watchlist_entries")
      .select("id")
      .eq("id", entryId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.note !== undefined) updates.note = body.note?.trim() || null;

    if (Object.keys(updates).length > 0) {
      await serviceClient
        .from("goblin_watchlist_entries")
        .update(updates as never)
        .eq("id", entryId)
        .eq("user_id", user.id);
    }

    // Update tags if provided (replace all)
    if (body.tag_ids !== undefined) {
      await serviceClient
        .from("goblin_watchlist_entry_tags")
        .delete()
        .eq("entry_id", entryId);

      if (body.tag_ids.length > 0) {
        const tagRows = body.tag_ids.map((tagId: number) => ({
          entry_id: entryId,
          tag_id: tagId,
        }));
        await serviceClient
          .from("goblin_watchlist_entry_tags")
          .insert(tagRows as never);
      }
    }

    return NextResponse.json({ success: true });
  }
);

export const DELETE = withAuthAndParams<{ id: string }>(
  async (_request: NextRequest, { user, serviceClient, params }) => {
    const entryId = parseInt(params.id);
    if (isNaN(entryId)) {
      return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
    }

    const { error } = await serviceClient
      .from("goblin_watchlist_entries")
      .delete()
      .eq("id", entryId)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  }
);
```

- [ ] **Step 3: Create reorder route**

Create `web/app/api/goblinday/me/watchlist/reorder/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  const body = await request.json();
  const { order } = body;

  if (!Array.isArray(order) || order.length === 0) {
    return NextResponse.json({ error: "order array required" }, { status: 400 });
  }

  const updates = order.map((item: { id: number; sort_order: number }) =>
    serviceClient
      .from("goblin_watchlist_entries")
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

- [ ] **Step 5: Commit**

```bash
git add web/app/api/goblinday/me/watchlist/route.ts web/app/api/goblinday/me/watchlist/\[id\]/route.ts web/app/api/goblinday/me/watchlist/reorder/route.ts
git commit -m "feat(goblin): add watchlist entry CRUD + reorder API routes"
```

---

## Task 5: "Watched" Action API Route

**Files:**
- Create: `web/app/api/goblinday/me/watchlist/[id]/watched/route.ts`

- [ ] **Step 1: Create the watched action route**

Create `web/app/api/goblinday/me/watchlist/[id]/watched/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

export const POST = withAuthAndParams<{ id: string }>(
  async (request: NextRequest, { user, serviceClient, params }) => {
    const entryId = parseInt(params.id);
    if (isNaN(entryId)) {
      return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
    }

    // Verify ownership and get movie_id
    const { data: watchlistEntry } = await serviceClient
      .from("goblin_watchlist_entries")
      .select("id, movie_id")
      .eq("id", entryId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!watchlistEntry) {
      return NextResponse.json({ error: "Watchlist entry not found" }, { status: 404 });
    }

    const body = await request.json();
    const { watched_date, note, watched_with, log_tag_ids } = body;

    if (!watched_date) {
      return NextResponse.json({ error: "watched_date required" }, { status: 400 });
    }

    const movieId = (watchlistEntry as { movie_id: number }).movie_id;

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

    // Delete watchlist entry (cascades to watchlist_entry_tags)
    await serviceClient
      .from("goblin_watchlist_entries")
      .delete()
      .eq("id", entryId)
      .eq("user_id", user.id);

    return NextResponse.json({
      log_entry_id: (logEntry as { id: number }).id,
    }, { status: 201 });
  }
);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/app/api/goblinday/me/watchlist/\[id\]/watched/route.ts
git commit -m "feat(goblin): add watched action — atomic watchlist-to-log transfer"
```

---

## Task 6: Update /api/goblinday/me to Include Watchlist Movie IDs

**Files:**
- Modify: `web/app/api/goblinday/me/route.ts`

- [ ] **Step 1: Add watchlist movie_ids to the response**

In `web/app/api/goblinday/me/route.ts`, add a query for watchlist entries after the existing lists query. Insert this code before the final `return NextResponse.json(...)`:

After the existing `lists` fetch block (around line 28-29), add:

```typescript
  // Fetch watchlist movie IDs
  const { data: watchlistRows } = await serviceClient
    .from("goblin_watchlist_entries")
    .select("movie_id")
    .eq("user_id", user.id);

  const watchlistMovieIds = (watchlistRows || []).map(
    (r: { movie_id: number }) => r.movie_id
  );
```

Then update the final return to include `watchlistMovieIds`:

Change:
```typescript
  return NextResponse.json({
    bookmarks,
    watched,
    lists: (lists || []).map(
```

To:
```typescript
  return NextResponse.json({
    bookmarks,
    watched,
    watchlistMovieIds,
    lists: (lists || []).map(
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/app/api/goblinday/me/route.ts
git commit -m "feat(goblin): include watchlist movie IDs in /me endpoint"
```

---

## Task 7: useGoblinWatchlist Hook

**Files:**
- Create: `web/lib/hooks/useGoblinWatchlist.ts`

- [ ] **Step 1: Create the hook**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import type { WatchlistEntry, WatchlistTag } from "@/lib/goblin-watchlist-utils";
import type { TMDBSearchResult } from "@/lib/goblin-log-utils";

interface UseGoblinWatchlistState {
  entries: WatchlistEntry[];
  tags: WatchlistTag[];
  loading: boolean;
}

interface UseGoblinWatchlistActions {
  addEntry: (data: {
    tmdb_id: number;
    note?: string;
    tag_ids?: number[];
  }) => Promise<boolean>;
  updateEntry: (
    entryId: number,
    data: Partial<{ note: string; tag_ids: number[] }>
  ) => Promise<boolean>;
  deleteEntry: (entryId: number) => Promise<boolean>;
  reorderEntries: (newOrder: WatchlistEntry[]) => Promise<boolean>;
  markWatched: (
    entryId: number,
    logData: {
      watched_date: string;
      note?: string;
      watched_with?: string;
      log_tag_ids?: number[];
    }
  ) => Promise<{ log_entry_id: number } | null>;
  createTag: (name: string) => Promise<WatchlistTag | null>;
  deleteTag: (tagId: number) => Promise<boolean>;
  searchTMDB: (query: string) => Promise<TMDBSearchResult[]>;
  refreshEntries: () => Promise<void>;
}

export function useGoblinWatchlist(
  isAuthenticated: boolean
): UseGoblinWatchlistState & UseGoblinWatchlistActions {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [tags, setTags] = useState<WatchlistTag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/goblinday/me/watchlist");
      if (!res.ok) return;
      const data = await res.json();
      setEntries(data.entries || []);
    } catch {
      // Non-critical
    }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch("/api/goblinday/me/watchlist-tags");
      if (!res.ok) return;
      const data = await res.json();
      setTags(data.tags || []);
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
    Promise.all([fetchEntries(), fetchTags()]).finally(() =>
      setLoading(false)
    );
  }, [isAuthenticated, fetchEntries, fetchTags]);

  const addEntry = useCallback(
    async (data: { tmdb_id: number; note?: string; tag_ids?: number[] }) => {
      try {
        const res = await fetch("/api/goblinday/me/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) return false;
        await fetchEntries();
        return true;
      } catch {
        return false;
      }
    },
    [fetchEntries]
  );

  const updateEntry = useCallback(
    async (entryId: number, data: any) => {
      try {
        const res = await fetch(`/api/goblinday/me/watchlist/${entryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) return false;
        await fetchEntries();
        return true;
      } catch {
        return false;
      }
    },
    [fetchEntries]
  );

  const deleteEntry = useCallback(
    async (entryId: number) => {
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
      try {
        const res = await fetch(`/api/goblinday/me/watchlist/${entryId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          await fetchEntries();
          return false;
        }
        return true;
      } catch {
        await fetchEntries();
        return false;
      }
    },
    [fetchEntries]
  );

  const reorderEntries = useCallback(
    async (newOrder: WatchlistEntry[]): Promise<boolean> => {
      setEntries(newOrder);
      const order = newOrder.map((e, i) => ({ id: e.id, sort_order: i + 1 }));
      try {
        const res = await fetch("/api/goblinday/me/watchlist/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order }),
        });
        if (!res.ok) {
          await fetchEntries();
          return false;
        }
        return true;
      } catch {
        await fetchEntries();
        return false;
      }
    },
    [fetchEntries]
  );

  const markWatched = useCallback(
    async (
      entryId: number,
      logData: {
        watched_date: string;
        note?: string;
        watched_with?: string;
        log_tag_ids?: number[];
      }
    ): Promise<{ log_entry_id: number } | null> => {
      // Optimistic removal
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
      try {
        const res = await fetch(`/api/goblinday/me/watchlist/${entryId}/watched`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(logData),
        });
        if (!res.ok) {
          await fetchEntries();
          return null;
        }
        const data = await res.json();
        return { log_entry_id: data.log_entry_id };
      } catch {
        await fetchEntries();
        return null;
      }
    },
    [fetchEntries]
  );

  const createTag = useCallback(
    async (name: string): Promise<WatchlistTag | null> => {
      try {
        const res = await fetch("/api/goblinday/me/watchlist-tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        setTags((prev) => [...prev, data.tag]);
        return data.tag;
      } catch {
        return null;
      }
    },
    []
  );

  const deleteTag = useCallback(
    async (tagId: number) => {
      setTags((prev) => prev.filter((t) => t.id !== tagId));
      try {
        const res = await fetch(`/api/goblinday/me/watchlist-tags/${tagId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          await fetchTags();
          return false;
        }
        await fetchEntries();
        return true;
      } catch {
        await fetchTags();
        return false;
      }
    },
    [fetchTags, fetchEntries]
  );

  const searchTMDB = useCallback(async (query: string): Promise<TMDBSearchResult[]> => {
    if (query.length < 2) return [];
    try {
      const res = await fetch(
        `/api/goblinday/tmdb/search?q=${encodeURIComponent(query)}`
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.results || [];
    } catch {
      return [];
    }
  }, []);

  return {
    entries,
    tags,
    loading,
    addEntry,
    updateEntry,
    deleteEntry,
    reorderEntries,
    markWatched,
    createTag,
    deleteTag,
    searchTMDB,
    refreshEntries: fetchEntries,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/lib/hooks/useGoblinWatchlist.ts
git commit -m "feat(goblin): add useGoblinWatchlist hook"
```

---

## Task 8: GoblinWatchlistCard Component

**Files:**
- Create: `web/components/goblin/GoblinWatchlistCard.tsx`

- [ ] **Step 1: Create the card component**

This follows the same layout as `GoblinLogEntryCard.tsx` but with amber/gold accent instead of cyan, and a "WATCHED" action button instead of the date/watched-with display.

```typescript
"use client";

import { useState } from "react";
import SmartImage from "@/components/SmartImage";
import { formatRuntime, TMDB_POSTER_W185, TMDB_POSTER_W342 } from "@/lib/goblin-log-utils";
import type { WatchlistEntry } from "@/lib/goblin-watchlist-utils";

interface Props {
  entry: WatchlistEntry;
  rank: number;
  onEdit: (entry: WatchlistEntry) => void;
  onWatched: (entry: WatchlistEntry) => void;
  onRemove: (entryId: number) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onMoveToRank?: (rank: number) => void;
  isFirst?: boolean;
  isLast?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  isDragTarget?: boolean;
  isDragging?: boolean;
}

const RANK_NEON = {
  hero: { color: "#ffd93d", glow: "0 0 10px rgba(255,217,61,0.4), 0 0 30px rgba(255,217,61,0.15)" },
  mid: { color: "#fb923c", glow: "0 0 8px rgba(251,146,60,0.3), 0 0 20px rgba(251,146,60,0.1)" },
  rest: { color: "#52525b", glow: "none" },
};

export default function GoblinWatchlistCard({
  entry, rank, onEdit, onWatched, onRemove, onMoveUp, onMoveDown, onMoveToRank,
  isFirst, isLast,
  onDragStart, onDragOver, onDrop, isDragTarget, isDragging,
}: Props) {
  const [showInfo, setShowInfo] = useState(false);
  const [editingRank, setEditingRank] = useState(false);
  const [rankInput, setRankInput] = useState("");
  const movie = entry.movie;

  const isHero = rank <= 3;
  const isMid = rank > 3 && rank <= 10;
  const tier = isHero ? RANK_NEON.hero : isMid ? RANK_NEON.mid : RANK_NEON.rest;
  const posterSrc = movie.poster_path
    ? `${isHero ? TMDB_POSTER_W342 : TMDB_POSTER_W185}${movie.poster_path}`
    : null;

  const trailerUrl = movie.trailer_url
    ?? `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + " " + (movie.year || "") + " trailer")}`;
  const imdbUrl = movie.imdb_id ? `https://www.imdb.com/title/${movie.imdb_id}` : null;

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart?.(); }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; onDragOver?.(e); }}
      onDrop={(e) => { e.preventDefault(); onDrop?.(); }}
      onDragEnd={(e) => e.preventDefault()}
      className={`group relative flex items-stretch overflow-hidden
        transition-[border-color,opacity,transform] duration-200 ease-out
        bg-[rgba(5,5,8,0.92)] border border-zinc-800/40
        ${isDragging ? "opacity-30 scale-[0.98]" : ""}
        ${isDragTarget ? "border-t-2 border-t-amber-400" : ""}
        cursor-grab active:cursor-grabbing
        hover:border-zinc-700/60`}
      style={{
        animationDelay: `${Math.min(rank, 8) * 40}ms`,
        borderLeft: `2px solid ${tier.color}`,
      }}
    >
      {/* Rank column */}
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

      {/* Poster */}
      <div className={`relative flex-shrink-0 overflow-hidden
        ${isHero ? "w-[85px] sm:w-[110px]" : "w-[60px] sm:w-[75px]"}`}>
        {posterSrc ? (
          <SmartImage src={posterSrc} alt={movie.title}
            width={isHero ? 110 : 75} height={isHero ? 165 : 112}
            loading="lazy"
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="flex items-center justify-center h-full min-h-[90px]
            text-2xs text-zinc-700 font-mono p-1 text-center bg-zinc-950">
            {movie.title}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div
          onClick={() => onEdit(entry)}
          className="cursor-pointer p-3 sm:p-3.5 hover:bg-white/[0.02] transition-colors"
        >
          {/* Title */}
          <div className="flex items-start justify-between gap-2">
            <h3 className={`font-black text-white leading-none uppercase
              ${isHero ? "text-base sm:text-lg tracking-[0.08em]" : "text-sm tracking-[0.06em]"}`}
              style={isHero ? { textShadow: `0 0 20px rgba(255,217,61,0.15)` } : undefined}
            >
              {movie.title}
            </h3>
            <span className="text-amber-800 text-2xs font-mono font-bold flex-shrink-0
              opacity-0 group-hover:opacity-100 transition-opacity tracking-widest">
              EDIT
            </span>
          </div>

          {/* Director / year / runtime */}
          <div className="flex items-center gap-1.5 mt-1 text-2xs font-mono">
            {movie.director && <span className="text-zinc-400">{movie.director}</span>}
            {movie.director && movie.year && <span className="text-zinc-800">/</span>}
            {movie.year && <span className="text-zinc-500">{movie.year}</span>}
            {movie.runtime_minutes && (
              <><span className="text-zinc-800">/</span><span className="text-zinc-600">{formatRuntime(movie.runtime_minutes)}</span></>
            )}
            {movie.mpaa_rating && (
              <><span className="text-zinc-800">/</span><span className="text-zinc-600">{movie.mpaa_rating}</span></>
            )}
          </div>

          {/* Scores */}
          {(movie.rt_critics_score != null || movie.rt_audience_score != null || movie.tmdb_vote_average != null) && (
            <div className="flex items-center gap-2 mt-2 text-2xs font-mono">
              {movie.rt_critics_score != null && (
                <span className={`px-1.5 py-0.5 border ${
                  movie.rt_critics_score >= 75
                    ? "text-amber-300 border-amber-800/50 bg-amber-950/30"
                    : movie.rt_critics_score >= 60
                      ? "text-amber-500/70 border-amber-900/30 bg-amber-950/20"
                      : "text-zinc-600 border-zinc-800/50 bg-zinc-950/30"
                }`}>
                  {movie.rt_critics_score}% RT
                </span>
              )}
              {movie.rt_audience_score != null && (
                <span className={`px-1.5 py-0.5 border ${
                  movie.rt_audience_score >= 75
                    ? "text-fuchsia-300 border-fuchsia-800/40 bg-fuchsia-950/30"
                    : movie.rt_audience_score >= 60
                      ? "text-fuchsia-500/60 border-fuchsia-900/20 bg-fuchsia-950/20"
                      : "text-zinc-600 border-zinc-800/50 bg-zinc-950/30"
                }`}>
                  {movie.rt_audience_score}% AUD
                </span>
              )}
              {movie.tmdb_vote_average != null && (
                <span className={`px-1.5 py-0.5 border ${
                  movie.tmdb_vote_average >= 7
                    ? "text-amber-300 border-amber-800/40 bg-amber-950/20"
                    : movie.tmdb_vote_average >= 5
                      ? "text-amber-600/70 border-amber-900/20 bg-amber-950/10"
                      : "text-zinc-600 border-zinc-800/50 bg-zinc-950/30"
                }`}>
                  {movie.tmdb_vote_average.toFixed(1)} TMDB
                </span>
              )}
            </div>
          )}

          {/* Tags + note */}
          <div className="flex items-center flex-wrap gap-1.5 mt-2">
            {entry.tags.map((tag) => (
              <span key={tag.id}
                className="px-1.5 py-0.5 text-2xs font-mono font-bold uppercase tracking-wider
                  border transition-all duration-200"
                style={{
                  backgroundColor: `${tag.color}10`,
                  borderColor: `${tag.color}30`,
                  color: tag.color || "#a1a1aa",
                  textShadow: `0 0 8px ${tag.color}40`,
                }}
              >
                {tag.name}
              </span>
            ))}
          </div>

          {entry.note && (
            <p className={`mt-2 text-xs text-zinc-500 italic leading-relaxed
              border-l border-amber-900/30 pl-2.5 ${!showInfo ? "line-clamp-1" : ""}`}>
              {entry.note}
            </p>
          )}
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-3 px-3 sm:px-3.5 pb-2.5 pt-0
          text-xs sm:text-2xs font-mono">
          <button
            onClick={() => onWatched(entry)}
            className="py-1 text-emerald-600 hover:text-emerald-400 font-bold tracking-widest transition-colors"
          >
            [WATCHED]
          </button>
          <button onClick={() => setShowInfo(!showInfo)}
            className={`py-1 transition-colors text-zinc-700
              ${showInfo ? "text-amber-400" : "hover:text-amber-500"}`}>
            [{showInfo ? "−" : "i"}]
          </button>
          <a href={trailerUrl} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="py-1 text-zinc-700 hover:text-fuchsia-400 transition-colors">[▶]</a>
          {imdbUrl && (
            <a href={imdbUrl} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="py-1 text-zinc-700 hover:text-amber-400 transition-colors">[imdb]</a>
          )}
          <button
            onClick={() => onRemove(entry.id)}
            className="py-1 ml-auto text-zinc-800 hover:text-red-500 transition-colors"
          >
            [×]
          </button>
        </div>

        {/* Synopsis */}
        {showInfo && movie.synopsis && (
          <div className="px-3 sm:px-3.5 pb-3 animate-fade-in">
            <p className="text-xs text-zinc-500 leading-relaxed border-t border-amber-900/20 pt-2">
              {movie.synopsis}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/components/goblin/GoblinWatchlistCard.tsx
git commit -m "feat(goblin): add GoblinWatchlistCard component"
```

---

## Task 9: GoblinAddToWatchlistModal Component

**Files:**
- Create: `web/components/goblin/GoblinAddToWatchlistModal.tsx`

- [ ] **Step 1: Create the modal**

Same two-phase TMDB search flow as `GoblinAddMovieModal.tsx`, but simpler form (no date, no watched-with).

```typescript
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import SmartImage from "@/components/SmartImage";
import GoblinTagPicker from "./GoblinTagPicker";
import {
  TMDB_POSTER_W185,
  type TMDBSearchResult,
} from "@/lib/goblin-log-utils";
import type { WatchlistTag } from "@/lib/goblin-watchlist-utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    tmdb_id: number;
    note?: string;
    tag_ids?: number[];
  }) => Promise<boolean>;
  searchTMDB: (query: string) => Promise<TMDBSearchResult[]>;
  tags: WatchlistTag[];
  onCreateTag: (name: string) => Promise<WatchlistTag | null>;
}

export default function GoblinAddToWatchlistModal({
  open,
  onClose,
  onSubmit,
  searchTMDB,
  tags,
  onCreateTag,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TMDBSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<TMDBSearchResult | null>(null);
  const [note, setNote] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResults([]);
      setSelected(null);
      setNote("");
      setSelectedTagIds([]);
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const r = await searchTMDB(query);
      setResults(r);
      setSearching(false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searchTMDB]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const handleSubmit = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    const success = await onSubmit({
      tmdb_id: selected.tmdb_id,
      note: note.trim() || undefined,
      tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    });
    setSubmitting(false);
    if (success) onClose();
  };

  const toggleTag = useCallback((tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }, []);

  if (!open) return null;

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
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full
            hover:bg-[var(--twilight)] transition-colors
            flex items-center justify-center text-[var(--muted)]"
        >
          ✕
        </button>

        <h2 className="text-xl font-semibold text-[var(--cream)] mb-6">
          Add to Queue
        </h2>

        {!selected ? (
          <>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for a movie..."
              className="w-full px-3 py-2.5 rounded-lg
                bg-[var(--dusk)] border border-[var(--twilight)]
                text-[var(--cream)] font-mono text-sm
                placeholder:text-[var(--muted)]
                focus:outline-none focus:border-amber-500 transition-colors"
            />

            {searching && (
              <p className="mt-3 text-xs text-[var(--muted)] font-mono">Searching...</p>
            )}

            <div className="mt-3 space-y-1 max-h-80 overflow-y-auto">
              {results.map((movie) => (
                <button
                  key={movie.tmdb_id}
                  onClick={() => setSelected(movie)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg
                    hover:bg-[var(--dusk)] transition-colors text-left group"
                >
                  <div className="w-10 h-15 flex-shrink-0 rounded overflow-hidden bg-[var(--twilight)]">
                    {movie.poster_path && (
                      <SmartImage
                        src={`${TMDB_POSTER_W185}${movie.poster_path}`}
                        alt={movie.title}
                        width={40}
                        height={60}
                        className="object-cover w-full h-full"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--cream)] truncate
                      group-hover:text-amber-400 transition-colors">
                      {movie.title}
                      <span className="text-[var(--muted)] ml-1.5 font-normal">
                        {movie.release_date?.split("-")[0] || ""}
                      </span>
                    </p>
                    {movie.overview && (
                      <p className="text-2xs text-[var(--muted)] line-clamp-1 mt-0.5">
                        {movie.overview}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[var(--twilight)]">
              <div className="w-12 h-18 flex-shrink-0 rounded overflow-hidden bg-[var(--twilight)]">
                {selected.poster_path && (
                  <SmartImage
                    src={`${TMDB_POSTER_W185}${selected.poster_path}`}
                    alt={selected.title}
                    width={48}
                    height={72}
                    className="object-cover w-full h-full"
                  />
                )}
              </div>
              <div>
                <p className="text-base font-semibold text-[var(--cream)]">
                  {selected.title}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {selected.release_date?.split("-")[0] || ""}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="ml-auto text-xs text-[var(--muted)] hover:text-[var(--cream)]
                  font-mono transition-colors"
              >
                change
              </button>
            </div>

            {/* Note */}
            <div className="mb-4">
              <label className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
                Note
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why this movie? Who recommended it?"
                rows={2}
                className="w-full px-3 py-2.5 rounded-lg resize-none
                  bg-[var(--dusk)] border border-[var(--twilight)]
                  text-[var(--cream)] font-mono text-sm
                  placeholder:text-[var(--muted)]
                  focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            {/* Tags */}
            <div className="mb-6">
              <label className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
                Tags
              </label>
              <GoblinTagPicker
                tags={tags}
                selectedIds={selectedTagIds}
                onToggle={toggleTag}
                onCreate={onCreateTag}
              />
            </div>

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
                disabled={submitting}
                className="flex-1 py-2.5 bg-amber-600 text-black rounded-lg
                  font-mono text-sm font-medium disabled:opacity-50 transition-colors
                  hover:bg-amber-500"
              >
                {submitting ? "Adding..." : "Add to Queue"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/components/goblin/GoblinAddToWatchlistModal.tsx
git commit -m "feat(goblin): add GoblinAddToWatchlistModal component"
```

---

## Task 10: GoblinWatchlistWatchedModal Component

**Files:**
- Create: `web/components/goblin/GoblinWatchlistWatchedModal.tsx`

- [ ] **Step 1: Create the watched modal**

Pre-filled with the movie from the watchlist entry. Form has Log fields: date, watched-with, note, Log tags.

```typescript
"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import SmartImage from "@/components/SmartImage";
import GoblinTagPicker from "./GoblinTagPicker";
import { toISODate, TMDB_POSTER_W185, type GoblinTag } from "@/lib/goblin-log-utils";
import type { WatchlistEntry } from "@/lib/goblin-watchlist-utils";

interface Props {
  entry: WatchlistEntry | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (
    entryId: number,
    logData: {
      watched_date: string;
      note?: string;
      watched_with?: string;
      log_tag_ids?: number[];
    }
  ) => Promise<{ log_entry_id: number } | null>;
  logTags: GoblinTag[];
  onCreateLogTag: (name: string) => Promise<GoblinTag | null>;
}

export default function GoblinWatchlistWatchedModal({
  entry,
  open,
  onClose,
  onSubmit,
  logTags,
  onCreateLogTag,
}: Props) {
  const [watchedDate, setWatchedDate] = useState(toISODate(new Date()));
  const [note, setNote] = useState("");
  const [watchedWith, setWatchedWith] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setNote("");
      setWatchedWith("");
      setSelectedTagIds([]);
      setWatchedDate(toISODate(new Date()));
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const handleSubmit = async () => {
    if (!entry || submitting) return;
    setSubmitting(true);
    const result = await onSubmit(entry.id, {
      watched_date: watchedDate,
      note: note.trim() || undefined,
      watched_with: watchedWith.trim() || undefined,
      log_tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    });
    setSubmitting(false);
    if (result) onClose();
  };

  if (!open || !entry) return null;

  const movie = entry.movie;

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
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full
            hover:bg-[var(--twilight)] transition-colors
            flex items-center justify-center text-[var(--muted)]"
        >
          ✕
        </button>

        <h2 className="text-xl font-semibold text-[var(--cream)] mb-6">
          Log It
        </h2>

        {/* Movie header */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[var(--twilight)]">
          <div className="w-12 h-18 flex-shrink-0 rounded overflow-hidden bg-[var(--twilight)]">
            {movie.poster_path && (
              <SmartImage
                src={`${TMDB_POSTER_W185}${movie.poster_path}`}
                alt={movie.title}
                width={48}
                height={72}
                className="object-cover w-full h-full"
              />
            )}
          </div>
          <div>
            <p className="text-base font-semibold text-[var(--cream)]">
              {movie.title}
            </p>
            <p className="text-xs text-[var(--muted)]">
              {movie.year || movie.release_date?.split("-")[0] || ""}
            </p>
          </div>
        </div>

        {/* Date */}
        <div className="mb-4">
          <label className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
            Date Watched
          </label>
          <input
            type="date"
            value={watchedDate}
            onChange={(e) => setWatchedDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg
              bg-[var(--dusk)] border border-[var(--twilight)]
              text-[var(--cream)] font-mono text-sm
              focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Watched with */}
        <div className="mb-4">
          <label className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
            Watched With
          </label>
          <input
            type="text"
            value={watchedWith}
            onChange={(e) => setWatchedWith(e.target.value)}
            placeholder="Ashley + Daniel"
            className="w-full px-3 py-2.5 rounded-lg
              bg-[var(--dusk)] border border-[var(--twilight)]
              text-[var(--cream)] font-mono text-sm
              placeholder:text-[var(--muted)]
              focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Note */}
        <div className="mb-4">
          <label className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
            Note
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Quick thoughts..."
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg resize-none
              bg-[var(--dusk)] border border-[var(--twilight)]
              text-[var(--cream)] font-mono text-sm
              placeholder:text-[var(--muted)]
              focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Log Tags */}
        <div className="mb-6">
          <label className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
            Log Tags
          </label>
          <GoblinTagPicker
            tags={logTags}
            selectedIds={selectedTagIds}
            onToggle={(tagId) =>
              setSelectedTagIds((prev) =>
                prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
              )
            }
            onCreate={onCreateLogTag}
          />
        </div>

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
            disabled={submitting}
            className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg
              font-mono text-sm font-medium disabled:opacity-50 transition-colors
              hover:bg-emerald-500"
          >
            {submitting ? "Logging..." : "Log It"}
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

- [ ] **Step 3: Commit**

```bash
git add web/components/goblin/GoblinWatchlistWatchedModal.tsx
git commit -m "feat(goblin): add GoblinWatchlistWatchedModal component"
```

---

## Task 11: GoblinWatchlistView Component

**Files:**
- Create: `web/components/goblin/GoblinWatchlistView.tsx`

- [ ] **Step 1: Create the main watchlist view**

Mirrors `GoblinLogView.tsx` structure — header, tag filters, drag-to-reorder list.

```typescript
"use client";

import { useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useGoblinWatchlist } from "@/lib/hooks/useGoblinWatchlist";
import { useGoblinLog } from "@/lib/hooks/useGoblinLog";
import GoblinWatchlistCard from "./GoblinWatchlistCard";
import GoblinAddToWatchlistModal from "./GoblinAddToWatchlistModal";
import GoblinWatchlistWatchedModal from "./GoblinWatchlistWatchedModal";
import GoblinTagPicker from "./GoblinTagPicker";
import type { WatchlistEntry, WatchlistTag } from "@/lib/goblin-watchlist-utils";

interface Props {
  isAuthenticated: boolean;
}

export default function GoblinWatchlistView({ isAuthenticated }: Props) {
  const {
    entries,
    tags,
    loading,
    addEntry,
    updateEntry,
    deleteEntry,
    reorderEntries,
    markWatched,
    createTag,
    deleteTag,
    searchTMDB,
  } = useGoblinWatchlist(isAuthenticated);

  // Log tags + createTag for the "Watched" modal
  const logHook = useGoblinLog(isAuthenticated);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [watchedEntry, setWatchedEntry] = useState<WatchlistEntry | null>(null);
  const [editEntry, setEditEntry] = useState<WatchlistEntry | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const filteredEntries = useMemo(() => {
    if (!activeTag) return entries;
    return entries.filter((e) => e.tags.some((t) => t.name === activeTag));
  }, [entries, activeTag]);

  const swapEntries = useCallback(
    async (indexA: number, indexB: number) => {
      if (indexB < 0 || indexB >= filteredEntries.length) return;
      const reordered = [...filteredEntries];
      [reordered[indexA], reordered[indexB]] = [reordered[indexB], reordered[indexA]];
      await reorderEntries(reordered);
    },
    [filteredEntries, reorderEntries]
  );

  const handleDrop = useCallback(
    async (toIndex: number) => {
      if (dragFrom === null || dragFrom === toIndex) {
        setDragFrom(null);
        setDragOver(null);
        return;
      }
      const reordered = [...filteredEntries];
      const [moved] = reordered.splice(dragFrom, 1);
      reordered.splice(toIndex, 0, moved);
      setDragFrom(null);
      setDragOver(null);
      await reorderEntries(reordered);
    },
    [dragFrom, filteredEntries, reorderEntries]
  );

  const moveToRank = useCallback(
    async (currentIndex: number, newRank: number) => {
      const targetIndex = Math.max(0, Math.min(newRank - 1, filteredEntries.length - 1));
      if (targetIndex === currentIndex) return;
      const reordered = [...filteredEntries];
      const [moved] = reordered.splice(currentIndex, 1);
      reordered.splice(targetIndex, 0, moved);
      await reorderEntries(reordered);
    },
    [filteredEntries, reorderEntries]
  );

  const handleWatched = useCallback(
    async (
      entryId: number,
      logData: {
        watched_date: string;
        note?: string;
        watched_with?: string;
        log_tag_ids?: number[];
      }
    ) => {
      const result = await markWatched(entryId, logData);
      return result;
    },
    [markWatched]
  );

  const handleEditSave = useCallback(
    async (entryId: number, data: { note?: string; tag_ids?: number[] }) => {
      await updateEntry(entryId, data);
      setEditEntry(null);
    },
    [updateEntry]
  );

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <p className="text-zinc-500 font-mono text-sm text-center">
          Sign in to start your watchlist
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto relative">
      {/* Header */}
      <div className="mb-8 relative z-10">
        <div className="flex items-end justify-between gap-4 pb-4"
          style={{ borderBottom: "1px solid rgba(255,217,61,0.15)" }}>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-[0.25em] leading-none"
              style={{ textShadow: "0 0 30px rgba(255,217,61,0.2), 0 0 60px rgba(255,217,61,0.05)" }}>
              The Queue
            </h2>
            <p className="text-2xs text-zinc-600 font-mono mt-2 tracking-[0.3em] uppercase">
              {filteredEntries.length} film{filteredEntries.length !== 1 ? "s" : ""}
              {activeTag && <span className="text-amber-400/70"> / #{activeTag}</span>}
            </p>
          </div>
          <button
            onClick={() => setAddModalOpen(true)}
            className="px-4 py-1.5 text-white
              font-mono text-2xs font-black tracking-[0.2em] uppercase
              border border-amber-600 bg-amber-950/40
              hover:bg-amber-900/40 hover:shadow-[0_0_20px_rgba(255,217,61,0.2)]
              active:scale-95 transition-all"
          >
            + ADD
          </button>
        </div>

        {/* Tag filters */}
        {tags.length > 0 && (
          <div className="flex items-center gap-1.5 mt-4 overflow-x-auto scrollbar-hide
            [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] sm:[mask-image:none]">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex-shrink-0 flex items-center gap-0.5 rounded-full font-mono text-2xs font-medium
                  border transition-all duration-200 group/tag"
                style={{
                  backgroundColor: activeTag === tag.name ? `${tag.color}20` : "transparent",
                  borderColor: activeTag === tag.name ? `${tag.color}60` : "var(--twilight)",
                  color: activeTag === tag.name ? tag.color || "var(--cream)" : "var(--muted)",
                }}
              >
                <button
                  onClick={() => setActiveTag(activeTag === tag.name ? null : tag.name)}
                  className="pl-2 pr-0.5 py-0.5"
                >
                  {tag.name}
                </button>
                <button
                  onClick={async () => {
                    if (activeTag === tag.name) setActiveTag(null);
                    await deleteTag(tag.id);
                  }}
                  className="pr-1.5 py-0.5 opacity-0 group-hover/tag:opacity-100
                    hover:text-red-400 transition-all"
                  title={`Delete "${tag.name}" tag`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse flex items-stretch h-24
              bg-zinc-950 border border-zinc-800/40">
              <div className="w-12 bg-zinc-900/50" />
              <div className="w-20 bg-zinc-900/30" />
              <div className="flex-1 p-3 space-y-2">
                <div className="h-4 bg-zinc-800/40 rounded w-1/3" />
                <div className="h-3 bg-zinc-800/30 rounded w-1/2" />
                <div className="h-3 bg-zinc-800/20 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-zinc-500 font-mono text-sm text-center mb-1 tracking-widest uppercase">
            {activeTag
              ? `// Nothing tagged "${activeTag}"`
              : "// Nothing in the queue yet"}
          </p>
          {!activeTag && (
            <button
              onClick={() => setAddModalOpen(true)}
              className="mt-4 px-5 py-2 border border-dashed border-zinc-700
                text-zinc-500 font-mono text-xs uppercase tracking-wider
                hover:border-amber-500/40 hover:text-amber-400 transition-colors"
            >
              Add a movie
            </button>
          )}
        </div>
      ) : (
        <div
          className="relative z-10 space-y-1.5"
          onDragLeave={() => setDragOver(null)}
        >
          {filteredEntries.map((entry, i) => (
            <GoblinWatchlistCard
              key={entry.id}
              entry={entry}
              rank={i + 1}
              onEdit={setEditEntry}
              onWatched={setWatchedEntry}
              onRemove={deleteEntry}
              onMoveUp={() => swapEntries(i, i - 1)}
              onMoveDown={() => swapEntries(i, i + 1)}
              onMoveToRank={(rank) => moveToRank(i, rank)}
              isFirst={i === 0}
              isLast={i === filteredEntries.length - 1}
              onDragStart={() => setDragFrom(i)}
              onDragOver={() => setDragOver(i)}
              onDrop={() => handleDrop(i)}
              isDragging={dragFrom === i}
              isDragTarget={dragOver === i && dragFrom !== i}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <GoblinAddToWatchlistModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSubmit={addEntry}
        searchTMDB={searchTMDB}
        tags={tags}
        onCreateTag={createTag}
      />

      <GoblinWatchlistWatchedModal
        entry={watchedEntry}
        open={watchedEntry !== null}
        onClose={() => setWatchedEntry(null)}
        onSubmit={handleWatched}
        logTags={logHook.tags}
        onCreateLogTag={logHook.createTag}
      />

      {/* Inline edit — simple note/tag edit (reuses pattern, could be a modal later) */}
      {editEntry && (
        <EditEntryInline
          entry={editEntry}
          tags={tags}
          onSave={handleEditSave}
          onClose={() => setEditEntry(null)}
          onCreateTag={createTag}
        />
      )}
    </div>
  );
}

/** Inline edit for watchlist entry note + tags */
function EditEntryInline({
  entry,
  tags,
  onSave,
  onClose,
  onCreateTag,
}: {
  entry: WatchlistEntry;
  tags: WatchlistTag[];
  onSave: (entryId: number, data: { note?: string; tag_ids?: number[] }) => Promise<void>;
  onClose: () => void;
  onCreateTag: (name: string) => Promise<WatchlistTag | null>;
}) {
  const [note, setNote] = useState(entry.note || "");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(
    entry.tags.map((t) => t.id)
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(entry.id, {
      note: note.trim() || undefined,
      tag_ids: selectedTagIds,
    });
    setSaving(false);
  };

  return createPortalContent(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4
        bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative bg-[var(--night)] border border-[var(--twilight)]
        rounded-xl p-6 max-w-lg w-full shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full
            hover:bg-[var(--twilight)] transition-colors
            flex items-center justify-center text-[var(--muted)]"
        >
          ✕
        </button>

        <h2 className="text-xl font-semibold text-[var(--cream)] mb-4">
          Edit — {entry.movie.title}
        </h2>

        <div className="mb-4">
          <label className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
            Note
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why this movie?"
            rows={2}
            className="w-full px-3 py-2.5 rounded-lg resize-none
              bg-[var(--dusk)] border border-[var(--twilight)]
              text-[var(--cream)] font-mono text-sm
              placeholder:text-[var(--muted)]
              focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        <div className="mb-6">
          <label className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
            Tags
          </label>
          <GoblinTagPicker
            tags={tags}
            selectedIds={selectedTagIds}
            onToggle={(tagId) =>
              setSelectedTagIds((prev) =>
                prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
              )
            }
            onCreate={onCreateTag}
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 bg-[var(--twilight)] text-[var(--cream)] rounded-lg
              font-mono text-sm hover:bg-[var(--dusk)] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-amber-600 text-black rounded-lg
              font-mono text-sm font-medium disabled:opacity-50 transition-colors
              hover:bg-amber-500">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function createPortalContent(content: React.ReactNode) {
  return createPortal(content, document.body);
}
```

**Note:** The imports for `createPortal`, `GoblinTagPicker`, and `WatchlistTag` are already included at the top of the file. The `createPortalContent` helper function should be placed after the main component but before `EditEntryInline`.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/components/goblin/GoblinWatchlistView.tsx
git commit -m "feat(goblin): add GoblinWatchlistView component with drag-to-reorder and modals"
```

---

## Task 12: Integrate Watchlist Tab into GoblinDayPage

**Files:**
- Modify: `web/components/goblin/GoblinDayPage.tsx`
- Modify: `web/lib/hooks/useGoblinUser.ts`

This task wires the new tab into the existing page and rewires the bookmark toggle.

- [ ] **Step 1: Update useGoblinUser to expose watchlistMovieIds**

In `web/lib/hooks/useGoblinUser.ts`:

1. Add `watchlistMovieIds` to state:

After `const [lists, setLists] = useState<GoblinList[]>([]);` add:
```typescript
  const [watchlistMovieIds, setWatchlistMovieIds] = useState<Set<number>>(new Set());
```

2. Update `fetchUserData` to read watchlist IDs from the API response:

After `setLists(data.lists ?? []);` add:
```typescript
      setWatchlistMovieIds(new Set<number>(data.watchlistMovieIds ?? []));
```

3. Rewire `toggleBookmark` to use watchlist API:

Replace the entire `toggleBookmark` callback with:
```typescript
  const toggleBookmark = useCallback(
    async (movieId: number) => {
      const wasOnWatchlist = watchlistMovieIds.has(movieId);
      // Optimistic update
      setWatchlistMovieIds((prev) => {
        const next = new Set(prev);
        if (wasOnWatchlist) next.delete(movieId);
        else next.add(movieId);
        return next;
      });
      try {
        if (wasOnWatchlist) {
          // Find the watchlist entry ID to delete — need to fetch it
          const listRes = await fetch("/api/goblinday/me/watchlist");
          if (!listRes.ok) throw new Error("Failed");
          const listData = await listRes.json();
          const entry = (listData.entries || []).find(
            (e: any) => e.movie_id === movieId || e.movie?.id === movieId
          );
          if (entry) {
            const res = await fetch(`/api/goblinday/me/watchlist/${entry.id}`, {
              method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed");
          }
        } else {
          // Need to find the tmdb_id for this movie
          // The movie is from goblin_movies, so movie.id === movieId
          // We need to look it up — but the horror cards have the GoblinMovie with tmdb_id
          // Store the mapping or pass tmdb_id. For now, use a dedicated quick-add endpoint.
          // Actually, the POST watchlist accepts movie_id lookup — but currently it takes tmdb_id.
          // We need an alternative: POST with movie_id directly.
          // Simplest fix: the bookmarks API still works for quick-add from horror cards,
          // and we also create a watchlist entry. Let's call the watchlist POST with tmdb_id.
          // But we don't have tmdb_id here — only movie_id (internal DB id).
          // Solution: add a by_movie_id param to POST /api/goblinday/me/watchlist
          const res = await fetch("/api/goblinday/me/watchlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ movie_id: movieId }),
          });
          if (!res.ok) throw new Error("Failed");
        }
      } catch {
        // Rollback
        setWatchlistMovieIds((prev) => {
          const next = new Set(prev);
          if (wasOnWatchlist) next.add(movieId);
          else next.delete(movieId);
          return next;
        });
      }
    },
    [watchlistMovieIds]
  );
```

4. Update the `signOut` callback to clear watchlistMovieIds:

Add `setWatchlistMovieIds(new Set());` after `setLists([]);` in signOut.

5. Update the return to include `watchlistMovieIds`:

In the return object, change `bookmarks,` to `bookmarks: watchlistMovieIds,` so the existing `goblinUser.bookmarks.has(movieId)` checks in GoblinDayPage now check watchlist membership.

Also add `watchlistMovieIds,` to the return for explicit access.

- [ ] **Step 2: Update POST /api/goblinday/me/watchlist to accept movie_id directly**

In `web/app/api/goblinday/me/watchlist/route.ts`, update the POST handler to accept either `tmdb_id` or `movie_id`:

After `const { tmdb_id, note, tag_ids } = body;` add:
```typescript
  const movie_id_direct = body.movie_id;
```

Replace the validation:
```typescript
  if (!tmdb_id && !movie_id_direct) {
    return NextResponse.json({ error: "tmdb_id or movie_id required" }, { status: 400 });
  }
```

Replace the `ensureMovie` call block with:
```typescript
  let movieId: number;
  if (movie_id_direct) {
    // Direct movie_id — verify it exists
    const { data: existing } = await serviceClient
      .from("goblin_movies")
      .select("id")
      .eq("id", movie_id_direct)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: "Movie not found" }, { status: 404 });
    }
    movieId = (existing as { id: number }).id;
  } else {
    const movie = await ensureMovie(serviceClient, tmdb_id);
    if (!movie) {
      return NextResponse.json({ error: "Failed to find or create movie" }, { status: 500 });
    }
    movieId = movie.id;
  }
```

Then replace `movie_id: movie.id` with `movie_id: movieId` in the insert.

- [ ] **Step 3: Add Watchlist tab to GoblinDayPage**

In `web/components/goblin/GoblinDayPage.tsx`:

1. Add import at top:
```typescript
import GoblinWatchlistView from "./GoblinWatchlistView";
```

2. Update the `Tab` type (around line 19):
```typescript
type Tab = "next" | "contenders" | "upcoming" | "watched" | "watchlist" | "log";
```

3. Update `VALID_TABS` (around line 87):
```typescript
const VALID_TABS: Tab[] = ["next", "contenders", "upcoming", "watched", "watchlist", "log"];
```

4. Add "watchlist" to `TAB_CONFIG` array — insert before the "log" entry (around line 451):
```typescript
    { key: "watchlist" as const, label: "⌖ QUEUE", labelLong: "⌖ THE QUEUE", active: "bg-black text-amber-300 border-amber-500 shadow-[0_0_15px_rgba(255,217,61,0.2)]" },
```

5. Update the tab filter to show "watchlist" only when authenticated — in the `.filter()` call on TAB_CONFIG (around line 625), change:
```typescript
.filter((t) => t.key !== "log" || !!goblinUser.user)
```
to:
```typescript
.filter((t) => (t.key !== "log" && t.key !== "watchlist") || !!goblinUser.user)
```

6. Handle the "watchlist" case in the `filteredMovies` switch — in the switch at ~line 399, add before `case "log"`:
```typescript
        case "watchlist":
          return false; // Watchlist has its own data source
```

7. Add the watchlist view to the tab content. Find where the Log view is rendered (search for `{activeTab === "log" &&`). Before that block, add:
```typescript
      {activeTab === "watchlist" && (
        <div className="relative z-10 px-3 pt-6">
          <GoblinWatchlistView isAuthenticated={!!goblinUser.user} />
        </div>
      )}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add web/components/goblin/GoblinDayPage.tsx web/lib/hooks/useGoblinUser.ts web/app/api/goblinday/me/watchlist/route.ts
git commit -m "feat(goblin): integrate watchlist tab into GoblinDayPage and rewire bookmarks"
```

---

## Task 13: Browser Test

**Files:** None (verification only)

- [ ] **Step 1: Start dev server and verify**

Run: `cd /Users/coach/Projects/LostCity/web && npm run dev`

Navigate to `http://localhost:3000/goblinday` and verify:

1. The "QUEUE" tab appears between "WATCHED" and "THE LOG" when authenticated
2. Clicking the tab shows The Queue view with the amber/gold header
3. "+ ADD" button opens the TMDB search modal with amber accent
4. Searching for a movie and adding it works (movie appears in the list)
5. Drag-to-reorder works (grab a card and move it)
6. "WATCHED" button opens the Log It modal with emerald accent
7. Filling in the watched form and submitting moves the movie to The Log
8. Watchlist tags work (create, filter, delete)
9. Horror movie cards: bookmarking a movie adds it to the watchlist (SAVED badge)
10. Unbookmarking removes it from the watchlist

- [ ] **Step 2: Check TypeScript builds clean**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -u
git commit -m "fix(goblin): address watchlist integration issues from browser testing"
```
