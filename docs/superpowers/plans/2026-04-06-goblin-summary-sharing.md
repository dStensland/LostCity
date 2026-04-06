# Goblin Day Summary Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shareable public recap page for ended goblin day sessions, with session name in history and freeform attendee editing.

**Architecture:** Extend the existing `/goblinday/s/[code]` route to show a full recap when the session is ended (currently a dead-end). Add `guest_names text[]` column for freeform attendees. Extend the join GET API to return movies/themes/timeline for ended sessions. Add guest management UI to the history detail view.

**Tech Stack:** Next.js API routes, Supabase, React components (existing goblin component patterns)

---

### Task 1: Migration — add guest_names column

**Files:**
- Create: `supabase/migrations/20260406000001_goblin_guest_names.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Add freeform guest names for attendees who aren't app users
ALTER TABLE goblin_sessions
  ADD COLUMN IF NOT EXISTS guest_names text[] DEFAULT '{}';
```

- [ ] **Step 2: Apply migration to remote database**

```bash
source .env && psql "$DATABASE_URL" -f supabase/migrations/20260406000001_goblin_guest_names.sql
```

Expected: `ALTER TABLE`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260406000001_goblin_guest_names.sql
git commit -m "feat: add guest_names column to goblin_sessions"
```

---

### Task 2: API — PATCH supports guest_names, join GET returns full summary

**Files:**
- Modify: `web/app/api/goblinday/sessions/[id]/route.ts` (PATCH handler, ~line 118)
- Modify: `web/app/api/goblinday/sessions/join/[code]/route.ts` (GET handler)

- [ ] **Step 1: Add guest_names to PATCH handler**

In `web/app/api/goblinday/sessions/[id]/route.ts`, add a `guest_names` update branch in the PATCH handler. Insert this block after the name-only update block (after line 139) and before the status transition block:

```typescript
    // Guest names update — host only
    if (body.guest_names !== undefined && !body.status) {
      const isHost = await isSessionHost(serviceClient, sessionId, user.id);
      if (!isHost) {
        return NextResponse.json({ error: "Only the host can edit guest names" }, { status: 403 });
      }
      if (!Array.isArray(body.guest_names) || !body.guest_names.every((n: unknown) => typeof n === "string")) {
        return NextResponse.json({ error: "guest_names must be an array of strings" }, { status: 400 });
      }
      const { data, error } = await serviceClient
        .from("goblin_sessions")
        .update({ guest_names: body.guest_names } as never)
        .eq("id", sessionId)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }
```

- [ ] **Step 2: Add guest_names to GET session detail**

In `web/app/api/goblinday/sessions/[id]/route.ts`, in the GET handler's select query (~line 20), add `guest_names`:

Change:
```typescript
      .select("id, name, date, status, invite_code, created_by, created_at")
```
To:
```typescript
      .select("id, name, date, status, invite_code, created_by, created_at, guest_names")
```

- [ ] **Step 3: Extend join GET to return summary data for ended sessions**

In `web/app/api/goblinday/sessions/join/[code]/route.ts`, add `guest_names` to the initial select and add full summary data when the session is ended/canceled. Replace the GET handler's return block (lines 68-78) with:

```typescript
  const baseResponse = {
    id: s.id,
    name: s.name,
    date: s.date,
    status: s.status,
    invite_code: s.invite_code,
    created_at: s.created_at,
    member_count: members.length,
    members,
    guest_names: s.guest_names ?? [],
    is_member,
  };

  // For ended/canceled sessions, include full summary data
  if (s.status === "ended" || s.status === "canceled") {
    const { data: sessionMovies } = await serviceClient
      .from("goblin_session_movies")
      .select("id, movie_id, watch_order, added_at, proposed_by, goblin_movies(*)")
      .eq("session_id", s.id)
      .order("watch_order");

    const { data: themes } = await serviceClient
      .from("goblin_themes")
      .select("id, label, status, created_at, canceled_at, goblin_theme_movies(movie_id)")
      .eq("session_id", s.id)
      .order("created_at");

    const { data: timeline } = await serviceClient
      .from("goblin_timeline")
      .select("id, event_type, movie_id, theme_id, created_at, user_id")
      .eq("session_id", s.id)
      .order("created_at");

    // Resolve user names for timeline
    const timelineUserIds = [...new Set((timeline ?? []).map((t: any) => t.user_id).filter(Boolean))];
    if (timelineUserIds.length > 0) {
      const { data: tlProfiles } = await serviceClient
        .from("profiles")
        .select("id, display_name")
        .in("id", timelineUserIds);
      const tlMap = Object.fromEntries(
        (tlProfiles ?? []).map((p: any) => [p.id, p.display_name])
      );
      for (const t of (timeline ?? []) as any[]) {
        t.user_name = t.user_id ? tlMap[t.user_id] ?? null : null;
      }
    }

    return NextResponse.json({
      ...baseResponse,
      movies: (sessionMovies ?? []).map((sm: any) => ({
        id: sm.goblin_movies?.id ?? sm.movie_id,
        title: sm.goblin_movies?.title ?? "Unknown",
        poster_path: sm.goblin_movies?.poster_path ?? null,
        watch_order: sm.watch_order,
      })),
      themes: (themes ?? []).map((t: any) => ({
        id: t.id,
        label: t.label,
        status: t.status,
        goblin_theme_movies: t.goblin_theme_movies ?? [],
      })),
      timeline: (timeline ?? []).map((t: any) => ({
        id: t.id,
        event_type: t.event_type,
        movie_id: t.movie_id,
        theme_id: t.theme_id,
        created_at: t.created_at,
        user_name: t.user_name ?? null,
      })),
    });
  }

  return NextResponse.json(baseResponse);
