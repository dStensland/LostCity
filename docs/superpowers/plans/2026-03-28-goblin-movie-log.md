# Goblin Movie Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a personal movie diary to Goblin Day — log any movie with date, notes, who you watched with, and tags. Shareable public page at `/goblinday/log/[username]`.

**Architecture:** Extends existing Goblin Day infrastructure. New tables for log entries and tags. Movies added via TMDB search reuse the `goblin_movies` table. Public log uses existing `profiles.username` as the URL slug (no new profile table). All mutations through API routes using `withAuth`.

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL + RLS), TMDB API, Tailwind v4, Framer Motion for animations.

**Spec:** `docs/superpowers/specs/2026-03-28-goblin-movie-log-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260328200000_goblin_movie_log.sql` | Schema: log entries, tags, join table, RLS, indexes |
| `web/app/api/goblinday/tmdb/search/route.ts` | TMDB search proxy (protects API key) |
| `web/app/api/goblinday/me/tags/route.ts` | Tag list + create (GET, POST) |
| `web/app/api/goblinday/me/tags/[id]/route.ts` | Tag update + delete (PATCH, DELETE) |
| `web/app/api/goblinday/me/log/route.ts` | Log entry list + create (GET, POST) |
| `web/app/api/goblinday/me/log/[id]/route.ts` | Log entry update + delete (PATCH, DELETE) |
| `web/app/api/goblinday/log/[slug]/route.ts` | Public log read (no auth) |
| `web/lib/goblin-log-utils.ts` | Tag color palette, date formatters, TMDB helpers |
| `web/lib/hooks/useGoblinLog.ts` | Client state for log entries + tags |
| `web/components/goblin/GoblinTagPicker.tsx` | Tag selection + inline creation widget |
| `web/components/goblin/GoblinAddMovieModal.tsx` | TMDB search + log entry form |
| `web/components/goblin/GoblinEditEntryModal.tsx` | Edit existing log entry |
| `web/components/goblin/GoblinLogEntryCard.tsx` | Individual entry in the poster grid |
| `web/components/goblin/GoblinLogView.tsx` | Main log tab: year picker, tag filter, poster grid |
| `web/app/goblinday/log/[slug]/page.tsx` | Public shareable log page |

### Modified Files

| File | Change |
|------|--------|
| `web/components/goblin/GoblinDayPage.tsx` | Add "My Log" tab, wire in GoblinLogView |
| `web/components/goblin/GoblinMovieCard.tsx` | Export `GoblinMovie` interface (already exported, no change needed) |
| `web/app/globals.css` | Add log-specific animations (stagger, poster flip, expand) |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260328200000_goblin_movie_log.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Goblin Movie Log: personal diary, tags, public sharing
-- Depends on: goblin_movies, auth.users

-- 1. Relax year constraint on goblin_movies so users can log older films
ALTER TABLE goblin_movies DROP CONSTRAINT IF EXISTS goblin_movies_year_check;
ALTER TABLE goblin_movies ALTER COLUMN year DROP NOT NULL;

-- 2. Tags (user's personal tag library)
CREATE TABLE goblin_tags (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text, -- hex color, auto-assigned if null
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

-- 3. Log entries (one per movie-watch event)
CREATE TABLE goblin_log_entries (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id integer NOT NULL REFERENCES goblin_movies(id),
  watched_date date NOT NULL,
  note text,
  watched_with text,
  sort_order integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Log entry <-> tag join table
CREATE TABLE goblin_log_entry_tags (
  entry_id integer NOT NULL REFERENCES goblin_log_entries(id) ON DELETE CASCADE,
  tag_id integer NOT NULL REFERENCES goblin_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, tag_id)
);

-- 5. Indexes
CREATE INDEX idx_goblin_log_entries_user_date ON goblin_log_entries(user_id, watched_date DESC);
CREATE INDEX idx_goblin_tags_user ON goblin_tags(user_id);

-- 6. RLS
ALTER TABLE goblin_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE goblin_log_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE goblin_log_entry_tags ENABLE ROW LEVEL SECURITY;

-- goblin_tags: owner CRUD, public read
CREATE POLICY "Users manage own tags" ON goblin_tags
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public read tags" ON goblin_tags
  FOR SELECT USING (true);

-- goblin_log_entries: owner CRUD, public read
CREATE POLICY "Users manage own log entries" ON goblin_log_entries
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public read log entries" ON goblin_log_entries
  FOR SELECT USING (true);

-- goblin_log_entry_tags: follows entry ownership, public read
CREATE POLICY "Users manage own entry tags" ON goblin_log_entry_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM goblin_log_entries
      WHERE id = entry_id AND user_id = auth.uid()
    )
  );
CREATE POLICY "Public read entry tags" ON goblin_log_entry_tags
  FOR SELECT USING (true);
```

- [ ] **Step 2: Apply the migration**

Run: `cd /Users/coach/Projects/LostCity && npx supabase db push`

If using remote Supabase (no local), just verify the SQL is syntactically valid and move on — it'll be applied on deploy.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260328200000_goblin_movie_log.sql
git commit -m "feat(schema): add goblin movie log tables — entries, tags, join table"
```

---

## Task 2: Utility Functions

**Files:**
- Create: `web/lib/goblin-log-utils.ts`

- [ ] **Step 1: Create the utils file**

