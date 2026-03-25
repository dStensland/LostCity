# Goblin Day Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add live session tracking to Goblin Day — start a session, add movies as you watch, track emerging themes, build a timeline log, view past sessions.

**Architecture:** 5 new Supabase tables (sessions, session_movies, themes, theme_movies, timeline), 7 API routes, and new UI components that integrate into the existing `/goblinday` page. The "Next Goblin Day" tab transforms based on whether a session is active.

**Tech Stack:** Next.js 16, Supabase, Tailwind v4, existing Goblin Day brutalist design system

**Spec:** `docs/superpowers/specs/2026-03-25-goblin-sessions-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/20260325500000_goblin_sessions.sql` | Create | All 5 tables + RLS policies |
| `web/app/api/goblinday/sessions/route.ts` | Create | GET list + POST create session |
| `web/app/api/goblinday/sessions/[id]/route.ts` | Create | GET detail + PATCH end session |
| `web/app/api/goblinday/sessions/[id]/movies/route.ts` | Create | POST add movie to session |
| `web/app/api/goblinday/sessions/[id]/themes/route.ts` | Create | POST add theme |
| `web/app/api/goblinday/sessions/[id]/themes/[themeId]/route.ts` | Create | PATCH cancel/reactivate theme |
| `web/components/goblin/GoblinSessionView.tsx` | Create | Active session UI — movies + timeline + themes |
| `web/components/goblin/GoblinSessionHistory.tsx` | Create | Past sessions list + detail view |
| `web/components/goblin/GoblinDayPage.tsx` | Modify | Wire session state into "Next Goblin Day" tab |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260325500000_goblin_sessions.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Goblin Day sessions — live movie watching with themes
CREATE TABLE goblin_sessions (
  id serial PRIMARY KEY,
  name text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE goblin_session_movies (
  id serial PRIMARY KEY,
  session_id integer NOT NULL REFERENCES goblin_sessions(id) ON DELETE CASCADE,
  movie_id integer NOT NULL REFERENCES goblin_movies(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  watch_order integer NOT NULL,
  UNIQUE(session_id, movie_id)
);

CREATE TABLE goblin_themes (
  id serial PRIMARY KEY,
  session_id integer NOT NULL REFERENCES goblin_sessions(id) ON DELETE CASCADE,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  canceled_at timestamptz
);

CREATE TABLE goblin_theme_movies (
  theme_id integer NOT NULL REFERENCES goblin_themes(id) ON DELETE CASCADE,
  movie_id integer NOT NULL REFERENCES goblin_movies(id) ON DELETE CASCADE,
  PRIMARY KEY (theme_id, movie_id)
);

CREATE TABLE goblin_timeline (
  id serial PRIMARY KEY,
  session_id integer NOT NULL REFERENCES goblin_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('movie_started', 'movie_finished', 'theme_added', 'theme_canceled')),
  movie_id integer REFERENCES goblin_movies(id),
  theme_id integer REFERENCES goblin_themes(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Permissive RLS (same as goblin_movies)
ALTER TABLE goblin_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goblin_sessions_public" ON goblin_sessions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE goblin_session_movies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goblin_session_movies_public" ON goblin_session_movies FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE goblin_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goblin_themes_public" ON goblin_themes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE goblin_theme_movies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goblin_theme_movies_public" ON goblin_theme_movies FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE goblin_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goblin_timeline_public" ON goblin_timeline FOR ALL USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Apply migration**

Run: `cd /Users/coach/Projects/LostCity && echo "y" | npx supabase db push --include-all`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260325500000_goblin_sessions.sql
git commit -m "feat: goblin sessions tables — sessions, themes, timeline"
```

---

### Task 2: Sessions API — List + Create

**Files:**
- Create: `web/app/api/goblinday/sessions/route.ts`

- [ ] **Step 1: Write the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();

  const { data: sessions, error } = await supabase
    .from("goblin_sessions")
    .select(`
      id, name, date, is_active, created_at,
      goblin_session_movies(movie_id),
      goblin_themes(id, label, status)
    `)
    .order("date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = (sessions ?? []).map((s: any) => ({
    ...s,
    movie_count: s.goblin_session_movies?.length ?? 0,
    themes: (s.goblin_themes ?? []).filter((t: any) => t.status === "active").map((t: any) => t.label),
    canceled_themes: (s.goblin_themes ?? []).filter((t: any) => t.status === "canceled").map((t: any) => t.label),
    goblin_session_movies: undefined,
    goblin_themes: undefined,
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Check for existing active session
  const { data: active } = await supabase
    .from("goblin_sessions")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  if (active) {
    return NextResponse.json({ error: "A session is already active", active_id: active.id }, { status: 400 });
  }

  let body: { name?: string } = {};
  try { body = await request.json(); } catch {}

  const { data, error } = await supabase
    .from("goblin_sessions")
    .insert({ name: body.name || null } as never)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/api/goblinday/sessions/route.ts
git commit -m "feat: sessions API — list and create"
```

---

### Task 3: Session Detail API — Get + End

**Files:**
- Create: `web/app/api/goblinday/sessions/[id]/route.ts`

- [ ] **Step 1: Write the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: session, error } = await supabase
    .from("goblin_sessions")
    .select("id, name, date, is_active, created_at")
    .eq("id", parseInt(id))
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  // Get movies with full goblin_movies data
  const { data: sessionMovies } = await supabase
    .from("goblin_session_movies")
    .select("id, movie_id, watch_order, added_at, goblin_movies(*)")
    .eq("session_id", session.id)
    .order("watch_order");

  // Get themes with their tagged movies
  const { data: themes } = await supabase
    .from("goblin_themes")
    .select("id, label, status, created_at, canceled_at, goblin_theme_movies(movie_id)")
    .eq("session_id", session.id)
    .order("created_at");

  // Get timeline
  const { data: timeline } = await supabase
    .from("goblin_timeline")
    .select("id, event_type, movie_id, theme_id, created_at")
    .eq("session_id", session.id)
    .order("created_at");

  return NextResponse.json({
    ...session,
    movies: (sessionMovies ?? []).map((sm: any) => ({
      ...sm.goblin_movies,
      watch_order: sm.watch_order,
      added_at: sm.added_at,
    })),
    themes: themes ?? [],
    timeline: timeline ?? [],
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const body = await request.json();

  if (body.is_active === false) {
    const { data, error } = await supabase
      .from("goblin_sessions")
      .update({ is_active: false } as never)
      .eq("id", parseInt(id))
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Only ending sessions is supported" }, { status: 400 });
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/api/goblinday/sessions/\[id\]/route.ts
git commit -m "feat: session detail API — get full session + end session"
```

---

### Task 4: Session Movies API

**Files:**
- Create: `web/app/api/goblinday/sessions/[id]/movies/route.ts`

- [ ] **Step 1: Write the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sessionId = parseInt(id);
  const supabase = await createClient();

  const body = await request.json();
  const movieId = body.movie_id;
  if (!movieId) return NextResponse.json({ error: "movie_id required" }, { status: 400 });

  // Get next watch_order
  const { data: existing } = await supabase
    .from("goblin_session_movies")
    .select("watch_order")
    .eq("session_id", sessionId)
    .order("watch_order", { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.watch_order ?? 0) + 1;

  // Add to session
  const { error: insertError } = await supabase
    .from("goblin_session_movies")
    .insert({ session_id: sessionId, movie_id: movieId, watch_order: nextOrder } as never);

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Mark movie as watched
  await supabase
    .from("goblin_movies")
    .update({ watched: true } as never)
    .eq("id", movieId);

  // Add timeline entry
  await supabase
    .from("goblin_timeline")
    .insert({ session_id: sessionId, event_type: "movie_started", movie_id: movieId } as never);

  return NextResponse.json({ watch_order: nextOrder }, { status: 201 });
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/api/goblinday/sessions/\[id\]/movies/route.ts
git commit -m "feat: add movie to session API — auto watch_order + timeline"
```

---

### Task 5: Themes API

**Files:**
- Create: `web/app/api/goblinday/sessions/[id]/themes/route.ts`
- Create: `web/app/api/goblinday/sessions/[id]/themes/[themeId]/route.ts`

- [ ] **Step 1: Write the add theme route**

```typescript
// web/app/api/goblinday/sessions/[id]/themes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sessionId = parseInt(id);
  const supabase = await createClient();

  const body = await request.json();
  if (!body.label?.trim()) return NextResponse.json({ error: "label required" }, { status: 400 });

  // Create theme
  const { data: theme, error } = await supabase
    .from("goblin_themes")
    .insert({ session_id: sessionId, label: body.label.trim() } as never)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Tag movies if provided
  if (body.movie_ids?.length > 0) {
    const rows = body.movie_ids.map((mid: number) => ({
      theme_id: theme.id,
      movie_id: mid,
    }));
    await supabase.from("goblin_theme_movies").insert(rows as never);
  }

  // Timeline entry
  await supabase
    .from("goblin_timeline")
    .insert({ session_id: sessionId, event_type: "theme_added", theme_id: theme.id } as never);

  return NextResponse.json(theme, { status: 201 });
}
```

- [ ] **Step 2: Write the cancel/reactivate theme route**

```typescript
// web/app/api/goblinday/sessions/[id]/themes/[themeId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; themeId: string }> }
) {
  const { id, themeId } = await params;
  const sessionId = parseInt(id);
  const supabase = await createClient();

  const body = await request.json();
  const status = body.status;
  if (status !== "active" && status !== "canceled") {
    return NextResponse.json({ error: "status must be active or canceled" }, { status: 400 });
  }

  const updates: any = { status };
  if (status === "canceled") updates.canceled_at = new Date().toISOString();
  else updates.canceled_at = null;

  const { data, error } = await supabase
    .from("goblin_themes")
    .update(updates as never)
    .eq("id", parseInt(themeId))
    .eq("session_id", sessionId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Timeline entry
  await supabase
    .from("goblin_timeline")
    .insert({
      session_id: sessionId,
      event_type: status === "canceled" ? "theme_canceled" : "theme_added",
      theme_id: parseInt(themeId),
    } as never);

  return NextResponse.json(data);
}
```

- [ ] **Step 3: Commit**

```bash
git add web/app/api/goblinday/sessions/\[id\]/themes/
git commit -m "feat: themes API — add, cancel, reactivate with timeline"
```

---

### Task 6: Active Session UI

**Files:**
- Create: `web/components/goblin/GoblinSessionView.tsx`

This is the main active session component. It shows:
- Current/last movie watched
- Movie picker (from proposed movies)
- Active themes as pills with X to cancel
- Add theme input with movie checkboxes
- Timeline log

- [ ] **Step 1: Write the component**

The component receives the full session data and a list of proposed movies. It handles all the mutations (add movie, add theme, cancel theme) with optimistic UI and refetches session data after each action.

Key interactions:
- "ADD MOVIE" opens a list of proposed movies. Clicking one sends POST to movies API.
- Active themes shown as red pills with X button. Clicking X sends PATCH to cancel.
- "ADD THEME" text input. On submit, shows checkboxes for session movies to tag. Sends POST to themes API.
- Timeline renders as a simple list with icons per event_type.

Style: brutalist, monospace, all-caps, matching existing Goblin Day design. No rounded corners.

- [ ] **Step 2: Commit**

```bash
git add web/components/goblin/GoblinSessionView.tsx
git commit -m "feat: GoblinSessionView — active session with movies, themes, timeline"
```

---

### Task 7: Session History UI

**Files:**
- Create: `web/components/goblin/GoblinSessionHistory.tsx`

- [ ] **Step 1: Write the component**

Shows:
- "START GOBLIN DAY" button (sends POST to create session)
- List of past sessions: date, name, movie count, surviving theme pills
- Clicking a past session expands to show full detail (movies in order, themes, timeline)

Style: same brutalist treatment.

- [ ] **Step 2: Commit**

```bash
git add web/components/goblin/GoblinSessionHistory.tsx
git commit -m "feat: GoblinSessionHistory — start session + past session list"
```

---

### Task 8: Wire Into GoblinDayPage

**Files:**
- Modify: `web/components/goblin/GoblinDayPage.tsx`
- Modify: `web/app/goblinday/page.tsx`

- [ ] **Step 1: Update server page to fetch active session**

In `web/app/goblinday/page.tsx`, add a query for the active session alongside the movies query. Pass both to GoblinDayPage.

- [ ] **Step 2: Update GoblinDayPage**

The "Next Goblin Day" tab now:
- If there's an active session → renders `<GoblinSessionView>`
- If no active session → renders `<GoblinSessionHistory>` (with start button + past sessions)

Add active session state. When a session is started or ended, refetch via the API.

- [ ] **Step 3: Verify everything works**

Test flow:
1. Click "START GOBLIN DAY" → session created
2. Add a movie → appears in watched list, timeline shows entry
3. Add a theme with movie tags → theme pill appears, timeline entry
4. Cancel a theme → struck through, timeline entry
5. Add another movie → watch_order increments
6. End session → switches to history view, session appears in list
7. Click past session → detail expands with full timeline

- [ ] **Step 4: Commit**

```bash
git add web/components/goblin/GoblinDayPage.tsx web/app/goblinday/page.tsx
git commit -m "feat: wire sessions into GoblinDayPage — active session + history"
```

---

### Task 9: TypeScript Check + Push

- [ ] **Step 1: Run tsc**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Fix any errors in goblin files.

- [ ] **Step 2: Push**

```bash
git push origin main
```