```

Also add `guest_names` to the initial select query (line 22):

Change:
```
      id, name, date, status, invite_code, created_at,
      goblin_session_members(user_id, role)
```
To:
```
      id, name, date, status, invite_code, created_at, guest_names,
      goblin_session_members(user_id, role)
```

- [ ] **Step 4: Type-check**

```bash
cd web && npx tsc --noEmit
```

Expected: clean

- [ ] **Step 5: Commit**

```bash
git add web/app/api/goblinday/sessions/[id]/route.ts web/app/api/goblinday/sessions/join/[code]/route.ts
git commit -m "feat: API support for guest_names and public session summary"
```

---

### Task 3: Public summary page — GoblinSummaryView component

**Files:**
- Create: `web/components/goblin/GoblinSummaryView.tsx`
- Modify: `web/app/goblinday/s/[code]/GoblinJoinPage.tsx`

- [ ] **Step 1: Create GoblinSummaryView component**

Create `web/components/goblin/GoblinSummaryView.tsx`. This is the public, read-only recap page. It reuses the same visual language as the session history detail view but is self-contained for the public route.

```tsx
"use client";

interface SummaryMovie {
  id: number;
  title: string;
  poster_path: string | null;
  watch_order: number;
}

interface SummaryTheme {
  id: number;
  label: string;
  status: string;
  goblin_theme_movies: Array<{ movie_id: number }>;
}

interface SummaryTimelineEntry {
  id: number;
  event_type: string;
  movie_id: number | null;
  theme_id: number | null;
  user_name: string | null;
  created_at: string;
}

interface SummaryMember {
  display_name: string | null;
  avatar_url: string | null;
}

interface GoblinSummaryProps {
  name: string | null;
  date: string | null;
  members: SummaryMember[];
  guestNames: string[];
  movies: SummaryMovie[];
  themes: SummaryTheme[];
  timeline: SummaryTimelineEntry[];
}

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w200";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
}

function formatTimestamp(isoStr: string): string {
  const d = new Date(isoStr);
  return d
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    .toUpperCase();
}

