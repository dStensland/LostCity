# Goblin Day User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-user auth, personal lists, and collaborative sessions with planning/live phases to Goblin Day.

**Architecture:** Database migration adds user-scoped tables (`goblin_user_movies`, `goblin_lists`, `goblin_session_members`) and modifies sessions to support `status` lifecycle and `invite_code`. API routes use existing `withAuth`/`withOptionalAuth` wrappers from `lib/api-middleware.ts`. Frontend adds login bar, personal list tab, planning view, and join page while preserving the existing horror aesthetic.

**Tech Stack:** Next.js 16, Supabase (auth + DB), TypeScript, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-26-goblin-day-user-management-design.md`

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260326300000_goblin_user_management.sql`

This single migration handles all schema changes: new tables, modified columns, data migration, and column drops.

- [ ] **Step 1: Write the migration file**

```sql
-- ============================================================
-- Goblin Day User Management Migration
-- Adds per-user movie state, named lists, session members,
-- and planning/live/ended session lifecycle.
-- ============================================================

-- 1. New table: goblin_user_movies (per-user movie state)
CREATE TABLE goblin_user_movies (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id integer NOT NULL REFERENCES goblin_movies(id) ON DELETE CASCADE,
  bookmarked boolean NOT NULL DEFAULT false,
  watched boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, movie_id)
);

ALTER TABLE goblin_user_movies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own movie state"
  ON goblin_user_movies FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Public read so session members can see each other's watched/bookmarked
CREATE POLICY "Public read for goblin_user_movies"
  ON goblin_user_movies FOR SELECT
  USING (true);

-- 2. New table: goblin_lists (named custom lists)
CREATE TABLE goblin_lists (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE goblin_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own lists"
  ON goblin_lists FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public read for goblin_lists"
  ON goblin_lists FOR SELECT
  USING (true);

-- 3. New table: goblin_list_movies (list-to-movie join)
CREATE TABLE goblin_list_movies (
  list_id integer NOT NULL REFERENCES goblin_lists(id) ON DELETE CASCADE,
  movie_id integer NOT NULL REFERENCES goblin_movies(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, movie_id)
);

ALTER TABLE goblin_list_movies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own list movies"
  ON goblin_list_movies FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM goblin_lists
      WHERE goblin_lists.id = goblin_list_movies.list_id
        AND goblin_lists.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM goblin_lists
      WHERE goblin_lists.id = goblin_list_movies.list_id
        AND goblin_lists.user_id = auth.uid()
    )
  );

CREATE POLICY "Public read for goblin_list_movies"
  ON goblin_list_movies FOR SELECT
  USING (true);

-- 4. New table: goblin_session_members
CREATE TABLE goblin_session_members (
  id serial PRIMARY KEY,
  session_id integer NOT NULL REFERENCES goblin_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('host', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);

ALTER TABLE goblin_session_members ENABLE ROW LEVEL SECURITY;

-- Members can see their session's members
CREATE POLICY "Session members can read"
  ON goblin_session_members FOR SELECT
  USING (true);

-- Auth'd users can insert (joining via invite code is validated in API)
CREATE POLICY "Auth'd users can join sessions"
  ON goblin_session_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. Modify goblin_sessions: add status, invite_code, created_by
ALTER TABLE goblin_sessions
  ADD COLUMN created_by uuid REFERENCES auth.users(id),
  ADD COLUMN invite_code text,
  ADD COLUMN status text NOT NULL DEFAULT 'ended' CHECK (status IN ('planning', 'live', 'ended'));

-- Backfill status from is_active
UPDATE goblin_sessions SET status = CASE WHEN is_active THEN 'live' ELSE 'ended' END;

-- Generate invite codes for existing sessions (8-char random)
UPDATE goblin_sessions
SET invite_code = substr(md5(random()::text || id::text), 1, 8)
WHERE invite_code IS NULL;

-- Now make invite_code NOT NULL + UNIQUE
ALTER TABLE goblin_sessions
  ALTER COLUMN invite_code SET NOT NULL,
  ADD CONSTRAINT goblin_sessions_invite_code_unique UNIQUE (invite_code);

-- Drop is_active (replaced by status)
ALTER TABLE goblin_sessions DROP COLUMN is_active;

-- 6. Modify goblin_session_movies: add proposed_by
ALTER TABLE goblin_session_movies
  ADD COLUMN proposed_by uuid REFERENCES auth.users(id);

-- 7. Modify goblin_timeline: add user_id
ALTER TABLE goblin_timeline
  ADD COLUMN user_id uuid REFERENCES auth.users(id);

-- 8. Add 'movie_proposed' to timeline event types
-- (No constraint to update — event_type is free text)

-- 9. Index for invite code lookups
CREATE INDEX idx_goblin_sessions_invite_code ON goblin_sessions(invite_code);

-- 10. Index for user movie state lookups
CREATE INDEX idx_goblin_user_movies_user ON goblin_user_movies(user_id);

-- 11. Drop legacy columns from goblin_movies
-- (Data migration for Daniel's account is a separate runtime step — see Step 2 below)
ALTER TABLE goblin_movies
  DROP COLUMN IF EXISTS proposed,
  DROP COLUMN IF EXISTS watched,
  DROP COLUMN IF EXISTS daniel_list,
  DROP COLUMN IF EXISTS ashley_list;
```

- [ ] **Step 2: Migrate Daniel's movie state before dropping columns**

Before applying the migration, we need to capture Daniel's current `proposed`/`watched`/`daniel_list` flags and insert them into `goblin_user_movies` after the new table exists but before the old columns are dropped. The migration handles this atomically since the DROP is at the end.

After the migration runs, connect to the database and run this one-time data migration (replace `DANIEL_USER_ID` with the actual UUID from the profiles table):

```sql
-- Find Daniel's user ID
SELECT id, display_name, email FROM auth.users WHERE email LIKE '%daniel%' LIMIT 5;

-- Insert his movie state (run before DROP takes effect — or query a backup)
-- This should be done BEFORE the migration if the DROP is in the same migration.
-- Alternative: split into two migrations (create tables first, drop columns second).
```

**Practical approach:** Split the DROP COLUMN statements into a separate follow-up migration (`20260326300001_goblin_drop_legacy_columns.sql`) that runs AFTER the data migration script. This way:
1. Migration 300000 creates new tables + adds columns + backfills session status
2. A one-time script migrates Daniel's flags to `goblin_user_movies`
3. Migration 300001 drops the old columns

- [ ] **Step 3: Apply the migration locally**

Run: `cd /Users/coach/Projects/LostCity && npx supabase db push`
Expected: Migration applies successfully, no errors.

- [ ] **Step 3: Verify schema**