```typescript
// Tag color palette — muted jewel tones that work on dark backgrounds
export const TAG_COLORS = [
  "#FF6B7A", // coral
  "#F59E0B", // amber
  "#34D399", // emerald
  "#38BDF8", // sky
  "#A78BFA", // violet
  "#FB7185", // rose
  "#2DD4BF", // teal
  "#FB923C", // orange
  "#A3E635", // lime
  "#E879F9", // fuchsia
  "#22D3EE", // cyan
  "#818CF8", // indigo
] as const;

/** Get the next tag color based on how many tags the user has */
export function getNextTagColor(existingCount: number): string {
  return TAG_COLORS[existingCount % TAG_COLORS.length];
}

/** Format a date as "Mar 15, 2026" */
export function formatWatchedDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00"); // avoid timezone shift
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Format a date as ISO "YYYY-MM-DD" for form inputs */
export function toISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/** TMDB image base URL */
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";
export const TMDB_POSTER_W500 = `${TMDB_IMAGE_BASE}/w500`;
export const TMDB_POSTER_W342 = `${TMDB_IMAGE_BASE}/w342`;
export const TMDB_POSTER_W185 = `${TMDB_IMAGE_BASE}/w185`;

/** Types */
export interface LogEntry {
  id: number;
  movie_id: number;
  watched_date: string;
  note: string | null;
  watched_with: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
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
  };
  tags: GoblinTag[];
}

export interface GoblinTag {
  id: number;
  name: string;
  color: string | null;
}

export interface TMDBSearchResult {
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  release_date: string | null;
  overview: string | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add web/lib/goblin-log-utils.ts
git commit -m "feat(goblin): add movie log utility functions and types"
```

---

## Task 3: TMDB Search API Route

**Files:**
- Create: `web/app/api/goblinday/tmdb/search/route.ts`

- [ ] **Step 1: Create the route**

```typescript
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

  const url = `${TMDB_BASE}/search/movie?api_key=${tmdbKey}&query=${encodeURIComponent(q)}&include_adult=false&language=en-US&page=1`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return NextResponse.json({ error: "TMDB search failed" }, { status: 502 });
    }

    const data = await res.json();

    const results = (data.results || []).slice(0, 20).map((m: any) => ({
      tmdb_id: m.id,
      title: m.title,
      poster_path: m.poster_path,
      release_date: m.release_date || null,
      overview: m.overview || null,
    }));

    return NextResponse.json({ results });
  } catch {
    clearTimeout(timeoutId);
    return NextResponse.json({ error: "TMDB request timed out" }, { status: 504 });
  }
});
```

- [ ] **Step 2: Verify route compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | grep -i "tmdb/search" || echo "No errors"`

- [ ] **Step 3: Commit**

```bash
git add web/app/api/goblinday/tmdb/search/route.ts
git commit -m "feat(goblin): add TMDB search proxy API route"
```

---

## Task 4: Tag CRUD API Routes

**Files:**
- Create: `web/app/api/goblinday/me/tags/route.ts`
- Create: `web/app/api/goblinday/me/tags/[id]/route.ts`

- [ ] **Step 1: Create the tag list + create route**

```typescript
// web/app/api/goblinday/me/tags/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { getNextTagColor } from "@/lib/goblin-log-utils";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_request: NextRequest, { user, serviceClient }) => {
  const { data, error } = await serviceClient
    .from("goblin_tags")
    .select("id, name, color, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
  }

  return NextResponse.json({ tags: data || [] });
});

export const POST = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  const body = await request.json();
  const name = body.name?.trim()?.toLowerCase();

  if (!name || name.length > 50) {
    return NextResponse.json({ error: "Tag name required (max 50 chars)" }, { status: 400 });
  }

  // Auto-assign color if not provided
  let color = body.color?.trim() || null;
  if (!color) {
    const { count } = await serviceClient
      .from("goblin_tags")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    color = getNextTagColor(count || 0);
  }

  const { data, error } = await serviceClient
    .from("goblin_tags")
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

- [ ] **Step 2: Create the tag update + delete route**

```typescript
// web/app/api/goblinday/me/tags/[id]/route.ts
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
      .from("goblin_tags")
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
      .from("goblin_tags")
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

- [ ] **Step 3: Verify routes compile**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | grep -i "tags" || echo "No errors"`

- [ ] **Step 4: Commit**

```bash
git add web/app/api/goblinday/me/tags/
git commit -m "feat(goblin): add tag CRUD API routes"
```

---

## Task 5: Log Entry CRUD API Routes

**Files:**
- Create: `web/app/api/goblinday/me/log/route.ts`
- Create: `web/app/api/goblinday/me/log/[id]/route.ts`

This is the most complex task — the POST route auto-inserts movies from TMDB if they don't exist in `goblin_movies`.

- [ ] **Step 1: Create log entry list + create route**