export default function GoblinSummaryView({
  name,
  date,
  members,
  guestNames,
  movies,
  themes,
  timeline,
}: GoblinSummaryProps) {
  const sortedMovies = [...movies].sort((a, b) => a.watch_order - b.watch_order);
  const activeThemes = themes.filter((t) => t.status === "active");
  const canceledThemes = themes.filter((t) => t.status === "canceled");

  // Compute completed themes (tagged on every watched movie)
  const movieIds = new Set(sortedMovies.map((m) => m.id));
  const completedThemes = activeThemes.filter(
    (t) =>
      movieIds.size > 0 &&
      sortedMovies.every((m) =>
        t.goblin_theme_movies.some((tm) => tm.movie_id === m.id)
      )
  );
  const completedIds = new Set(completedThemes.map((t) => t.id));
  const incompleteThemes = activeThemes.filter((t) => !completedIds.has(t.id));

  const movieMap = new Map(movies.map((m) => [m.id, m]));
  const themeMap = new Map(themes.map((t) => [t.id, t]));

  // All attendee names: real members + guests
  const attendeeNames = [
    ...members.map((m) => m.display_name ?? "Goblin"),
    ...guestNames,
  ];

  const sortedTimeline = [...timeline].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div className="min-h-screen bg-black text-zinc-400 font-mono">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <p className="text-red-900 text-2xs tracking-[0.3em] uppercase">
            A RECAP OF
          </p>
          <h1 className="text-red-500 text-2xl font-black tracking-[0.2em] uppercase">
            {name || "GOBLIN DAY"}
          </h1>
          {date && (
            <p className="text-zinc-600 text-xs tracking-[0.2em] uppercase">
              {formatDate(date)}
            </p>
          )}
        </div>

        {/* Attendees */}
        {attendeeNames.length > 0 && (
          <section>
            <h2 className="text-red-600 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
              GOBLINS [{attendeeNames.length}]
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {attendeeNames.map((name, i) => (
                <span
                  key={i}
                  className="text-2xs px-2 py-0.5 border border-zinc-800 text-zinc-400 tracking-wider uppercase"
                >
                  {name}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Movies */}
        {sortedMovies.length > 0 && (
          <section>
            <h2 className="text-red-600 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
              WATCH ORDER [{sortedMovies.length}]
            </h2>
            <div className="space-y-1.5">
              {sortedMovies.map((movie, i) => (
                <div key={movie.id} className="flex items-center gap-2.5">
                  <span className="text-red-700 font-black text-xs tabular-nums w-5 text-right shrink-0">
                    {i + 1}.
                  </span>
                  {movie.poster_path && (
                    <div className="w-6 h-9 flex-shrink-0 bg-zinc-900 overflow-hidden">
                      <img
                        src={`${TMDB_IMAGE_BASE}${movie.poster_path}`}
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
          </section>
        )}

        {/* Completed themes */}
        {completedThemes.length > 0 && (
          <section>
            <h2 className="text-amber-500 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
              COMPLETED THEMES [{completedThemes.length}]
            </h2>
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
          </section>
        )}

        {/* Incomplete themes */}
        {incompleteThemes.length > 0 && (
          <section>
            <h2 className="text-red-600 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
              ACTIVE THEMES [{incompleteThemes.length}]
            </h2>
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
          </section>
        )}

        {/* Canceled themes */}
        {canceledThemes.length > 0 && (
          <section>
            <h2 className="text-zinc-600 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
              CANCELED THEMES [{canceledThemes.length}]
            </h2>
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
          </section>
        )}

        {/* Timeline */}
        {sortedTimeline.length > 0 && (
          <section>
            <h2 className="text-red-600 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
              TIMELINE
            </h2>
            <div className="space-y-0.5">
              {sortedTimeline.map((entry) => {
                const movie = entry.movie_id ? movieMap.get(entry.movie_id) : null;
                const theme = entry.theme_id ? themeMap.get(entry.theme_id) : null;
                return (
                  <div key={entry.id} className="flex items-baseline gap-2 text-2xs">
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
                      {movie && <span className="text-zinc-400"> — {movie.title}</span>}
                      {theme && <span className="text-zinc-400"> — {theme.label}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Empty state */}
        {sortedMovies.length === 0 && themes.length === 0 && timeline.length === 0 && (
          <p className="text-zinc-700 text-xs tracking-widest uppercase text-center py-8">
            // NO DATA RECORDED
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire GoblinSummaryView into GoblinJoinPage**

In `web/app/goblinday/s/[code]/GoblinJoinPage.tsx`:

Add the import at the top (after existing imports):
```typescript
import GoblinSummaryView from "@/components/goblin/GoblinSummaryView";
```

Update the `SessionInfo` interface to include summary fields:
```typescript
interface SessionInfo {
  id: number;
  name: string;
  date: string | null;
  status: string;
  member_count: number;
  members: SessionMember[];
  guest_names?: string[];
  is_member: boolean;
  // Summary fields (only present for ended/canceled sessions)
  movies?: Array<{
    id: number;
    title: string;
    poster_path: string | null;
    watch_order: number;
  }>;
  themes?: Array<{
    id: number;
    label: string;
    status: string;
    goblin_theme_movies: Array<{ movie_id: number }>;
  }>;
  timeline?: Array<{
    id: number;
    event_type: string;
    movie_id: number | null;
    theme_id: number | null;
    user_name: string | null;
    created_at: string;
  }>;
}
```

Replace the "Session ended" block (the `if (session.status === "ended")` block, lines 132-151) with:
```tsx
  // Session ended or canceled — show public summary
  if (session.status === "ended" || session.status === "canceled") {
    return (
      <GoblinSummaryView
        name={session.name}
        date={session.date}
        members={session.members}
        guestNames={session.guest_names ?? []}
        movies={session.movies ?? []}
        themes={session.themes ?? []}
        timeline={session.timeline ?? []}
      />
    );
  }
```

- [ ] **Step 3: Type-check**

```bash
cd web && npx tsc --noEmit
```

Expected: clean

- [ ] **Step 4: Commit**

```bash
git add web/components/goblin/GoblinSummaryView.tsx web/app/goblinday/s/[code]/GoblinJoinPage.tsx
git commit -m "feat: public goblin day summary page at /s/[code]"
```

---

### Task 4: Guest management UI in session history detail

**Files:**
- Modify: `web/components/goblin/GoblinSessionHistory.tsx`

- [ ] **Step 1: Add guest_names to SessionDetail interface**

In `web/components/goblin/GoblinSessionHistory.tsx`, add `guest_names` to the `SessionDetail` interface (~line 94):

```typescript
interface SessionDetail {
  id: number;
  name: string | null;
  date: string;
  status: SessionStatus;
  invite_code?: string | null;
  members?: SessionMember[];
  guest_names?: string[];
  movies: {
```

- [ ] **Step 2: Add guest editing UI to SessionDetailView**

In the `SessionDetailView` component, add state and handlers for guest management. After the existing `savingName` state (~line 189), add:

```typescript
  const [guestInput, setGuestInput] = useState("");
  const [savingGuests, setSavingGuests] = useState(false);
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
```

Then add the guest UI section after the existing Members section (after line 296's closing `</div>`). Insert:

```tsx
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
```

- [ ] **Step 3: Show guests in the GOBLINS section alongside members**

In the existing Members section (~line 277-296), add guest names after the members loop. Replace the members `</div>` closing div (line 295-296) with:

```tsx
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
```

- [ ] **Step 4: Type-check**

```bash
cd web && npx tsc --noEmit
```

Expected: clean

- [ ] **Step 5: Commit**

```bash
git add web/components/goblin/GoblinSessionHistory.tsx
git commit -m "feat: guest attendee management in session history"
```

---

### Task 5: Add share button to session history detail

**Files:**
- Modify: `web/components/goblin/GoblinSessionHistory.tsx`

- [ ] **Step 1: Add share functionality to SessionDetailView**

In `SessionDetailView`, add state for the copy feedback after existing state declarations:

```typescript
  const [copied, setCopied] = useState(false);
```

Add the share URL computation and copy handler:

```typescript
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
```

Note: `window.location.pathname` on goblinday.com is `/` (middleware rewrites to `/goblinday`), so the share URL will be `goblinday.com/s/[code]`. On lostcity.com it'll be `lostcity.com/goblinday/s/[code]`. Both resolve correctly.

- [ ] **Step 2: Add share button to the detail view**

Add a share section at the top of the `SessionDetailView` return, right after the opening `<div>` (line 231), before the editable name section:

```tsx
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
```

- [ ] **Step 3: Type-check**

```bash
cd web && npx tsc --noEmit
```

Expected: clean

- [ ] **Step 4: Commit**

```bash
git add web/components/goblin/GoblinSessionHistory.tsx
git commit -m "feat: share recap link in session history detail"
```

---

### Task 6: Final verification and deploy

- [ ] **Step 1: Type-check full project**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 2: Push to deploy**

```bash
git push origin main
```

- [ ] **Step 3: Apply migration if not done already**

```bash
source .env && psql "$DATABASE_URL" -f supabase/migrations/20260406000001_goblin_guest_names.sql
```

- [ ] **Step 4: Browser-test**

After deploy:
1. Go to goblinday.com → start a session → end it
2. In history, expand the ended session → verify name editing, guest adding, share link
3. Copy the share link → open in incognito → verify public summary renders with movies, themes, attendees, timeline
4. Verify the share link works on both goblinday.com and the main domain