Run: `cd /Users/coach/Projects/LostCity && npx supabase db dump --schema public | grep -E "goblin_user_movies|goblin_lists|goblin_session_members|invite_code|status.*planning"`
Expected: See all new tables and columns.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260326300000_goblin_user_management.sql
git commit -m "feat(goblin): add user management schema — user_movies, lists, session_members, invite codes"
```

---

### Task 2: Fix Vanity Domain Middleware

**Files:**
- Modify: `web/middleware.ts:66-82` (the vanity domain rewrite block)

The current middleware rewrites ALL paths on `goblinday.com` to `/goblinday/*`, breaking `/api/*` and `/auth/*` routes.

- [ ] **Step 1: Update the vanity domain rewrite to exclude API and auth paths**

In `web/middleware.ts`, replace the vanity domain rewrite block:

```typescript
  // --- Vanity domain rewrites ---
  // e.g., goblinday.com → serve /goblinday content at the root
  const hostname = host.split(":")[0];
  const vanityPath = VANITY_DOMAINS[hostname];
  if (vanityPath) {
    const url = request.nextUrl.clone();
    // Don't rewrite API, auth, or Next.js internal paths — they must resolve to their real paths
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) {
      return NextResponse.next();
    }
    // Rewrite root and all sub-paths under the vanity path
    if (url.pathname === "/" || url.pathname === "") {
      url.pathname = vanityPath;
    } else {
      url.pathname = `${vanityPath}${url.pathname}`;
    }
    return NextResponse.rewrite(url);
  }
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add web/middleware.ts
git commit -m "fix(goblin): exclude /api and /auth from vanity domain rewrite"
```

---

### Task 3: Personal Movie State API

**Files:**
- Create: `web/app/api/goblinday/me/route.ts`
- Create: `web/app/api/goblinday/me/bookmarks/route.ts`

- [ ] **Step 1: Create GET /api/goblinday/me**

Create `web/app/api/goblinday/me/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_request, { user, serviceClient }) => {
  const { data: userMovies, error: umError } = await serviceClient
    .from("goblin_user_movies")
    .select("movie_id, bookmarked, watched")
    .eq("user_id", user.id);

  if (umError) {
    return NextResponse.json({ error: "Failed to fetch user movies" }, { status: 500 });
  }

  const bookmarks = (userMovies || []).filter((m: { bookmarked: boolean }) => m.bookmarked).map((m: { movie_id: number }) => m.movie_id);
  const watched = (userMovies || []).filter((m: { watched: boolean }) => m.watched).map((m: { movie_id: number }) => m.movie_id);

  const { data: lists, error: listsError } = await serviceClient
    .from("goblin_lists")
    .select("id, name, goblin_list_movies(movie_id)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (listsError) {
    return NextResponse.json({ error: "Failed to fetch lists" }, { status: 500 });
  }

  return NextResponse.json({
    bookmarks,
    watched,
    lists: (lists || []).map((l: { id: number; name: string; goblin_list_movies: { movie_id: number }[] }) => ({
      id: l.id,
      name: l.name,
      movie_ids: l.goblin_list_movies.map((lm) => lm.movie_id),
    })),
  });
});
```

- [ ] **Step 2: Create POST /api/goblinday/me/bookmarks**

Create `web/app/api/goblinday/me/bookmarks/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (request, { user, serviceClient }) => {
  const body = await request.json();
  const { movie_id, field, value } = body;

  if (!movie_id || !field || typeof value !== "boolean") {
    return NextResponse.json({ error: "movie_id, field, and value required" }, { status: 400 });
  }

  if (field !== "bookmarked" && field !== "watched") {
    return NextResponse.json({ error: "field must be bookmarked or watched" }, { status: 400 });
  }

  const { error } = await serviceClient
    .from("goblin_user_movies")
    .upsert(
      { user_id: user.id, movie_id, [field]: value } as never,
      { onConflict: "user_id,movie_id" }
    );

  if (error) {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add web/app/api/goblinday/me/route.ts web/app/api/goblinday/me/bookmarks/route.ts
git commit -m "feat(goblin): add personal movie state API — /me and /me/bookmarks"
```

---

### Task 4: Named Lists API

**Files:**
- Create: `web/app/api/goblinday/me/lists/route.ts`
- Create: `web/app/api/goblinday/me/lists/[id]/route.ts`

- [ ] **Step 1: Create GET/POST /api/goblinday/me/lists**

Create `web/app/api/goblinday/me/lists/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_request, { user, serviceClient }) => {
  const { data, error } = await serviceClient
    .from("goblin_lists")
    .select("id, name, created_at, goblin_list_movies(movie_id)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch lists" }, { status: 500 });
  }

  return NextResponse.json(
    (data || []).map((l: { id: number; name: string; created_at: string; goblin_list_movies: { movie_id: number }[] }) => ({
      id: l.id,
      name: l.name,
      created_at: l.created_at,
      movie_ids: l.goblin_list_movies.map((lm) => lm.movie_id),
    }))
  );
});

export const POST = withAuth(async (request, { user, serviceClient }) => {
  const { name, movie_ids } = await request.json();

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const { data: list, error: listError } = await serviceClient
    .from("goblin_lists")
    .insert({ user_id: user.id, name } as never)
    .select("id, name, created_at")
    .single();

  if (listError || !list) {
    return NextResponse.json({ error: "Failed to create list" }, { status: 500 });
  }

  if (Array.isArray(movie_ids) && movie_ids.length > 0) {
    const rows = movie_ids.map((mid: number) => ({
      list_id: (list as { id: number }).id,
      movie_id: mid,
    }));
    await serviceClient.from("goblin_list_movies").insert(rows as never);
  }

  return NextResponse.json({
    id: (list as { id: number }).id,
    name: (list as { name: string }).name,
    created_at: (list as { created_at: string }).created_at,
    movie_ids: movie_ids || [],
  }, { status: 201 });
});
```

- [ ] **Step 2: Create PATCH/DELETE /api/goblinday/me/lists/[id]**

Create `web/app/api/goblinday/me/lists/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

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

    const { name, movie_ids } = await request.json();

    if (name) {
      await serviceClient
        .from("goblin_lists")
        .update({ name } as never)
        .eq("id", listId);
    }

    if (Array.isArray(movie_ids)) {
      // Replace all movies: delete existing, insert new
      await serviceClient
        .from("goblin_list_movies")
        .delete()
        .eq("list_id", listId);

      if (movie_ids.length > 0) {
        const rows = movie_ids.map((mid: number) => ({
          list_id: listId,
          movie_id: mid,
        }));
        await serviceClient.from("goblin_list_movies").insert(rows as never);
      }
    }

    return NextResponse.json({ success: true });
  }
);

export const DELETE = withAuthAndParams<{ id: string }>(
  async (_request, { user, serviceClient, params }) => {
    const listId = parseInt(params.id);
    if (isNaN(listId)) {
      return NextResponse.json({ error: "Invalid list ID" }, { status: 400 });
    }

    const { error } = await serviceClient
      .from("goblin_lists")
      .delete()
      .eq("id", listId)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: "Failed to delete list" }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  }
);
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add web/app/api/goblinday/me/lists/
git commit -m "feat(goblin): add named lists API — CRUD for /me/lists"
```

---

### Task 5: Session Management API Updates

**Files:**
- Modify: `web/app/api/goblinday/sessions/route.ts`
- Modify: `web/app/api/goblinday/sessions/[id]/route.ts`
- Modify: `web/app/api/goblinday/sessions/[id]/movies/route.ts`
- Modify: `web/app/api/goblinday/sessions/[id]/themes/route.ts`
- Create: `web/app/api/goblinday/sessions/join/[code]/route.ts`
- Create: `web/app/api/goblinday/sessions/[id]/propose/route.ts`
- Create: `web/lib/goblin-utils.ts`

- [ ] **Step 1: Create shared utility for invite code generation and member checks**

Create `web/lib/goblin-utils.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";

export function generateInviteCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function isSessionMember(serviceClient: SupabaseClient<any, any, any>, sessionId: number, userId: string): Promise<boolean> {
  const { data } = await serviceClient
    .from("goblin_session_members")
    .select("id")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .single();
  return !!data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function isSessionHost(serviceClient: SupabaseClient<any, any, any>, sessionId: number, userId: string): Promise<boolean> {
  const { data } = await serviceClient
    .from("goblin_session_members")
    .select("id")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .eq("role", "host")
    .single();
  return !!data;
}
```

- [ ] **Step 2: Rewrite sessions list/create route**

Replace `web/app/api/goblinday/sessions/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { generateInviteCode } from "@/lib/goblin-utils";

export const dynamic = "force-dynamic";

// GET: List sessions the user is a member of
export const GET = withAuth(async (_request, { user, serviceClient }) => {
  // Get session IDs the user belongs to
  const { data: memberships, error: memError } = await serviceClient
    .from("goblin_session_members")
    .select("session_id")
    .eq("user_id", user.id);

  if (memError) {
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }

  const sessionIds = (memberships || []).map((m: { session_id: number }) => m.session_id);

  if (sessionIds.length === 0) {
    return NextResponse.json([]);
  }

  const { data: sessions, error } = await serviceClient
    .from("goblin_sessions")
    .select("id, name, date, status, invite_code, created_by, created_at, goblin_session_movies(movie_id), goblin_themes(label, status), goblin_session_members(user_id, role, profiles(display_name, avatar_url))")
    .in("id", sessionIds)
    .order("date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }

  const result = (sessions || []).map((s: Record<string, unknown>) => {
    const movies = s.goblin_session_movies as { movie_id: number }[] || [];
    const themes = s.goblin_themes as { label: string; status: string }[] || [];
    const members = s.goblin_session_members as { user_id: string; role: string; profiles: { display_name: string; avatar_url: string } }[] || [];
    return {
      id: s.id,
      name: s.name,
      date: s.date,
      status: s.status,
      invite_code: s.invite_code,
      created_at: s.created_at,
      movie_count: movies.length,
      themes: themes.filter((t) => t.status === "active").map((t) => t.label),
      canceled_themes: themes.filter((t) => t.status === "canceled").map((t) => t.label),
      members: members.map((m) => ({
        user_id: m.user_id,
        role: m.role,
        display_name: m.profiles?.display_name,
        avatar_url: m.profiles?.avatar_url,
      })),
    };
  });

  return NextResponse.json(result);
});

// POST: Create a new session
export const POST = withAuth(async (request, { user, serviceClient }) => {
  const body = await request.json().catch(() => ({}));
  const inviteCode = generateInviteCode();

  const { data: session, error } = await serviceClient
    .from("goblin_sessions")
    .insert({
      name: body.name || null,
      date: body.date || new Date().toISOString().split("T")[0],
      status: "planning",
      invite_code: inviteCode,
      created_by: user.id,
    } as never)
    .select("id, name, date, status, invite_code, created_at")
    .single();

  if (error || !session) {
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }

  // Add creator as host
  await serviceClient
    .from("goblin_session_members")
    .insert({
      session_id: (session as { id: number }).id,
      user_id: user.id,
      role: "host",
    } as never);

  return NextResponse.json(session, { status: 201 });
});
```

- [ ] **Step 3: Rewrite session detail/update/delete route**

Replace `web/app/api/goblinday/sessions/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";
import { isSessionMember, isSessionHost } from "@/lib/goblin-utils";

export const dynamic = "force-dynamic";

// GET: Fetch full session detail (members only)
export const GET = withAuthAndParams<{ id: string }>(
  async (_request, { user, serviceClient, params }) => {
    const sessionId = parseInt(params.id);
    if (isNaN(sessionId)) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    if (!(await isSessionMember(serviceClient, sessionId, user.id))) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    const { data: session, error } = await serviceClient
      .from("goblin_sessions")
      .select("id, name, date, status, invite_code, created_by, created_at")
      .eq("id", sessionId)
      .single();

    if (error || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Fetch movies with proposer info
    const { data: sessionMovies } = await serviceClient
      .from("goblin_session_movies")
      .select("movie_id, watch_order, proposed_by, added_at, goblin_movies(id, title, poster_path, rt_critics_score, rt_audience_score, runtime_minutes, mpaa_rating, genres)")
      .eq("session_id", sessionId)
      .order("watch_order", { ascending: true });

    // Fetch proposer display names
    const proposerIds = [...new Set((sessionMovies || []).map((sm: { proposed_by: string | null }) => sm.proposed_by).filter(Boolean))];
    let proposerMap: Record<string, string> = {};
    if (proposerIds.length > 0) {
      const { data: profiles } = await serviceClient
        .from("profiles")
        .select("id, display_name")
        .in("id", proposerIds);
      proposerMap = Object.fromEntries((profiles || []).map((p: { id: string; display_name: string }) => [p.id, p.display_name]));
    }

    // Fetch themes
    const { data: themes } = await serviceClient
      .from("goblin_themes")
      .select("id, label, status, created_at, canceled_at, goblin_theme_movies(movie_id)")
      .eq("session_id", sessionId);

    // Fetch timeline with user info
    const { data: timeline } = await serviceClient
      .from("goblin_timeline")
      .select("id, event_type, movie_id, theme_id, user_id, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });

    // Fetch members
    const { data: members } = await serviceClient
      .from("goblin_session_members")
      .select("user_id, role, joined_at, profiles(display_name, avatar_url)")
      .eq("session_id", sessionId);

    // Fetch user display names for timeline
    const timelineUserIds = [...new Set((timeline || []).map((t: { user_id: string | null }) => t.user_id).filter(Boolean))];
    let timelineUserMap: Record<string, string> = {};
    if (timelineUserIds.length > 0) {
      const { data: profiles } = await serviceClient
        .from("profiles")
        .select("id, display_name")
        .in("id", timelineUserIds);
      timelineUserMap = Object.fromEntries((profiles || []).map((p: { id: string; display_name: string }) => [p.id, p.display_name]));
    }

    return NextResponse.json({
      ...session,
      movies: (sessionMovies || []).map((sm: Record<string, unknown>) => ({
        ...sm.goblin_movies,
        watch_order: sm.watch_order,
        proposed_by: sm.proposed_by,
        proposed_by_name: sm.proposed_by ? proposerMap[sm.proposed_by as string] || "Unknown" : null,
        added_at: sm.added_at,
      })),
      themes: (themes || []).map((t: Record<string, unknown>) => ({
        id: t.id,
        label: t.label,
        status: t.status,
        created_at: t.created_at,
        canceled_at: t.canceled_at,
        movie_ids: ((t.goblin_theme_movies as { movie_id: number }[]) || []).map((tm) => tm.movie_id),
      })),
      timeline: (timeline || []).map((t: Record<string, unknown>) => ({
        ...t,
        user_name: t.user_id ? timelineUserMap[t.user_id as string] || "Unknown" : null,
      })),
      members: (members || []).map((m: Record<string, unknown>) => ({
        user_id: m.user_id,
        role: m.role,
        joined_at: m.joined_at,
        display_name: (m.profiles as { display_name: string })?.display_name,
        avatar_url: (m.profiles as { avatar_url: string })?.avatar_url,
      })),
    });
  }
);

// PATCH: Update session status (host only)
export const PATCH = withAuthAndParams<{ id: string }>(
  async (request, { user, serviceClient, params }) => {
    const sessionId = parseInt(params.id);
    if (isNaN(sessionId)) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    if (!(await isSessionHost(serviceClient, sessionId, user.id))) {
      return NextResponse.json({ error: "Only host can update session" }, { status: 403 });
    }

    const { status, name } = await request.json();
    const updates: Record<string, unknown> = {};

    if (name !== undefined) updates.name = name;

    if (status) {
      // Validate transitions: planning→live, live→ended
      const { data: current } = await serviceClient
        .from("goblin_sessions")
        .select("status")
        .eq("id", sessionId)
        .single();

      const validTransitions: Record<string, string[]> = {
        planning: ["live"],
        live: ["ended"],
      };

      const currentStatus = (current as { status: string })?.status;
      if (!validTransitions[currentStatus]?.includes(status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${currentStatus} to ${status}` },
          { status: 400 }
        );
      }
      updates.status = status;
    }

    const { data, error } = await serviceClient
      .from("goblin_sessions")
      .update(updates as never)
      .eq("id", sessionId)
      .select("id, name, date, status, invite_code, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
    }

    return NextResponse.json(data);
  }
);

// DELETE: Delete session (host only)
export const DELETE = withAuthAndParams<{ id: string }>(
  async (_request, { user, serviceClient, params }) => {
    const sessionId = parseInt(params.id);
    if (isNaN(sessionId)) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    if (!(await isSessionHost(serviceClient, sessionId, user.id))) {
      return NextResponse.json({ error: "Only host can delete session" }, { status: 403 });
    }

    const { error } = await serviceClient
      .from("goblin_sessions")
      .delete()
      .eq("id", sessionId);

    if (error) {
      return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  }
);
```

- [ ] **Step 4: Update add-movie-to-session route**

Replace `web/app/api/goblinday/sessions/[id]/movies/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";
import { isSessionMember } from "@/lib/goblin-utils";

export const dynamic = "force-dynamic";

export const POST = withAuthAndParams<{ id: string }>(
  async (request, { user, serviceClient, params }) => {
    const sessionId = parseInt(params.id);
    if (isNaN(sessionId)) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    if (!(await isSessionMember(serviceClient, sessionId, user.id))) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    // Verify session is live
    const { data: session } = await serviceClient
      .from("goblin_sessions")
      .select("status")
      .eq("id", sessionId)
      .single();

    if ((session as { status: string })?.status !== "live") {
      return NextResponse.json({ error: "Session must be live to add movies" }, { status: 400 });
    }

    const { movie_id } = await request.json();
    if (!movie_id) {
      return NextResponse.json({ error: "movie_id required" }, { status: 400 });
    }

    // Get next watch_order
    const { data: existing } = await serviceClient
      .from("goblin_session_movies")
      .select("watch_order")
      .eq("session_id", sessionId)
      .order("watch_order", { ascending: false })
      .limit(1);

    const nextOrder = (existing && existing.length > 0)
      ? (existing[0] as { watch_order: number }).watch_order + 1
      : 1;

    const { error: insertError } = await serviceClient
      .from("goblin_session_movies")
      .insert({
        session_id: sessionId,
        movie_id,
        watch_order: nextOrder,
        proposed_by: user.id,
      } as never);

    if (insertError) {
      return NextResponse.json({ error: "Failed to add movie" }, { status: 500 });
    }

    // Mark watched for this user
    await serviceClient
      .from("goblin_user_movies")
      .upsert(
        { user_id: user.id, movie_id, watched: true } as never,
        { onConflict: "user_id,movie_id" }
      );

    // Log timeline event
    await serviceClient
      .from("goblin_timeline")
      .insert({
        session_id: sessionId,
        event_type: "movie_started",
        movie_id,
        user_id: user.id,
      } as never);

    return NextResponse.json({ watch_order: nextOrder }, { status: 201 });
  }
);
```

- [ ] **Step 5: Update themes route with auth**

Replace `web/app/api/goblinday/sessions/[id]/themes/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";
import { isSessionMember } from "@/lib/goblin-utils";

export const dynamic = "force-dynamic";

export const POST = withAuthAndParams<{ id: string }>(
  async (request, { user, serviceClient, params }) => {
    const sessionId = parseInt(params.id);
    if (isNaN(sessionId)) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    if (!(await isSessionMember(serviceClient, sessionId, user.id))) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    const { label, movie_ids } = await request.json();
    if (!label) {
      return NextResponse.json({ error: "label required" }, { status: 400 });
    }

    const { data: theme, error } = await serviceClient
      .from("goblin_themes")
      .insert({ session_id: sessionId, label, status: "active" } as never)
      .select("id, label, status, created_at")
      .single();

    if (error || !theme) {
      return NextResponse.json({ error: "Failed to create theme" }, { status: 500 });
    }

    if (Array.isArray(movie_ids) && movie_ids.length > 0) {
      const rows = movie_ids.map((mid: number) => ({
        theme_id: (theme as { id: number }).id,
        movie_id: mid,
      }));
      await serviceClient.from("goblin_theme_movies").insert(rows as never);
    }

    // Log timeline event
    await serviceClient
      .from("goblin_timeline")
      .insert({
        session_id: sessionId,
        event_type: "theme_added",
        theme_id: (theme as { id: number }).id,
        user_id: user.id,
      } as never);

    return NextResponse.json(theme, { status: 201 });
  }
);
```

- [ ] **Step 6: Update theme status route with auth**

Replace `web/app/api/goblinday/sessions/[id]/themes/[themeId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";
import { isSessionMember } from "@/lib/goblin-utils";

export const dynamic = "force-dynamic";

export const PATCH = withAuthAndParams<{ id: string; themeId: string }>(
  async (request, { user, serviceClient, params }) => {
    const sessionId = parseInt(params.id);
    const themeId = parseInt(params.themeId);
    if (isNaN(sessionId) || isNaN(themeId)) {
      return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
    }

    if (!(await isSessionMember(serviceClient, sessionId, user.id))) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    const { status } = await request.json();
    if (!status || !["active", "canceled"].includes(status)) {
      return NextResponse.json({ error: "status must be active or canceled" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { status };
    if (status === "canceled") {
      updates.canceled_at = new Date().toISOString();
    } else {
      updates.canceled_at = null;
    }

    const { data, error } = await serviceClient
      .from("goblin_themes")
      .update(updates as never)
      .eq("id", themeId)
      .eq("session_id", sessionId)
      .select("id, label, status, created_at, canceled_at")
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to update theme" }, { status: 500 });
    }

    // Log timeline event
    await serviceClient
      .from("goblin_timeline")
      .insert({
        session_id: sessionId,
        event_type: status === "canceled" ? "theme_canceled" : "theme_added",
        theme_id: themeId,
        user_id: user.id,
      } as never);

    return NextResponse.json(data);
  }
);
```

- [ ] **Step 7: Create join session route**

Create `web/app/api/goblinday/sessions/join/[code]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { withAuthAndParams } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

// GET: Resolve invite code to session info (no auth required)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const serviceClient = createServiceClient();

  const { data: session, error } = await serviceClient
    .from("goblin_sessions")
    .select("id, name, date, status, created_by, goblin_session_members(user_id, role, profiles(display_name, avatar_url))")
    .eq("invite_code", code)
    .single();

  if (error || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const members = (session as Record<string, unknown>).goblin_session_members as { user_id: string; role: string; profiles: { display_name: string; avatar_url: string } }[] || [];

  // Check if current user is already a member
  let isMember = false;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    isMember = members.some((m) => m.user_id === user.id);
  }

  return NextResponse.json({
    session_id: (session as { id: number }).id,
    name: (session as { name: string }).name,
    date: (session as { date: string }).date,
    status: (session as { status: string }).status,
    member_count: members.length,
    members: members.map((m) => ({
      role: m.role,
      display_name: m.profiles?.display_name,
      avatar_url: m.profiles?.avatar_url,
    })),
    is_member: isMember,
  });
}

// POST: Join session via invite code (auth required)
export const POST = withAuthAndParams<{ code: string }>(
  async (_request, { user, serviceClient, params }) => {
    const { data: session, error } = await serviceClient
      .from("goblin_sessions")
      .select("id, status")
      .eq("invite_code", params.code)
      .single();

    if (error || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const status = (session as { status: string }).status;
    if (status === "ended") {
      return NextResponse.json({ error: "Session has ended" }, { status: 400 });
    }

    // Insert member (upsert to handle re-joins gracefully)
    const { error: joinError } = await serviceClient
      .from("goblin_session_members")
      .upsert(
        {
          session_id: (session as { id: number }).id,
          user_id: user.id,
          role: "member",
        } as never,
        { onConflict: "session_id,user_id" }
      );

    if (joinError) {
      return NextResponse.json({ error: "Failed to join session" }, { status: 500 });
    }

    return NextResponse.json({
      session_id: (session as { id: number }).id,
      joined: true,
    });
  }
);
```

- [ ] **Step 8: Create propose movie route**

Create `web/app/api/goblinday/sessions/[id]/propose/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";
import { isSessionMember } from "@/lib/goblin-utils";

export const dynamic = "force-dynamic";

export const POST = withAuthAndParams<{ id: string }>(
  async (request, { user, serviceClient, params }) => {
    const sessionId = parseInt(params.id);
    if (isNaN(sessionId)) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    if (!(await isSessionMember(serviceClient, sessionId, user.id))) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    // Verify session is in planning phase
    const { data: session } = await serviceClient
      .from("goblin_sessions")
      .select("status")
      .eq("id", sessionId)
      .single();

    if ((session as { status: string })?.status !== "planning") {
      return NextResponse.json({ error: "Session must be in planning phase" }, { status: 400 });
    }

    const { movie_id } = await request.json();
    if (!movie_id) {
      return NextResponse.json({ error: "movie_id required" }, { status: 400 });
    }

    // Insert proposal (no watch_order yet — that happens in live phase)
    const { error } = await serviceClient
      .from("goblin_session_movies")
      .insert({
        session_id: sessionId,
        movie_id,
        proposed_by: user.id,
      } as never);

    if (error) {
      // Likely duplicate
      return NextResponse.json({ error: "Movie already proposed" }, { status: 409 });
    }

    // Log timeline event
    await serviceClient
      .from("goblin_timeline")
      .insert({
        session_id: sessionId,
        event_type: "movie_proposed",
        movie_id,
        user_id: user.id,
      } as never);

    return NextResponse.json({ proposed: true }, { status: 201 });
  }
);
```

- [ ] **Step 9: Verify build**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 10: Commit**

```bash
git add web/lib/goblin-utils.ts web/app/api/goblinday/sessions/ web/app/api/goblinday/sessions/join/ web/app/api/goblinday/sessions/*/propose/
git commit -m "feat(goblin): rewrite session APIs with auth, invite codes, proposals, and member management"
```

---

### Task 6: Movie Pool API with Optional Auth

**Files:**
- Modify: `web/app/api/goblinday/route.ts`

The movie pool stays public but optionally joins the user's bookmarked/watched state when authenticated.

- [ ] **Step 1: Rewrite the movie pool route**

Replace `web/app/api/goblinday/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const serviceClient = createServiceClient();
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");

  let query = serviceClient
    .from("goblin_movies")
    .select("*")
    .order("release_date", { ascending: true });

  if (year) {
    query = query.eq("year", parseInt(year));
  }

  const { data: movies, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to fetch movies" }, { status: 500 });
  }

  // If authenticated, join user's movie state
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let userMovieMap: Record<number, { bookmarked: boolean; watched: boolean }> = {};

  if (user) {
    const { data: userMovies } = await serviceClient
      .from("goblin_user_movies")
      .select("movie_id, bookmarked, watched")
      .eq("user_id", user.id);

    if (userMovies) {
      userMovieMap = Object.fromEntries(
        userMovies.map((um: { movie_id: number; bookmarked: boolean; watched: boolean }) => [
          um.movie_id,
          { bookmarked: um.bookmarked, watched: um.watched },
        ])
      );
    }
  }

  const result = (movies || []).map((m: Record<string, unknown>) => ({
    ...m,
    bookmarked: userMovieMap[m.id as number]?.bookmarked || false,
    watched: userMovieMap[m.id as number]?.watched || false,
  }));

  return NextResponse.json(result);
}
```

- [ ] **Step 2: Remove the old PATCH handler from this route**

The old `PATCH /api/goblinday` route toggled global `proposed`/`watched` on movies. This is now handled by `/api/goblinday/me/bookmarks`. Delete the PATCH export from this file entirely (it was in the original `route.ts`).

The file above already omits it. If there was a separate `[id]/route.ts` PATCH, update it to only allow non-user fields (RT scores, streaming_info):

Update `web/app/api/goblinday/[id]/route.ts` — keep only admin-type updates:

```typescript
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const MUTABLE_FIELDS = ["rt_critics_score", "rt_audience_score", "streaming_info"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const movieId = parseInt(id);
  if (isNaN(movieId)) {
    return NextResponse.json({ error: "Invalid movie ID" }, { status: 400 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  for (const field of MUTABLE_FIELDS) {
    if (field in body) updates[field] = body[field];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient
    .from("goblin_movies")
    .update(updates as never)
    .eq("id", movieId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to update movie" }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add web/app/api/goblinday/route.ts web/app/api/goblinday/[id]/route.ts
git commit -m "feat(goblin): movie pool with optional auth, remove global proposed/watched toggles"
```

---

### Task 7: Frontend Auth Integration + Login Bar

**Files:**
- Modify: `web/components/goblin/GoblinDayPage.tsx`
- Create: `web/components/goblin/GoblinAuthBar.tsx`
- Create: `web/lib/hooks/useGoblinUser.ts`

- [ ] **Step 1: Create useGoblinUser hook**

Create `web/lib/hooks/useGoblinUser.ts`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

interface GoblinUserState {
  user: User | null;
  bookmarks: Set<number>;
  watched: Set<number>;
  lists: { id: number; name: string; movie_ids: number[] }[];
  loading: boolean;
}

export function useGoblinUser() {
  const [state, setState] = useState<GoblinUserState>({
    user: null,
    bookmarks: new Set(),
    watched: new Set(),
    lists: [],
    loading: true,
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setState((prev) => ({ ...prev, user: null, loading: false }));
        return;
      }

      const res = await fetch("/api/goblinday/me");
      if (res.ok) {
        const data = await res.json();
        setState({
          user,
          bookmarks: new Set(data.bookmarks),
          watched: new Set(data.watched),
          lists: data.lists,
          loading: false,
        });
      } else {
        setState((prev) => ({ ...prev, user, loading: false }));
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        init();
      } else {
        setState({ user: null, bookmarks: new Set(), watched: new Set(), lists: [], loading: false });
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleBookmark = useCallback(async (movieId: number) => {
    const isBookmarked = state.bookmarks.has(movieId);
    // Optimistic update
    setState((prev) => {
      const next = new Set(prev.bookmarks);
      if (isBookmarked) next.delete(movieId);
      else next.add(movieId);
      return { ...prev, bookmarks: next };
    });

    const res = await fetch("/api/goblinday/me/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movie_id: movieId, field: "bookmarked", value: !isBookmarked }),
    });

    if (!res.ok) {
      // Rollback
      setState((prev) => {
        const next = new Set(prev.bookmarks);
        if (isBookmarked) next.add(movieId);
        else next.delete(movieId);
        return { ...prev, bookmarks: next };
      });
    }
  }, [state.bookmarks]);

  const toggleWatched = useCallback(async (movieId: number) => {
    const isWatched = state.watched.has(movieId);
    setState((prev) => {
      const next = new Set(prev.watched);
      if (isWatched) next.delete(movieId);
      else next.add(movieId);
      return { ...prev, watched: next };
    });

    const res = await fetch("/api/goblinday/me/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movie_id: movieId, field: "watched", value: !isWatched }),
    });

    if (!res.ok) {
      setState((prev) => {
        const next = new Set(prev.watched);
        if (isWatched) next.add(movieId);
        else next.delete(movieId);
        return { ...prev, watched: next };
      });
    }
  }, [state.watched]);

  const signIn = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }, [supabase.auth]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({ user: null, bookmarks: new Set(), watched: new Set(), lists: [], loading: false });
  }, [supabase.auth]);

  const refreshUserData = useCallback(async () => {
    if (!state.user) return;
    const res = await fetch("/api/goblinday/me");
    if (res.ok) {
      const data = await res.json();
      setState((prev) => ({
        ...prev,
        bookmarks: new Set(data.bookmarks),
        watched: new Set(data.watched),
        lists: data.lists,
      }));
    }
  }, [state.user]);

  return {
    ...state,
    toggleBookmark,
    toggleWatched,
    signIn,
    signOut,
    refreshUserData,
  };
}
```

- [ ] **Step 2: Create GoblinAuthBar component**

Create `web/components/goblin/GoblinAuthBar.tsx`:

```typescript
"use client";

import type { User } from "@supabase/supabase-js";

interface GoblinAuthBarProps {
  user: User | null;
  loading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

export default function GoblinAuthBar({ user, loading, onSignIn, onSignOut }: GoblinAuthBarProps) {
  if (loading) return null;

  return (
    <div className="flex items-center justify-end gap-3 px-4 py-2 font-mono text-xs">
      {user ? (
        <>
          <span className="text-red-400 uppercase tracking-wider">
            {user.user_metadata?.display_name || user.email?.split("@")[0] || "GOBLIN"}
          </span>
          <button
            onClick={onSignOut}
            className="px-3 py-1 border border-zinc-700 text-zinc-500 hover:text-red-400 hover:border-red-800 transition-colors uppercase tracking-wider"
          >
            Sign Out
          </button>
        </>
      ) : (
        <button
          onClick={onSignIn}
          className="px-4 py-1.5 border border-red-900 text-red-400 hover:bg-red-900/30 transition-colors uppercase tracking-wider"
        >
          Sign In
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Integrate auth into GoblinDayPage**

This step requires modifying `GoblinDayPage.tsx` to:
1. Import and use `useGoblinUser` hook
2. Add `<GoblinAuthBar>` to the header area (above the marquee)
3. Replace the old global `handleToggle` (which PATCH'd `proposed`/`watched` on the movie itself) with the per-user `toggleBookmark`/`toggleWatched` from the hook
4. Pass `bookmarks` and `watched` sets to movie filtering logic instead of reading `movie.proposed`/`movie.watched`
5. Add a "MY LIST" tab (5th tab)

Key changes to filtering logic in `GoblinDayPage.tsx`:

```typescript
// Old: movies.filter(m => m.proposed && !m.watched)
// New: movies.filter(m => goblinUser.bookmarks.has(m.id) && !goblinUser.watched.has(m.id))

// Old: movies.filter(m => !m.watched && isReleased(m))
// New: movies.filter(m => !goblinUser.watched.has(m.id) && isReleased(m))

// Old: movies.filter(m => m.watched)
// New: movies.filter(m => goblinUser.watched.has(m.id))
```

Add "MY LIST" tab content:
```typescript
// Tab: "mylist" — shows bookmarked movies + named lists
const myListMovies = movies.filter(m => goblinUser.bookmarks.has(m.id));
```

- [ ] **Step 4: Update GoblinMovieCard props**

Modify `GoblinMovieCard.tsx` to accept per-user state:

```typescript
interface GoblinMovieCardProps {
  movie: GoblinMovie;
  isBookmarked: boolean;
  isWatched: boolean;
  onToggleBookmark: (id: number) => void;
  onToggleWatched: (id: number) => void;
  // Session-specific (only in planning context):
  onPropose?: (id: number) => void;
  isProposed?: boolean;
}
```

Replace the bottom action buttons:
- "PROPOSE" → only shows in planning session context (via `onPropose` prop)
- Bookmark icon (persistent) → calls `onToggleBookmark`
- "WATCHED" → calls `onToggleWatched`

- [ ] **Step 5: Verify build**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add web/lib/hooks/useGoblinUser.ts web/components/goblin/GoblinAuthBar.tsx web/components/goblin/GoblinDayPage.tsx web/components/goblin/GoblinMovieCard.tsx
git commit -m "feat(goblin): add auth integration, login bar, per-user bookmark/watched state"
```

---

### Task 8: Session Planning View + Live Flow Updates

**Files:**
- Modify: `web/components/goblin/GoblinDayPage.tsx`
- Modify: `web/components/goblin/GoblinSessionView.tsx`
- Modify: `web/components/goblin/GoblinSessionHistory.tsx`
- Create: `web/components/goblin/GoblinPlanningView.tsx`

- [ ] **Step 1: Create GoblinPlanningView component**

Create `web/components/goblin/GoblinPlanningView.tsx`:

```typescript
"use client";

import { useState, useCallback } from "react";
import SmartImage from "@/components/SmartImage";

interface PlanningMember {
  user_id: string;
  role: string;
  display_name: string;
  avatar_url: string | null;
}

interface ProposedMovie {
  id: number;
  title: string;
  poster_path: string | null;
  rt_critics_score: number | null;
  rt_audience_score: number | null;
  proposed_by_name: string | null;
}

interface PlanningViewProps {
  sessionId: number;
  sessionName: string | null;
  sessionDate: string;
  inviteCode: string;
  members: PlanningMember[];
  proposedMovies: ProposedMovie[];
  allMovies: { id: number; title: string; poster_path: string | null }[];
  isHost: boolean;
  onPropose: (movieId: number) => void;
  onStartLive: () => void;
  onRefresh: () => void;
}

export default function GoblinPlanningView({
  sessionName,
  sessionDate,
  inviteCode,
  members,
  proposedMovies,
  allMovies,
  isHost,
  onPropose,
  onStartLive,
  onRefresh,
}: PlanningViewProps) {
  const [copied, setCopied] = useState(false);
  const [showMoviePicker, setShowMoviePicker] = useState(false);

  const inviteUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/s/${inviteCode}`;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [inviteUrl]);

  const proposedIds = new Set(proposedMovies.map((m) => m.id));
  const availableMovies = allMovies.filter((m) => !proposedIds.has(m.id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border border-red-900/50 bg-black/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-mono text-lg font-bold text-red-400 uppercase tracking-wider">
              {sessionName || "GOBLIN DAY"} — PLANNING
            </h2>
            <p className="font-mono text-xs text-zinc-500 mt-1">{sessionDate}</p>
          </div>
          {isHost && (
            <button
              onClick={onStartLive}
              className="px-4 py-2 bg-red-900 text-red-100 font-mono text-xs uppercase tracking-wider hover:bg-red-800 transition-colors"
            >
              START GOBLIN DAY
            </button>
          )}
        </div>

        {/* Invite link */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-zinc-500 uppercase">Invite:</span>
          <code className="font-mono text-xs text-red-400 bg-zinc-900 px-2 py-1 border border-zinc-800 flex-1 truncate">
            {inviteUrl}
          </code>
          <button
            onClick={handleCopy}
            className="px-3 py-1 border border-zinc-700 text-zinc-400 font-mono text-xs hover:text-red-400 hover:border-red-800 transition-colors uppercase"
          >
            {copied ? "COPIED" : "COPY"}
          </button>
        </div>

        {/* Members */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-zinc-500 uppercase">Members:</span>
          {members.map((m) => (
            <span
              key={m.user_id}
              className={`font-mono text-xs px-2 py-0.5 border ${
                m.role === "host"
                  ? "border-red-800 text-red-400"
                  : "border-zinc-700 text-zinc-400"
              }`}
            >
              {m.display_name || "GOBLIN"}
              {m.role === "host" && " (HOST)"}
            </span>
          ))}
        </div>
      </div>

      {/* Proposed Movies */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-mono text-xs font-bold text-zinc-400 uppercase tracking-wider">
            PROPOSED ({proposedMovies.length})
          </h3>
          <button
            onClick={() => setShowMoviePicker(!showMoviePicker)}
            className="font-mono text-xs text-red-400 hover:text-red-300 uppercase tracking-wider"
          >
            + PROPOSE MOVIE
          </button>
        </div>

        {proposedMovies.length === 0 ? (
          <p className="font-mono text-xs text-zinc-600 italic">
            No movies proposed yet. Click &quot;+ PROPOSE MOVIE&quot; to add one.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {proposedMovies.map((movie) => (
              <div key={movie.id} className="border border-zinc-800 bg-black/40 overflow-hidden">
                <div className="aspect-[2/3] relative">
                  {movie.poster_path ? (
                    <SmartImage
                      src={`https://image.tmdb.org/t/p/w300${movie.poster_path}`}
                      alt={movie.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                      <span className="font-mono text-xs text-zinc-700">NO POSTER</span>
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="font-mono text-xs text-zinc-300 uppercase truncate">{movie.title}</p>
                  {movie.proposed_by_name && (
                    <p className="font-mono text-[10px] text-zinc-600 mt-0.5">
                      by {movie.proposed_by_name}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Movie Picker (simple list) */}
      {showMoviePicker && (
        <div className="border border-zinc-800 bg-black/60 p-4 max-h-96 overflow-y-auto">
          <h3 className="font-mono text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
            SELECT A MOVIE TO PROPOSE
          </h3>
          <div className="space-y-1">
            {availableMovies.slice(0, 50).map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  onPropose(m.id);
                  setShowMoviePicker(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-red-900/20 text-left transition-colors"
              >
                <div className="w-8 h-12 flex-shrink-0 bg-zinc-900 overflow-hidden">
                  {m.poster_path && (
                    <SmartImage
                      src={`https://image.tmdb.org/t/p/w92${m.poster_path}`}
                      alt=""
                      width={32}
                      height={48}
                      className="object-cover w-full h-full"
                    />
                  )}
                </div>
                <span className="font-mono text-xs text-zinc-300 uppercase">{m.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update GoblinSessionHistory for new session model**

Key changes to `GoblinSessionHistory.tsx`:
- Replace `is_active` checks with `status` checks
- Show `invite_code` on active/planning sessions
- Show member list in session summaries
- "START GOBLIN DAY" creates a planning-phase session

```typescript
// Old: session.is_active
// New: session.status === "live" || session.status === "planning"

// Show status badge per session:
// "PLANNING" (amber), "LIVE" (red pulse), "ENDED" (zinc)
```

- [ ] **Step 3: Update GoblinSessionView for auth**

Key changes to `GoblinSessionView.tsx`:
- Timeline entries show `user_name` attribution: `"{user_name} STARTED WATCHING {title}"`
- Add `members` display in header
- All API calls now go through authenticated routes (no changes to URL paths, just the cookies will handle auth)

- [ ] **Step 4: Update GoblinDayPage session flow**

Key changes to `GoblinDayPage.tsx`:
- When user creates a session, it starts in `planning` status
- Show `GoblinPlanningView` when session status is `planning`
- Show `GoblinSessionView` when session status is `live`
- Show `GoblinSessionHistory` when no active session
- "Start Goblin Day" in planning view → PATCH session status to `live`
- Pass invite code and members data through

```typescript
// Session state now tracks status:
const [activeSession, setActiveSession] = useState<{
  id: number;
  status: "planning" | "live";
  invite_code: string;
} | null>(null);

// Render logic:
// if activeSession?.status === "planning" → <GoblinPlanningView>
// if activeSession?.status === "live" → <GoblinSessionView>
// else → <GoblinSessionHistory>
```

- [ ] **Step 5: Verify build**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add web/components/goblin/
git commit -m "feat(goblin): add planning view, update session flow for planning→live→ended lifecycle"
```

---

### Task 9: Join Page

**Files:**
- Create: `web/app/goblinday/s/[code]/page.tsx`

- [ ] **Step 1: Create the join page**

Create `web/app/goblinday/s/[code]/page.tsx`:

```typescript
import { createServiceClient } from "@/lib/supabase/service";
import GoblinJoinPage from "./GoblinJoinPage";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const serviceClient = createServiceClient();
  const { data: session } = await serviceClient
    .from("goblin_sessions")
    .select("name, date")
    .eq("invite_code", code)
    .single();

  const title = session
    ? `Join ${(session as { name: string }).name || "Goblin Day"}`
    : "Goblin Day";

  return {
    title,
    description: "You've been invited to a Goblin Day horror movie marathon.",
    openGraph: { title, description: "Click the link you fool" },
  };
}

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <GoblinJoinPage code={code} />;
}
```

- [ ] **Step 2: Create the client component**

Create `web/app/goblinday/s/[code]/GoblinJoinPage.tsx`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useGoblinUser } from "@/lib/hooks/useGoblinUser";

interface SessionInfo {
  session_id: number;
  name: string | null;
  date: string;
  status: string;
  member_count: number;
  members: { role: string; display_name: string; avatar_url: string | null }[];
  is_member: boolean;
}

export default function GoblinJoinPage({ code }: { code: string }) {
  const router = useRouter();
  const { user, signIn, loading: authLoading } = useGoblinUser();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/goblinday/sessions/join/${code}`)
      .then((res) => (res.ok ? res.json() : Promise.reject("Not found")))
      .then((data) => {
        setSession(data);
        // If already a member, redirect to main page
        if (data.is_member) {
          router.push("/");
        }
      })
      .catch(() => setError("Session not found"))
      .finally(() => setLoading(false));
  }, [code, router]);

  const handleJoin = useCallback(async () => {
    if (!user) {
      signIn();
      return;
    }

    setJoining(true);
    const res = await fetch(`/api/goblinday/sessions/join/${code}`, {
      method: "POST",
    });

    if (res.ok) {
      router.push("/");
    } else {
      const data = await res.json();
      setError(data.error || "Failed to join");
      setJoining(false);
    }
  }, [user, signIn, code, router]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="font-mono text-xs text-zinc-600 uppercase tracking-wider animate-pulse">
          LOADING...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="font-mono text-sm text-red-500 uppercase">{error}</p>
          <a
            href="/"
            className="inline-block font-mono text-xs text-zinc-500 hover:text-red-400 uppercase tracking-wider"
          >
            GO TO GOBLIN DAY
          </a>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-md w-full border border-red-900/50 bg-black/80 p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="font-mono text-2xl font-bold text-red-500 uppercase tracking-wider">
            GOBLIN DAY
          </h1>
          <p className="font-mono text-xs text-zinc-500 uppercase">
            You&apos;ve been invited
          </p>
        </div>

        <div className="border border-zinc-800 p-4 space-y-2">
          <p className="font-mono text-sm text-zinc-300 uppercase">
            {session.name || "GOBLIN DAY"}
          </p>
          <p className="font-mono text-xs text-zinc-500">{session.date}</p>
          <p className="font-mono text-xs text-zinc-600">
            {session.member_count} member{session.member_count !== 1 ? "s" : ""}
          </p>
          {session.status === "ended" && (
            <p className="font-mono text-xs text-zinc-700 uppercase">This session has ended</p>
          )}
        </div>

        {session.members.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {session.members.map((m, i) => (
              <span
                key={i}
                className={`font-mono text-xs px-2 py-0.5 border ${
                  m.role === "host"
                    ? "border-red-800 text-red-400"
                    : "border-zinc-700 text-zinc-400"
                }`}
              >
                {m.display_name || "GOBLIN"}
              </span>
            ))}
          </div>
        )}

        {session.status !== "ended" && (
          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full py-3 bg-red-900 text-red-100 font-mono text-sm uppercase tracking-wider hover:bg-red-800 transition-colors disabled:opacity-50"
          >
            {joining
              ? "JOINING..."
              : user
                ? "JOIN GOBLIN DAY"
                : "SIGN IN TO JOIN"}
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add web/app/goblinday/s/
git commit -m "feat(goblin): add join page for invite links — /s/[code]"
```

---

### Task 10: Supabase Auth Configuration

**Files:** None (Supabase dashboard configuration)

- [ ] **Step 1: Add redirect URLs to Supabase**

In the Supabase dashboard → Authentication → URL Configuration → Redirect URLs, add:
- `https://goblinday.com/**`
- `https://www.goblinday.com/**`

This allows OAuth callbacks to work on the vanity domain.

- [ ] **Step 2: Verify auth flow end-to-end**

1. Navigate to `goblinday.com`
2. Click "Sign In" → should redirect to Google OAuth
3. After OAuth, should redirect back to `goblinday.com/auth/callback`
4. User should be logged in with their display name showing
5. Bookmark a movie → verify it persists on page refresh
6. Create a session → verify invite code is generated
7. Copy invite link → open in incognito → verify join flow works

- [ ] **Step 3: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix(goblin): auth flow polish and edge case fixes"
```

---

## File Map Summary

### New Files
| File | Purpose |
|------|---------|
| `supabase/migrations/20260326300000_goblin_user_management.sql` | Schema migration |
| `web/lib/goblin-utils.ts` | Invite code gen, member checks |
| `web/lib/hooks/useGoblinUser.ts` | Client-side auth + user movie state |
| `web/components/goblin/GoblinAuthBar.tsx` | Login/logout bar |
| `web/components/goblin/GoblinPlanningView.tsx` | Planning phase UI |
| `web/app/api/goblinday/me/route.ts` | GET user profile |
| `web/app/api/goblinday/me/bookmarks/route.ts` | Toggle bookmark/watched |
| `web/app/api/goblinday/me/lists/route.ts` | GET/POST named lists |
| `web/app/api/goblinday/me/lists/[id]/route.ts` | PATCH/DELETE named lists |
| `web/app/api/goblinday/sessions/join/[code]/route.ts` | GET/POST join session |
| `web/app/api/goblinday/sessions/[id]/propose/route.ts` | POST propose movie |
| `web/app/goblinday/s/[code]/page.tsx` | Join page (server) |
| `web/app/goblinday/s/[code]/GoblinJoinPage.tsx` | Join page (client) |

### Modified Files
| File | Changes |
|------|---------|
| `web/middleware.ts` | Exclude /api, /auth from vanity rewrite |
| `web/app/api/goblinday/route.ts` | Optional auth, per-user movie state join |
| `web/app/api/goblinday/[id]/route.ts` | Remove proposed/watched from mutable fields |
| `web/app/api/goblinday/sessions/route.ts` | Auth, invite codes, member scoping |
| `web/app/api/goblinday/sessions/[id]/route.ts` | Auth, status lifecycle, member checks |
| `web/app/api/goblinday/sessions/[id]/movies/route.ts` | Auth, per-user watched, proposed_by |
| `web/app/api/goblinday/sessions/[id]/themes/route.ts` | Auth, user_id on timeline |
| `web/app/api/goblinday/sessions/[id]/themes/[themeId]/route.ts` | Auth, member check |
| `web/components/goblin/GoblinDayPage.tsx` | Auth hook, per-user state, My List tab, planning flow |
| `web/components/goblin/GoblinMovieCard.tsx` | Per-user bookmark/watched props |
| `web/components/goblin/GoblinSessionView.tsx` | User attribution on timeline |
| `web/components/goblin/GoblinSessionHistory.tsx` | Status model, members display |