```typescript
// web/app/api/goblinday/me/log/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

const TMDB_BASE = "https://api.themoviedb.org/3";

export const GET = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  const year = request.nextUrl.searchParams.get("year");
  const tag = request.nextUrl.searchParams.get("tag");

  let query = serviceClient
    .from("goblin_log_entries")
    .select(`
      id, watched_date, note, watched_with, sort_order, created_at, updated_at,
      movie:goblin_movies!movie_id (
        id, tmdb_id, title, poster_path, backdrop_path, release_date, genres,
        runtime_minutes, director, year
      )
    `)
    .eq("user_id", user.id)
    .order("watched_date", { ascending: false });

  if (year) {
    query = query
      .gte("watched_date", `${year}-01-01`)
      .lte("watched_date", `${year}-12-31`);
  }

  const { data: entries, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to fetch log entries" }, { status: 500 });
  }

  // Fetch tags for all entries in one query
  const entryIds = (entries || []).map((e: any) => e.id);
  let entryTags: Record<number, { id: number; name: string; color: string | null }[]> = {};

  if (entryIds.length > 0) {
    const { data: tagRows } = await serviceClient
      .from("goblin_log_entry_tags")
      .select("entry_id, tag:goblin_tags!tag_id (id, name, color)")
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

  // If filtering by tag, filter client-side (simpler than a subquery)
  if (tag) {
    const filtered = result.filter((e: any) =>
      e.tags.some((t: any) => t.name === tag.toLowerCase())
    );
    return NextResponse.json({ entries: filtered });
  }

  return NextResponse.json({ entries: result });
});

/** Ensure a movie exists in goblin_movies by TMDB ID, fetching from TMDB if needed */
async function ensureMovie(
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

export const POST = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  const body = await request.json();
  const { tmdb_id, watched_date, note, watched_with, tag_ids } = body;

  if (!tmdb_id || !watched_date) {
    return NextResponse.json(
      { error: "tmdb_id and watched_date required" },
      { status: 400 }
    );
  }

  // Ensure movie exists in our DB
  const movie = await ensureMovie(serviceClient, tmdb_id);
  if (!movie) {
    return NextResponse.json({ error: "Failed to find or create movie" }, { status: 500 });
  }

  // Create log entry
  const { data: entry, error } = await serviceClient
    .from("goblin_log_entries")
    .insert({
      user_id: user.id,
      movie_id: movie.id,
      watched_date,
      note: note?.trim() || null,
      watched_with: watched_with?.trim() || null,
    } as never)
    .select("id, watched_date, note, watched_with, created_at")
    .single();

  if (error || !entry) {
    return NextResponse.json({ error: "Failed to create log entry" }, { status: 500 });
  }

  // Attach tags if provided
  if (tag_ids && tag_ids.length > 0) {
    const tagRows = tag_ids.map((tagId: number) => ({
      entry_id: (entry as any).id,
      tag_id: tagId,
    }));
    await serviceClient
      .from("goblin_log_entry_tags")
      .insert(tagRows as never);
  }

  return NextResponse.json({ entry }, { status: 201 });
});
```

- [ ] **Step 2: Create log entry update + delete route**

```typescript
// web/app/api/goblinday/me/log/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

export const PATCH = withAuthAndParams<{ id: string }>(
  async (request: NextRequest, { user, serviceClient, params }) => {
    const entryId = parseInt(params.id);
    if (isNaN(entryId)) {
      return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
    }

    // Verify ownership
    const { data: existing } = await serviceClient
      .from("goblin_log_entries")
      .select("id")
      .eq("id", entryId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.watched_date !== undefined) updates.watched_date = body.watched_date;
    if (body.note !== undefined) updates.note = body.note?.trim() || null;
    if (body.watched_with !== undefined) updates.watched_with = body.watched_with?.trim() || null;
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order;

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      await serviceClient
        .from("goblin_log_entries")
        .update(updates as never)
        .eq("id", entryId)
        .eq("user_id", user.id);
    }

    // Update tags if provided (replace all)
    if (body.tag_ids !== undefined) {
      await serviceClient
        .from("goblin_log_entry_tags")
        .delete()
        .eq("entry_id", entryId);

      if (body.tag_ids.length > 0) {
        const tagRows = body.tag_ids.map((tagId: number) => ({
          entry_id: entryId,
          tag_id: tagId,
        }));
        await serviceClient
          .from("goblin_log_entry_tags")
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
      .from("goblin_log_entries")
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

- [ ] **Step 3: Verify routes compile**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | grep -i "log" || echo "No errors"`

- [ ] **Step 4: Commit**

```bash
git add web/app/api/goblinday/me/log/
git commit -m "feat(goblin): add log entry CRUD API routes with TMDB auto-insert"
```

---

## Task 6: Public Log API Route

**Files:**
- Create: `web/app/api/goblinday/log/[slug]/route.ts`

- [ ] **Step 1: Create the public log route**

This uses `profiles.username` as the slug — no new profile table needed.

```typescript
// web/app/api/goblinday/log/[slug]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const serviceClient = createServiceClient();

  // Look up user by username
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("username", slug)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const year = request.nextUrl.searchParams.get("year") || new Date().getFullYear().toString();

  // Fetch log entries for the year
  const { data: entries, error } = await serviceClient
    .from("goblin_log_entries")
    .select(`
      id, watched_date, note, watched_with, sort_order,
      movie:goblin_movies!movie_id (
        id, tmdb_id, title, poster_path, backdrop_path, release_date, genres,
        runtime_minutes, director, year
      )
    `)
    .eq("user_id", (profile as any).id)
    .gte("watched_date", `${year}-01-01`)
    .lte("watched_date", `${year}-12-31`)
    .order("watched_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch log" }, { status: 500 });
  }

  // Fetch tags
  const entryIds = (entries || []).map((e: any) => e.id);
  let entryTags: Record<number, { id: number; name: string; color: string | null }[]> = {};

  if (entryIds.length > 0) {
    const { data: tagRows } = await serviceClient
      .from("goblin_log_entry_tags")
      .select("entry_id, tag:goblin_tags!tag_id (id, name, color)")
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

  return NextResponse.json({
    user: {
      username: (profile as any).username,
      display_name: (profile as any).display_name,
      avatar_url: (profile as any).avatar_url,
    },
    year: parseInt(year),
    entries: result,
    count: result.length,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/api/goblinday/log/
git commit -m "feat(goblin): add public log API route using profiles.username"
```

---

## Task 7: useGoblinLog Hook

**Files:**
- Create: `web/lib/hooks/useGoblinLog.ts`

- [ ] **Step 1: Create the hook**

```typescript
// web/lib/hooks/useGoblinLog.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import type { LogEntry, GoblinTag, TMDBSearchResult } from "@/lib/goblin-log-utils";

interface UseGoblinLogState {
  entries: LogEntry[];
  tags: GoblinTag[];
  loading: boolean;
  year: number;
}

interface UseGoblinLogActions {
  setYear: (year: number) => void;
  addEntry: (data: {
    tmdb_id: number;
    watched_date: string;
    note?: string;
    watched_with?: string;
    tag_ids?: number[];
  }) => Promise<boolean>;
  updateEntry: (
    entryId: number,
    data: Partial<{
      watched_date: string;
      note: string;
      watched_with: string;
      tag_ids: number[];
      sort_order: number;
    }>
  ) => Promise<boolean>;
  deleteEntry: (entryId: number) => Promise<boolean>;
  createTag: (name: string) => Promise<GoblinTag | null>;
  updateTag: (tagId: number, data: { name?: string; color?: string }) => Promise<boolean>;
  deleteTag: (tagId: number) => Promise<boolean>;
  searchTMDB: (query: string) => Promise<TMDBSearchResult[]>;
  refreshEntries: () => Promise<void>;
  refreshTags: () => Promise<void>;
}

export function useGoblinLog(
  isAuthenticated: boolean
): UseGoblinLogState & UseGoblinLogActions {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [tags, setTags] = useState<GoblinTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  const fetchEntries = useCallback(async (y: number) => {
    try {
      const res = await fetch(`/api/goblinday/me/log?year=${y}`);
      if (!res.ok) return;
      const data = await res.json();
      setEntries(data.entries || []);
    } catch {
      // Non-critical
    }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch("/api/goblinday/me/tags");
      if (!res.ok) return;
      const data = await res.json();
      setTags(data.tags || []);
    } catch {
      // Non-critical
    }
  }, []);

  // Fetch on mount + year change
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([fetchEntries(year), fetchTags()]).finally(() =>
      setLoading(false)
    );
  }, [isAuthenticated, year, fetchEntries, fetchTags]);

  const addEntry = useCallback(
    async (data: {
      tmdb_id: number;
      watched_date: string;
      note?: string;
      watched_with?: string;
      tag_ids?: number[];
    }) => {
      try {
        const res = await fetch("/api/goblinday/me/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) return false;
        await fetchEntries(year);
        return true;
      } catch {
        return false;
      }
    },
    [year, fetchEntries]
  );

  const updateEntry = useCallback(
    async (entryId: number, data: any) => {
      try {
        const res = await fetch(`/api/goblinday/me/log/${entryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) return false;
        await fetchEntries(year);
        return true;
      } catch {
        return false;
      }
    },
    [year, fetchEntries]
  );

  const deleteEntry = useCallback(
    async (entryId: number) => {
      // Optimistic removal
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
      try {
        const res = await fetch(`/api/goblinday/me/log/${entryId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          await fetchEntries(year); // rollback
          return false;
        }
        return true;
      } catch {
        await fetchEntries(year);
        return false;
      }
    },
    [year, fetchEntries]
  );

  const createTag = useCallback(
    async (name: string): Promise<GoblinTag | null> => {
      try {
        const res = await fetch("/api/goblinday/me/tags", {
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

  const updateTag = useCallback(
    async (tagId: number, data: { name?: string; color?: string }) => {
      try {
        const res = await fetch(`/api/goblinday/me/tags/${tagId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) return false;
        await fetchTags();
        return true;
      } catch {
        return false;
      }
    },
    [fetchTags]
  );

  const deleteTag = useCallback(
    async (tagId: number) => {
      setTags((prev) => prev.filter((t) => t.id !== tagId));
      try {
        const res = await fetch(`/api/goblinday/me/tags/${tagId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          await fetchTags();
          return false;
        }
        // Also refresh entries since tag associations were removed
        await fetchEntries(year);
        return true;
      } catch {
        await fetchTags();
        return false;
      }
    },
    [fetchTags, fetchEntries, year]
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
    year,
    setYear,
    addEntry,
    updateEntry,
    deleteEntry,
    createTag,
    updateTag,
    deleteTag,
    searchTMDB,
    refreshEntries: useCallback(() => fetchEntries(year), [fetchEntries, year]),
    refreshTags: fetchTags,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add web/lib/hooks/useGoblinLog.ts
git commit -m "feat(goblin): add useGoblinLog hook for log + tag state management"
```

---

## Task 8: GoblinTagPicker Component

**Files:**
- Create: `web/components/goblin/GoblinTagPicker.tsx`

- [ ] **Step 1: Create the component**

A compact tag picker that shows existing tags as toggleable pills with a "+" button to create new ones inline.

```typescript
// web/components/goblin/GoblinTagPicker.tsx
"use client";

import { useState, useRef } from "react";
import type { GoblinTag } from "@/lib/goblin-log-utils";

interface Props {
  tags: GoblinTag[];
  selectedIds: number[];
  onToggle: (tagId: number) => void;
  onCreate: (name: string) => Promise<GoblinTag | null>;
}

export default function GoblinTagPicker({ tags, selectedIds, onToggle, onCreate }: Props) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCreate = async () => {
    const name = newName.trim().toLowerCase();
    if (!name || creating) return;
    setCreating(true);
    const tag = await onCreate(name);
    if (tag) {
      onToggle(tag.id); // auto-select the newly created tag
    }
    setNewName("");
    setIsCreating(false);
    setCreating(false);
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => {
        const isSelected = selectedIds.includes(tag.id);
        return (
          <button
            key={tag.id}
            onClick={() => onToggle(tag.id)}
            className="px-2.5 py-1 rounded-full text-xs font-mono font-medium
              border transition-all duration-200"
            style={{
              backgroundColor: isSelected ? `${tag.color}20` : "transparent",
              borderColor: isSelected ? `${tag.color}60` : "var(--twilight)",
              color: isSelected ? tag.color || "var(--cream)" : "var(--soft)",
              boxShadow: isSelected ? `0 0 8px ${tag.color}15` : "none",
            }}
          >
            {tag.name}
          </button>
        );
      })}

      {isCreating ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
          className="flex items-center gap-1"
        >
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="tag name"
            maxLength={50}
            autoFocus
            className="w-24 px-2 py-1 rounded-full text-xs font-mono
              bg-[var(--dusk)] border border-[var(--twilight)]
              text-[var(--cream)] placeholder:text-[var(--muted)]
              focus:outline-none focus:border-[var(--coral)]"
            onBlur={() => {
              if (!newName.trim()) setIsCreating(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setNewName("");
                setIsCreating(false);
              }
            }}
          />
        </form>
      ) : (
        <button
          onClick={() => {
            setIsCreating(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="px-2.5 py-1 rounded-full text-xs font-mono
            border border-dashed border-[var(--twilight)] text-[var(--muted)]
            hover:border-[var(--soft)] hover:text-[var(--soft)] transition-colors"
        >
          + tag
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/goblin/GoblinTagPicker.tsx
git commit -m "feat(goblin): add GoblinTagPicker component"
```

---

## Task 9: GoblinAddMovieModal Component

**Files:**
- Create: `web/components/goblin/GoblinAddMovieModal.tsx`

- [ ] **Step 1: Create the component**

Modal with TMDB search, movie selection, and log entry form.

```typescript
// web/components/goblin/GoblinAddMovieModal.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import SmartImage from "@/components/SmartImage";
import GoblinTagPicker from "./GoblinTagPicker";
import {
  toISODate,
  TMDB_POSTER_W185,
  type TMDBSearchResult,
  type GoblinTag,
} from "@/lib/goblin-log-utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    tmdb_id: number;
    watched_date: string;
    note?: string;
    watched_with?: string;
    tag_ids?: number[];
  }) => Promise<boolean>;
  searchTMDB: (query: string) => Promise<TMDBSearchResult[]>;
  tags: GoblinTag[];
  onCreateTag: (name: string) => Promise<GoblinTag | null>;
}

export default function GoblinAddMovieModal({
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
  const [watchedDate, setWatchedDate] = useState(toISODate(new Date()));
  const [note, setNote] = useState("");
  const [watchedWith, setWatchedWith] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus search input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      // Reset state on close
      setQuery("");
      setResults([]);
      setSelected(null);
      setNote("");
      setWatchedWith("");
      setSelectedTagIds([]);
      setWatchedDate(toISODate(new Date()));
    }
  }, [open]);

  // Debounced TMDB search
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

  // Escape to close
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
      watched_date: watchedDate,
      note: note.trim() || undefined,
      watched_with: watchedWith.trim() || undefined,
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
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full
            hover:bg-[var(--twilight)] transition-colors
            flex items-center justify-center text-[var(--muted)]"
        >
          ✕
        </button>

        <h2 className="text-xl font-semibold text-[var(--cream)] mb-6">
          Log a Movie
        </h2>

        {!selected ? (
          /* Search phase */
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
                focus:outline-none focus:border-[var(--coral)] transition-colors"
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
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--cream)] truncate
                      group-hover:text-[var(--coral)] transition-colors">
                      {movie.title}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {movie.release_date?.split("-")[0] || "Unknown year"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          /* Entry form phase */
          <>
            {/* Selected movie header */}
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
                  focus:outline-none focus:border-[var(--coral)] transition-colors"
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
                  focus:outline-none focus:border-[var(--coral)] transition-colors"
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
                  focus:outline-none focus:border-[var(--coral)] transition-colors"
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
                className="flex-1 py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-lg
                  font-mono text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {submitting ? "Adding..." : "Add to Log"}
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

- [ ] **Step 2: Commit**

```bash
git add web/components/goblin/GoblinAddMovieModal.tsx
git commit -m "feat(goblin): add movie modal — TMDB search + log entry form"
```

---

## Task 10: GoblinEditEntryModal Component

**Files:**
- Create: `web/components/goblin/GoblinEditEntryModal.tsx`

- [ ] **Step 1: Create the component**

Pre-filled form for editing an existing log entry.

```typescript
// web/components/goblin/GoblinEditEntryModal.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import SmartImage from "@/components/SmartImage";
import GoblinTagPicker from "./GoblinTagPicker";
import { TMDB_POSTER_W185, formatWatchedDate, type LogEntry, type GoblinTag } from "@/lib/goblin-log-utils";

interface Props {
  entry: LogEntry | null;
  open: boolean;
  onClose: () => void;
  onSave: (
    entryId: number,
    data: {
      watched_date?: string;
      note?: string;
      watched_with?: string;
      tag_ids?: number[];
    }
  ) => Promise<boolean>;
  onDelete: (entryId: number) => Promise<boolean>;
  tags: GoblinTag[];
  onCreateTag: (name: string) => Promise<GoblinTag | null>;
}

export default function GoblinEditEntryModal({
  entry,
  open,
  onClose,
  onSave,
  onDelete,
  tags,
  onCreateTag,
}: Props) {
  const [watchedDate, setWatchedDate] = useState("");
  const [note, setNote] = useState("");
  const [watchedWith, setWatchedWith] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Populate form when entry changes
  useEffect(() => {
    if (entry) {
      setWatchedDate(entry.watched_date);
      setNote(entry.note || "");
      setWatchedWith(entry.watched_with || "");
      setSelectedTagIds(entry.tags.map((t) => t.id));
      setConfirmDelete(false);
    }
  }, [entry]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const toggleTag = useCallback((tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }, []);

  const handleSave = async () => {
    if (!entry || submitting) return;
    setSubmitting(true);
    const success = await onSave(entry.id, {
      watched_date: watchedDate,
      note: note.trim() || undefined,
      watched_with: watchedWith.trim() || undefined,
      tag_ids: selectedTagIds,
    });
    setSubmitting(false);
    if (success) onClose();
  };

  const handleDelete = async () => {
    if (!entry || submitting) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSubmitting(true);
    const success = await onDelete(entry.id);
    setSubmitting(false);
    if (success) onClose();
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
          Edit Entry
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
            <p className="text-base font-semibold text-[var(--cream)]">{movie.title}</p>
            <p className="text-xs text-[var(--muted)]">{movie.year || ""}</p>
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
              focus:outline-none focus:border-[var(--coral)] transition-colors"
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
              focus:outline-none focus:border-[var(--coral)] transition-colors"
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
              focus:outline-none focus:border-[var(--coral)] transition-colors"
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
            onClick={handleDelete}
            disabled={submitting}
            className={`py-2.5 px-4 rounded-lg font-mono text-sm transition-colors ${
              confirmDelete
                ? "bg-red-500/20 text-red-400 border border-red-500/40"
                : "text-[var(--muted)] hover:text-red-400"
            }`}
          >
            {confirmDelete ? "Confirm Delete" : "Delete"}
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="py-2.5 px-4 bg-[var(--twilight)] text-[var(--cream)] rounded-lg
              font-mono text-sm hover:bg-[var(--dusk)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={submitting}
            className="py-2.5 px-4 bg-[var(--coral)] text-[var(--void)] rounded-lg
              font-mono text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/goblin/GoblinEditEntryModal.tsx
git commit -m "feat(goblin): add edit entry modal with delete confirmation"
```

---

## Task 11: GoblinLogEntryCard Component

**Files:**
- Create: `web/components/goblin/GoblinLogEntryCard.tsx`

- [ ] **Step 1: Create the component**

Poster-forward card with hover animations, tag pills, note preview.

```typescript
// web/components/goblin/GoblinLogEntryCard.tsx
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
        <div
          className="mt-2 px-0.5 animate-fade-in"
        >
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
```

- [ ] **Step 2: Commit**

```bash
git add web/components/goblin/GoblinLogEntryCard.tsx
git commit -m "feat(goblin): add log entry card — poster grid item with animations"
```

---

## Task 12: GoblinLogView (Main Tab Component)

**Files:**
- Create: `web/components/goblin/GoblinLogView.tsx`

- [ ] **Step 1: Create the component**

The main log view with year picker, tag filter, poster grid, and add button.

```typescript
// web/components/goblin/GoblinLogView.tsx
"use client";

import { useState, useMemo } from "react";
import { useGoblinLog } from "@/lib/hooks/useGoblinLog";
import GoblinLogEntryCard from "./GoblinLogEntryCard";
import GoblinAddMovieModal from "./GoblinAddMovieModal";
import GoblinEditEntryModal from "./GoblinEditEntryModal";
import type { LogEntry } from "@/lib/goblin-log-utils";

interface Props {
  isAuthenticated: boolean;
}

const YEARS = Array.from(
  { length: new Date().getFullYear() - 2024 + 1 },
  (_, i) => new Date().getFullYear() - i
);

export default function GoblinLogView({ isAuthenticated }: Props) {
  const {
    entries,
    tags,
    loading,
    year,
    setYear,
    addEntry,
    updateEntry,
    deleteEntry,
    createTag,
    searchTMDB,
  } = useGoblinLog(isAuthenticated);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<LogEntry | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const filteredEntries = useMemo(() => {
    if (!activeTag) return entries;
    return entries.filter((e) => e.tags.some((t) => t.name === activeTag));
  }, [entries, activeTag]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <p className="text-[var(--muted)] font-mono text-sm text-center">
          Sign in to start logging movies
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-0">
      {/* Header row: year pills + add button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {YEARS.map((y) => (
            <button
              key={y}
              onClick={() => {
                setYear(y);
                setActiveTag(null);
              }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full font-mono text-xs font-medium
                border transition-all duration-200 ${
                  y === year
                    ? "bg-[var(--coral)]/15 border-[var(--coral)]/40 text-[var(--coral)]"
                    : "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--soft)]"
                }`}
            >
              {y}
            </button>
          ))}
        </div>

        <button
          onClick={() => setAddModalOpen(true)}
          className="flex-shrink-0 ml-3 px-4 py-1.5 rounded-full
            bg-[var(--coral)] text-[var(--void)]
            font-mono text-xs font-medium
            hover:brightness-110 active:scale-95 transition-all"
        >
          + Log Movie
        </button>
      </div>

      {/* Tag filter strip */}
      {tags.length > 0 && (
        <div className="flex items-center gap-1.5 mb-4 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTag(null)}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full font-mono text-xs
              border transition-all duration-200 ${
                !activeTag
                  ? "border-[var(--soft)]/40 text-[var(--cream)]"
                  : "border-[var(--twilight)] text-[var(--muted)]"
              }`}
          >
            All
          </button>
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => setActiveTag(activeTag === tag.name ? null : tag.name)}
              className="flex-shrink-0 px-2.5 py-1 rounded-full font-mono text-xs
                border transition-all duration-200"
              style={{
                backgroundColor: activeTag === tag.name ? `${tag.color}20` : "transparent",
                borderColor: activeTag === tag.name ? `${tag.color}60` : "var(--twilight)",
                color: activeTag === tag.name ? tag.color || "var(--cream)" : "var(--muted)",
              }}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}

      {/* Count */}
      <p className="text-xs text-[var(--muted)] font-mono mb-4">
        {filteredEntries.length} movie{filteredEntries.length !== 1 ? "s" : ""} in {year}
        {activeTag && ` tagged "${activeTag}"`}
      </p>

      {/* Loading state */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[2/3] rounded-lg bg-[var(--twilight)]/40" />
              <div className="mt-2 h-3 bg-[var(--twilight)]/40 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-[var(--muted)] font-mono text-sm text-center mb-4">
            {activeTag
              ? `No movies tagged "${activeTag}" in ${year}`
              : `No movies logged in ${year} yet`}
          </p>
          {!activeTag && (
            <button
              onClick={() => setAddModalOpen(true)}
              className="px-4 py-2 rounded-lg border border-dashed border-[var(--twilight)]
                text-[var(--soft)] font-mono text-sm
                hover:border-[var(--coral)] hover:text-[var(--coral)] transition-colors"
            >
              Log your first movie
            </button>
          )}
        </div>
      ) : (
        /* Poster grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredEntries.map((entry, i) => (
            <GoblinLogEntryCard
              key={entry.id}
              entry={entry}
              index={i}
              onEdit={setEditEntry}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <GoblinAddMovieModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSubmit={addEntry}
        searchTMDB={searchTMDB}
        tags={tags}
        onCreateTag={createTag}
      />

      <GoblinEditEntryModal
        entry={editEntry}
        open={editEntry !== null}
        onClose={() => setEditEntry(null)}
        onSave={updateEntry}
        onDelete={deleteEntry}
        tags={tags}
        onCreateTag={createTag}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/goblin/GoblinLogView.tsx
git commit -m "feat(goblin): add GoblinLogView — year picker, tag filters, poster grid"
```

---

## Task 13: Wire Log Tab into GoblinDayPage

**Files:**
- Modify: `web/components/goblin/GoblinDayPage.tsx`

- [ ] **Step 1: Add the "My Log" tab**

Add a new tab type and import:

At the top of the file, add the import:
```typescript
import GoblinLogView from "./GoblinLogView";
```

Update the `Tab` type:
```typescript
type Tab = "next" | "contenders" | "upcoming" | "watched" | "log";
```

Add to the tab config array (after the "watched" entry):
```typescript
{
  key: "log",
  label: "📓 MY LOG",
  labelLong: "📓 MY LOG",
  active: "bg-zinc-900 text-amber-400 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)]",
},
```

- [ ] **Step 2: Add the log view render case**

In the tab content rendering section (where each tab's content is conditionally rendered), add a case for the "log" tab:

```typescript
{tab === "log" && (
  <GoblinLogView isAuthenticated={!!user} />
)}
```

This should be placed alongside the existing tab content blocks. The log tab should only show in the tab strip when the user is authenticated — wrap the tab config entry with a filter:

```typescript
const visibleTabs = TAB_CONFIG.filter(
  (t) => t.key !== "log" || !!user
);
```

Then use `visibleTabs` instead of `TAB_CONFIG` when rendering the tab buttons.

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add web/components/goblin/GoblinDayPage.tsx
git commit -m "feat(goblin): wire My Log tab into GoblinDayPage"
```

---

## Task 14: Public Log Page

**Files:**
- Create: `web/app/goblinday/log/[slug]/page.tsx`

- [ ] **Step 1: Create the public log page**

Server-rendered page that fetches log data and renders a clean poster grid.

```typescript
// web/app/goblinday/log/[slug]/page.tsx
import { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";
import GoblinLogPublicView from "./GoblinLogPublicView";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ year?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `${slug}'s Movie Log — Goblin Day`,
    description: `Movies watched by ${slug}`,
    openGraph: {
      title: `${slug}'s Movie Log`,
      description: `Check out what ${slug} has been watching`,
    },
  };
}

export default async function PublicLogPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { year } = await searchParams;
  const currentYear = year || new Date().getFullYear().toString();

  const serviceClient = createServiceClient();

  // Look up user
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("username", slug)
    .maybeSingle();

  if (!profile) {
    return (
      <main className="min-h-screen bg-[var(--void)] flex items-center justify-center">
        <p className="text-[var(--muted)] font-mono text-sm">User not found</p>
      </main>
    );
  }

  // Fetch entries
  const { data: entries } = await serviceClient
    .from("goblin_log_entries")
    .select(`
      id, watched_date, note, watched_with, sort_order,
      movie:goblin_movies!movie_id (
        id, tmdb_id, title, poster_path, backdrop_path, release_date, genres,
        runtime_minutes, director, year
      )
    `)
    .eq("user_id", (profile as any).id)
    .gte("watched_date", `${currentYear}-01-01`)
    .lte("watched_date", `${currentYear}-12-31`)
    .order("watched_date", { ascending: false });

  // Fetch tags
  const entryIds = (entries || []).map((e: any) => e.id);
  let entryTags: Record<number, any[]> = {};

  if (entryIds.length > 0) {
    const { data: tagRows } = await serviceClient
      .from("goblin_log_entry_tags")
      .select("entry_id, tag:goblin_tags!tag_id (id, name, color)")
      .in("entry_id", entryIds);

    for (const row of tagRows || []) {
      const r = row as any;
      if (!entryTags[r.entry_id]) entryTags[r.entry_id] = [];
      if (r.tag) entryTags[r.entry_id].push(r.tag);
    }
  }

  const logEntries = (entries || []).map((e: any) => ({
    ...e,
    tags: entryTags[e.id] || [],
  }));

  return (
    <GoblinLogPublicView
      user={{
        username: (profile as any).username,
        displayName: (profile as any).display_name,
        avatarUrl: (profile as any).avatar_url,
      }}
      entries={logEntries}
      year={parseInt(currentYear)}
    />
  );
}
```

- [ ] **Step 2: Create the public view client component**

```typescript
// web/app/goblinday/log/[slug]/GoblinLogPublicView.tsx
"use client";

import { useRouter, usePathname } from "next/navigation";
import GoblinLogEntryCard from "@/components/goblin/GoblinLogEntryCard";
import SmartImage from "@/components/SmartImage";
import type { LogEntry } from "@/lib/goblin-log-utils";

interface Props {
  user: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  entries: LogEntry[];
  year: number;
}

const YEARS = Array.from(
  { length: new Date().getFullYear() - 2024 + 1 },
  (_, i) => new Date().getFullYear() - i
);

export default function GoblinLogPublicView({ user, entries, year }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-[var(--void)]">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          {user.avatarUrl && (
            <SmartImage
              src={user.avatarUrl}
              alt=""
              width={40}
              height={40}
              className="rounded-full"
            />
          )}
          <div>
            <h1 className="text-2xl font-semibold text-[var(--cream)]">
              {user.displayName || user.username}
            </h1>
            <p className="text-xs text-[var(--muted)] font-mono">Movie Log</p>
          </div>
        </div>

        {/* Year pills */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide">
          {YEARS.map((y) => (
            <button
              key={y}
              onClick={() => router.push(`${pathname}?year=${y}`)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full font-mono text-xs font-medium
                border transition-all duration-200 ${
                  y === year
                    ? "bg-[var(--coral)]/15 border-[var(--coral)]/40 text-[var(--coral)]"
                    : "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--soft)]"
                }`}
            >
              {y}
            </button>
          ))}
        </div>

        {/* Count */}
        <p className="text-xs text-[var(--muted)] font-mono mb-6">
          {entries.length} movie{entries.length !== 1 ? "s" : ""} in {year}
        </p>

        {/* Grid */}
        {entries.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {entries.map((entry, i) => (
              <GoblinLogEntryCard
                key={entry.id}
                entry={entry}
                index={i}
                onEdit={() => {}}
                readOnly
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-20">
            <p className="text-[var(--muted)] font-mono text-sm">
              No movies logged in {year}
            </p>
          </div>
        )}

        {/* Footer link */}
        <div className="mt-12 text-center">
          <a
            href="/goblinday"
            className="text-xs text-[var(--muted)] font-mono hover:text-[var(--coral)] transition-colors"
          >
            Goblin Day on Lost City
          </a>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add web/app/goblinday/log/
git commit -m "feat(goblin): add public shareable movie log page"
```

---

## Task 15: Animations + Polish

**Files:**
- Modify: `web/app/globals.css`

- [ ] **Step 1: Add log-specific animations to globals.css**

Append these keyframes and utilities at the end of the animations section (near the existing `@keyframes fadeIn` and `@keyframes slideUp`):

```css
/* Goblin Log: poster entrance with scale */
@keyframes posterEnter {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.92);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Goblin Log: entry removal */
@keyframes posterExit {
  to {
    opacity: 0;
    transform: scale(0.9);
  }
}

/* Goblin Log: year crossfade */
@keyframes gridFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

Note: The existing `.animate-slide-up` and `.animate-fade-in` classes are already defined in globals.css and used by the log entry cards. No additional utility classes needed — the staggered `animationDelay` is applied inline in `GoblinLogEntryCard`.

- [ ] **Step 2: Commit**

```bash
git add web/app/globals.css
git commit -m "feat(goblin): add poster entrance/exit animations for movie log"
```

---

## Task 16: Type Check + Manual Smoke Test

- [ ] **Step 1: Full type check**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`

Fix any type errors. Common issues:
- Supabase join types may need `as any` casts on nested selects
- `withAuthAndParams` generic param type must match the route segment name

- [ ] **Step 2: Dev server smoke test**

Run: `cd /Users/coach/Projects/LostCity/web && npm run dev`

Test:
1. Navigate to `/goblinday` — verify "My Log" tab appears when logged in
2. Click "My Log" — verify empty state renders
3. Click "Log Movie" — verify modal opens, TMDB search works
4. Search for a movie, fill in fields, submit — verify entry appears in grid
5. Click entry poster — verify edit modal opens with pre-filled values
6. Edit fields and save — verify changes persist
7. Navigate to `/goblinday/log/{your-username}` — verify public page renders
8. Check mobile viewport (375px) — verify grid is 2 columns, no overflow

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(goblin): complete movie log — TMDB search, tags, public sharing"
```
