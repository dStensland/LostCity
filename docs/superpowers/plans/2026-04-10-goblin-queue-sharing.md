# Goblin Day: Public Queue & Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shareable public queue page with TMDB-backed movie recommendations from visitors, and private recommendation management in the watchlist view.

**Architecture:** New `goblin_watchlist_recommendations` table. Public API routes for viewing queue, searching TMDB, and submitting recommendations (rate-limited, input-validated). Private API routes for managing recommendations. Server-rendered public page at `/goblinday/queue/[slug]` with a client-side recommend form. Recommendations section added to existing `GoblinWatchlistView`. Share button on private watchlist.

**Tech Stack:** Next.js 16 App Router, Supabase (service client), React hooks, Tailwind v4, TMDB API, Zod validation, rate limiting via `@upstash/ratelimit`.

**Spec:** `docs/superpowers/specs/2026-04-10-goblin-queue-sharing-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/20260410200000_goblin_watchlist_recommendations.sql` | Create | Table, RLS, partial unique indexes |
| `database/migrations/20260410200000_goblin_watchlist_recommendations.sql` | Create | Parity copy |
| `web/app/api/goblinday/queue/[slug]/route.ts` | Create | GET public queue |
| `web/app/api/goblinday/queue/[slug]/search/route.ts` | Create | GET public TMDB search proxy |
| `web/app/api/goblinday/queue/[slug]/recommend/route.ts` | Create | POST submit recommendation |
| `web/app/api/goblinday/me/recommendations/route.ts` | Create | GET pending recommendations |
| `web/app/api/goblinday/me/recommendations/[id]/action/route.ts` | Create | POST add/dismiss recommendation |
| `web/app/goblinday/queue/[slug]/page.tsx` | Create | Server-rendered public queue page |
| `web/app/goblinday/queue/[slug]/GoblinQueuePublicView.tsx` | Create | Client component: queue grid + recommend form |
| `web/lib/hooks/useGoblinWatchlist.ts` | Modify | Add recommendations state + actions |
| `web/components/goblin/GoblinWatchlistView.tsx` | Modify | Add recommendations section + share button |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260410200000_goblin_watchlist_recommendations.sql`
- Create: `database/migrations/20260410200000_goblin_watchlist_recommendations.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260410200000_goblin_watchlist_recommendations.sql`:

```sql
-- Goblin Day: Watchlist Recommendations
-- Visitors can recommend movies to a queue owner.

CREATE TABLE goblin_watchlist_recommendations (
  id serial PRIMARY KEY,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id integer NOT NULL REFERENCES goblin_movies(id),
  recommender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recommender_name text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'added', 'dismissed')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE goblin_watchlist_recommendations ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a recommendation (public endpoint)
CREATE POLICY "Public insert recommendations" ON goblin_watchlist_recommendations
  FOR INSERT WITH CHECK (true);

-- Queue owner can read their own recommendations
CREATE POLICY "Owner read recommendations" ON goblin_watchlist_recommendations
  FOR SELECT USING (auth.uid() = target_user_id);

-- Queue owner can update status (add/dismiss)
CREATE POLICY "Owner update recommendations" ON goblin_watchlist_recommendations
  FOR UPDATE USING (auth.uid() = target_user_id);

-- Partial unique index: authenticated recommenders can't double-recommend
CREATE UNIQUE INDEX idx_watchlist_rec_auth_unique
  ON goblin_watchlist_recommendations (target_user_id, movie_id, recommender_user_id)
  WHERE recommender_user_id IS NOT NULL;

-- Partial unique index: anonymous recommenders deduped by name
CREATE UNIQUE INDEX idx_watchlist_rec_anon_unique
  ON goblin_watchlist_recommendations (target_user_id, movie_id, recommender_name)
  WHERE recommender_user_id IS NULL;

-- Index for efficient pending queries
CREATE INDEX idx_watchlist_rec_pending
  ON goblin_watchlist_recommendations (target_user_id, status);
```

- [ ] **Step 2: Copy to database/migrations for parity**

```bash
cp supabase/migrations/20260410200000_goblin_watchlist_recommendations.sql database/migrations/20260410200000_goblin_watchlist_recommendations.sql
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260410200000_goblin_watchlist_recommendations.sql database/migrations/20260410200000_goblin_watchlist_recommendations.sql
git commit -m "feat(goblin): add watchlist recommendations table with RLS and partial unique indexes"
```

---

## Task 2: Public Queue API Route

**Files:**
- Create: `web/app/api/goblinday/queue/[slug]/route.ts`

- [ ] **Step 1: Create the route**

This follows the exact pattern of `web/app/api/goblinday/log/[slug]/route.ts` but queries `goblin_watchlist_entries` instead of `goblin_log_entries`.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;
  const serviceClient = createServiceClient();

  // Resolve user by username (same as log public page)
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("username", slug)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const userId = (profile as { id: string }).id;

  // Fetch watchlist entries
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
    .eq("user_id", userId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("added_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch queue" }, { status: 500 });
  }

  // Fetch watchlist tags for entries
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

  return NextResponse.json({
    user: {
      username: (profile as any).username,
      display_name: (profile as any).display_name,
      avatar_url: (profile as any).avatar_url,
    },
    entries: result,
    count: result.length,
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/app/api/goblinday/queue/\[slug\]/route.ts
git commit -m "feat(goblin): add public queue API route"
```

---

## Task 3: Public TMDB Search Proxy + Recommend Endpoint

**Files:**
- Create: `web/app/api/goblinday/queue/[slug]/search/route.ts`
- Create: `web/app/api/goblinday/queue/[slug]/recommend/route.ts`

- [ ] **Step 1: Create the TMDB search proxy**

Create `web/app/api/goblinday/queue/[slug]/search/route.ts`. This is a public (no auth) version of the existing `web/app/api/goblinday/tmdb/search/route.ts`, rate-limited:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const TMDB_BASE = "https://api.themoviedb.org/3";

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.search, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2 || q.length > 100) {
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
}
```

- [ ] **Step 2: Create the recommend endpoint**

Create `web/app/api/goblinday/queue/[slug]/recommend/route.ts`. Public endpoint with optional auth, rate-limited, input-validated:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { checkBodySize } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const TMDB_BASE = "https://api.themoviedb.org/3";

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Rate limit
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  // Body size check
  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

  const { slug } = await params;
  const serviceClient = createServiceClient();

  // Resolve target user
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, display_name")
    .eq("username", slug)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const targetUserId = (profile as { id: string }).id;

  // Parse and validate body
  const body = await request.json();
  const tmdbId = body.tmdb_id;
  const rawName = body.recommender_name;
  const rawNote = body.note;

  if (!tmdbId || typeof tmdbId !== "number" || tmdbId < 1) {
    return NextResponse.json({ error: "Valid tmdb_id required" }, { status: 400 });
  }

  if (!rawName || typeof rawName !== "string") {
    return NextResponse.json({ error: "recommender_name required" }, { status: 400 });
  }

  const recommenderName = rawName.trim().slice(0, 50);
  if (recommenderName.length < 1) {
    return NextResponse.json({ error: "recommender_name cannot be empty" }, { status: 400 });
  }

  const note = rawNote ? String(rawNote).trim().slice(0, 500) || null : null;

  // Check optional auth — set recommender_user_id server-side only
  let recommenderUserId: string | null = null;
  let authedName: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      recommenderUserId = user.id;
      // Get their display name
      const { data: recommenderProfile } = await serviceClient
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      authedName = (recommenderProfile as any)?.display_name || null;
    }
  } catch {
    // Not authenticated — that's fine
  }

  const finalName = authedName || recommenderName;

  // Ensure movie exists
  const movie = await ensureMovie(serviceClient, tmdbId);
  if (!movie) {
    return NextResponse.json({ error: "Failed to find or create movie" }, { status: 500 });
  }

  // Duplicate check — server-side via service client
  if (recommenderUserId) {
    const { data: existing } = await serviceClient
      .from("goblin_watchlist_recommendations")
      .select("id")
      .eq("target_user_id", targetUserId)
      .eq("movie_id", movie.id)
      .eq("recommender_user_id", recommenderUserId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "You already recommended this movie" }, { status: 409 });
    }
  } else {
    const { data: existing } = await serviceClient
      .from("goblin_watchlist_recommendations")
      .select("id")
      .eq("target_user_id", targetUserId)
      .eq("movie_id", movie.id)
      .eq("recommender_name", finalName)
      .is("recommender_user_id", null)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "You already recommended this movie" }, { status: 409 });
    }
  }

  // Insert recommendation
  const { data: rec, error } = await serviceClient
    .from("goblin_watchlist_recommendations")
    .insert({
      target_user_id: targetUserId,
      movie_id: movie.id,
      recommender_user_id: recommenderUserId,
      recommender_name: finalName,
      note,
    } as never)
    .select("id")
    .single();

  if (error || !rec) {
    return NextResponse.json({ error: "Failed to submit recommendation" }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: (rec as { id: number }).id }, { status: 201 });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add web/app/api/goblinday/queue/\[slug\]/search/route.ts web/app/api/goblinday/queue/\[slug\]/recommend/route.ts
git commit -m "feat(goblin): add public TMDB search proxy and recommend endpoint with rate limiting"
```

---

## Task 4: Private Recommendation Management API Routes

**Files:**
- Create: `web/app/api/goblinday/me/recommendations/route.ts`
- Create: `web/app/api/goblinday/me/recommendations/[id]/action/route.ts`

- [ ] **Step 1: Create GET pending recommendations route**

Create `web/app/api/goblinday/me/recommendations/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_request: NextRequest, { user, serviceClient }) => {
  const { data: recs, error } = await serviceClient
    .from("goblin_watchlist_recommendations")
    .select(`
      id, recommender_name, recommender_user_id, note, status, created_at,
      movie:goblin_movies!movie_id (
        id, tmdb_id, title, poster_path, release_date, genres,
        runtime_minutes, director, year
      )
    `)
    .eq("target_user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch recommendations" }, { status: 500 });
  }

  return NextResponse.json({ recommendations: recs || [] });
});
```

- [ ] **Step 2: Create action route (add/dismiss)**

Create `web/app/api/goblinday/me/recommendations/[id]/action/route.ts`:

```typescript
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

    // Verify ownership and get movie_id
    const { data: rec } = await serviceClient
      .from("goblin_watchlist_recommendations")
      .select("id, movie_id, status")
      .eq("id", recId)
      .eq("target_user_id", user.id)
      .maybeSingle();

    if (!rec) {
      return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
    }

    if ((rec as { status: string }).status !== "pending") {
      return NextResponse.json({ error: "Recommendation already handled" }, { status: 409 });
    }

    const movieId = (rec as { movie_id: number }).movie_id;

    if (action === "add") {
      // Add to watchlist at bottom of queue
      const { data: maxRow } = await serviceClient
        .from("goblin_watchlist_entries")
        .select("sort_order")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      const nextOrder = ((maxRow as { sort_order: number } | null)?.sort_order ?? 0) + 1;

      // Insert watchlist entry (ignore if already on watchlist)
      await serviceClient
        .from("goblin_watchlist_entries")
        .insert({
          user_id: user.id,
          movie_id: movieId,
          sort_order: nextOrder,
        } as never)
        .select("id")
        .maybeSingle();
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

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add web/app/api/goblinday/me/recommendations/route.ts web/app/api/goblinday/me/recommendations/\[id\]/action/route.ts
git commit -m "feat(goblin): add private recommendation management API routes"
```

---

## Task 5: Extend useGoblinWatchlist Hook with Recommendations

**Files:**
- Modify: `web/lib/hooks/useGoblinWatchlist.ts`

- [ ] **Step 1: Read the existing hook**

Read `web/lib/hooks/useGoblinWatchlist.ts` to understand current structure.

- [ ] **Step 2: Add recommendation types, state, and actions**

Add a `Recommendation` interface and extend the hook:

At the top of the file, after the existing imports, add:

```typescript
export interface Recommendation {
  id: number;
  recommender_name: string;
  recommender_user_id: string | null;
  note: string | null;
  status: string;
  created_at: string;
  movie: {
    id: number;
    tmdb_id: number | null;
    title: string;
    poster_path: string | null;
    release_date: string | null;
    genres: string[] | null;
    runtime_minutes: number | null;
    director: string | null;
    year: number | null;
  };
}
```

Add to `UseGoblinWatchlistState`:

```typescript
  recommendations: Recommendation[];
  recommendationCount: number;
```

Add to `UseGoblinWatchlistActions`:

```typescript
  addRecommendation: (id: number) => Promise<boolean>;
  dismissRecommendation: (id: number) => Promise<boolean>;
```

Inside the hook function body, add:

```typescript
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const fetchRecommendations = useCallback(async () => {
    try {
      const res = await fetch("/api/goblinday/me/recommendations");
      if (!res.ok) return;
      const data = await res.json();
      setRecommendations(data.recommendations || []);
    } catch {
      // Non-critical
    }
  }, []);
```

Update the `useEffect` that fetches on mount to also fetch recommendations:

```typescript
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([fetchEntries(), fetchTags(), fetchRecommendations()]).finally(() =>
      setLoading(false)
    );
  }, [isAuthenticated, fetchEntries, fetchTags, fetchRecommendations]);
```

Add the action handlers:

```typescript
  const addRecommendation = useCallback(
    async (recId: number) => {
      setRecommendations((prev) => prev.filter((r) => r.id !== recId));
      try {
        const res = await fetch(`/api/goblinday/me/recommendations/${recId}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add" }),
        });
        if (!res.ok) {
          await fetchRecommendations();
          return false;
        }
        await fetchEntries();
        return true;
      } catch {
        await fetchRecommendations();
        return false;
      }
    },
    [fetchRecommendations, fetchEntries]
  );

  const dismissRecommendation = useCallback(
    async (recId: number) => {
      setRecommendations((prev) => prev.filter((r) => r.id !== recId));
      try {
        const res = await fetch(`/api/goblinday/me/recommendations/${recId}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "dismiss" }),
        });
        if (!res.ok) {
          await fetchRecommendations();
          return false;
        }
        return true;
      } catch {
        await fetchRecommendations();
        return false;
      }
    },
    [fetchRecommendations]
  );
```

Add to the return object:

```typescript
    recommendations,
    recommendationCount: recommendations.length,
    addRecommendation,
    dismissRecommendation,
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add web/lib/hooks/useGoblinWatchlist.ts
git commit -m "feat(goblin): extend useGoblinWatchlist with recommendation state and actions"
```

---

## Task 6: Public Queue Page (Server + Client Components)

**Files:**
- Create: `web/app/goblinday/queue/[slug]/page.tsx`
- Create: `web/app/goblinday/queue/[slug]/GoblinQueuePublicView.tsx`

- [ ] **Step 1: Create the server page component**

Create `web/app/goblinday/queue/[slug]/page.tsx`. Follow the pattern of `web/app/goblinday/log/[slug]/page.tsx`:

```typescript
import { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";
import GoblinQueuePublicView from "./GoblinQueuePublicView";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const serviceClient = createServiceClient();
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("display_name")
    .eq("username", slug)
    .maybeSingle();
  const name = (profile as any)?.display_name || slug;

  return {
    title: `${name}'s Queue — Goblin Day`,
    description: `${name}'s movie watchlist on Goblin Day. See what they want to watch and recommend movies.`,
    openGraph: {
      title: `${name}'s Queue`,
      description: `See ${name}'s movie watchlist and recommend films`,
      type: "website",
    },
  };
}

export default async function PublicQueuePage({ params }: PageProps) {
  const { slug } = await params;
  const serviceClient = createServiceClient();

  // Look up user
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("username", slug)
    .maybeSingle();

  if (!profile) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-zinc-500 font-mono text-sm">User not found</p>
      </main>
    );
  }

  const userId = (profile as any).id;

  // Fetch watchlist entries
  const { data: entries } = await serviceClient
    .from("goblin_watchlist_entries")
    .select(`
      id, note, sort_order, added_at,
      movie:goblin_movies!movie_id (
        id, tmdb_id, title, poster_path, release_date, genres,
        runtime_minutes, director, year
      )
    `)
    .eq("user_id", userId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("added_at", { ascending: false });

  return (
    <GoblinQueuePublicView
      user={{
        username: (profile as any).username,
        displayName: (profile as any).display_name,
        avatarUrl: (profile as any).avatar_url,
      }}
      slug={slug}
      entries={(entries || []).map((e: any) => ({
        id: e.id,
        movie: e.movie,
      }))}
    />
  );
}
```

- [ ] **Step 2: Create the client view component**

Create `web/app/goblinday/queue/[slug]/GoblinQueuePublicView.tsx`. This has the poster grid + recommend form:

```typescript
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import SmartImage from "@/components/SmartImage";
import { TMDB_POSTER_W342, TMDB_POSTER_W185, type TMDBSearchResult } from "@/lib/goblin-log-utils";

interface QueueMovie {
  id: number;
  movie: {
    id: number;
    tmdb_id: number | null;
    title: string;
    poster_path: string | null;
    release_date: string | null;
    genres: string[] | null;
    runtime_minutes: number | null;
    director: string | null;
    year: number | null;
  };
}

interface Props {
  user: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  slug: string;
  entries: QueueMovie[];
}

export default function GoblinQueuePublicView({ user, slug, entries }: Props) {
  // Recommend form state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TMDBSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<TMDBSearchResult | null>(null);
  const [recName, setRecName] = useState("");
  const [recNote, setRecNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check auth for name pre-fill
  useEffect(() => {
    fetch("/api/auth/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.profile?.display_name) setRecName(d.profile.display_name);
      })
      .catch(() => {});
  }, []);

  // Debounced TMDB search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setResults([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/goblinday/queue/${slug}/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
        }
      } catch { /* ignore */ }
      setSearching(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, slug]);

  const handleSubmit = useCallback(async () => {
    if (!selected || !recName.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/goblinday/queue/${slug}/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdb_id: selected.tmdb_id,
          recommender_name: recName.trim(),
          note: recNote.trim() || undefined,
        }),
      });
      if (res.status === 409) {
        setError("You already recommended this movie!");
      } else if (!res.ok) {
        setError("Something went wrong. Try again.");
      } else {
        setSuccess(true);
        setSelected(null);
        setQuery("");
        setResults([]);
        setRecNote("");
        setTimeout(() => setSuccess(false), 4000);
      }
    } catch {
      setError("Network error. Try again.");
    }
    setSubmitting(false);
  }, [selected, recName, recNote, submitting, slug]);

  return (
    <main className="min-h-screen bg-black text-white font-mono relative">
      <div className="max-w-3xl mx-auto px-4 py-12 sm:py-20">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-end gap-4">
            {user.avatarUrl && (
              <SmartImage src={user.avatarUrl} alt="" width={56} height={56}
                className="border border-amber-800/40" />
            )}
            <div>
              <p className="text-2xs text-amber-600/80 tracking-[0.5em] uppercase mb-1.5"
                style={{ textShadow: "0 0 6px rgba(255,217,61,0.2)" }}>
                The Queue
              </p>
              <h1 className="text-3xl sm:text-5xl font-black text-white uppercase tracking-[0.15em] leading-none"
                style={{ textShadow: "0 0 2px rgba(255,217,61,0.6), 0 0 20px rgba(255,217,61,0.35), 0 0 60px rgba(255,217,61,0.12)" }}>
                {user.displayName || user.username}
              </h1>
            </div>
          </div>
          <p className="text-2xs text-zinc-600 tracking-[0.3em] uppercase mt-4 tabular-nums">
            {entries.length} film{entries.length !== 1 ? "s" : ""} in queue
          </p>
        </div>

        {/* Poster Grid */}
        {entries.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3 mb-16">
            {entries.map((entry) => {
              const movie = entry.movie;
              const posterSrc = movie.poster_path
                ? `${TMDB_POSTER_W342}${movie.poster_path}`
                : null;
              return (
                <div key={entry.id} className="group relative">
                  <div className="aspect-[2/3] bg-zinc-900 overflow-hidden border border-zinc-800/40
                    group-hover:border-amber-800/40 transition-colors">
                    {posterSrc ? (
                      <SmartImage src={posterSrc} alt={movie.title}
                        width={200} height={300} loading="lazy"
                        className="object-cover w-full h-full" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-2xs text-zinc-700 p-2 text-center">
                        {movie.title}
                      </div>
                    )}
                  </div>
                  <p className="text-2xs text-zinc-500 mt-1 truncate">
                    {movie.title}
                    {movie.year && <span className="text-zinc-700 ml-1">({movie.year})</span>}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 mb-16">
            <p className="text-zinc-600 font-mono text-sm tracking-widest uppercase">
              // Queue is empty
            </p>
          </div>
        )}

        {/* Recommend Section */}
        <div className="border-t border-amber-900/20 pt-8">
          <h2 className="text-lg font-black text-white uppercase tracking-[0.2em] mb-1"
            style={{ textShadow: "0 0 20px rgba(255,217,61,0.15)" }}>
            Recommend a Movie
          </h2>
          <p className="text-2xs text-zinc-600 mb-6 tracking-wider">
            Know something {user.displayName || user.username} should watch? Search and recommend it.
          </p>

          {success && (
            <div className="mb-4 px-4 py-3 border border-emerald-800/40 bg-emerald-950/20
              text-emerald-400 text-xs font-mono tracking-wider animate-fade-in">
              Recommendation sent!
            </div>
          )}

          {error && (
            <div className="mb-4 px-4 py-3 border border-red-800/40 bg-red-950/20
              text-red-400 text-xs font-mono tracking-wider">
              {error}
            </div>
          )}

          {!selected ? (
            <>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for a movie..."
                className="w-full px-3 py-2.5 rounded-lg
                  bg-zinc-950 border border-zinc-800
                  text-white font-mono text-sm
                  placeholder:text-zinc-600
                  focus:outline-none focus:border-amber-600 transition-colors"
              />
              {searching && (
                <p className="mt-3 text-xs text-zinc-600 font-mono">Searching...</p>
              )}
              <div className="mt-3 space-y-1 max-h-80 overflow-y-auto">
                {results.map((movie) => (
                  <button key={movie.tmdb_id}
                    onClick={() => setSelected(movie)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg
                      hover:bg-zinc-900 transition-colors text-left group">
                    <div className="w-10 h-15 flex-shrink-0 rounded overflow-hidden bg-zinc-800">
                      {movie.poster_path && (
                        <SmartImage
                          src={`${TMDB_POSTER_W185}${movie.poster_path}`}
                          alt={movie.title} width={40} height={60}
                          className="object-cover w-full h-full" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate
                        group-hover:text-amber-400 transition-colors">
                        {movie.title}
                        <span className="text-zinc-600 ml-1.5 font-normal">
                          {movie.release_date?.split("-")[0] || ""}
                        </span>
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {/* Selected movie */}
              <div className="flex items-center gap-3 pb-4 border-b border-zinc-800">
                <div className="w-12 h-18 flex-shrink-0 rounded overflow-hidden bg-zinc-800">
                  {selected.poster_path && (
                    <SmartImage
                      src={`${TMDB_POSTER_W185}${selected.poster_path}`}
                      alt={selected.title} width={48} height={72}
                      className="object-cover w-full h-full" />
                  )}
                </div>
                <div>
                  <p className="text-base font-semibold text-white">{selected.title}</p>
                  <p className="text-xs text-zinc-500">{selected.release_date?.split("-")[0] || ""}</p>
                </div>
                <button onClick={() => { setSelected(null); setError(null); }}
                  className="ml-auto text-xs text-zinc-600 hover:text-white font-mono transition-colors">
                  change
                </button>
              </div>

              {/* Name */}
              <div>
                <label className="font-mono text-xs text-zinc-500 uppercase tracking-wider mb-1.5 block">
                  Your Name
                </label>
                <input type="text" value={recName}
                  onChange={(e) => setRecName(e.target.value)}
                  placeholder="Your name"
                  maxLength={50}
                  className="w-full px-3 py-2.5 rounded-lg
                    bg-zinc-950 border border-zinc-800
                    text-white font-mono text-sm placeholder:text-zinc-600
                    focus:outline-none focus:border-amber-600 transition-colors" />
              </div>

              {/* Note */}
              <div>
                <label className="font-mono text-xs text-zinc-500 uppercase tracking-wider mb-1.5 block">
                  Note <span className="text-zinc-700">(optional)</span>
                </label>
                <textarea value={recNote}
                  onChange={(e) => setRecNote(e.target.value)}
                  placeholder="You'd love this because..."
                  rows={2} maxLength={500}
                  className="w-full px-3 py-2.5 rounded-lg resize-none
                    bg-zinc-950 border border-zinc-800
                    text-white font-mono text-sm placeholder:text-zinc-600
                    focus:outline-none focus:border-amber-600 transition-colors" />
              </div>

              {/* Submit */}
              <button onClick={handleSubmit}
                disabled={submitting || !recName.trim()}
                className="w-full py-2.5 bg-amber-600 text-black rounded-lg
                  font-mono text-sm font-medium disabled:opacity-50 transition-colors
                  hover:bg-amber-500">
                {submitting ? "Sending..." : "Recommend"}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-20 pt-6 flex items-center justify-between"
          style={{ borderTop: "1px solid rgba(255,217,61,0.15)" }}>
          <a href="/goblinday"
            className="text-2xs text-amber-700 font-mono tracking-[0.2em] uppercase
              hover:text-amber-400 transition-colors">
            Goblin Day
          </a>
          <span className="text-2xs text-zinc-600 font-mono tracking-[0.15em]">
            Lost City
          </span>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add web/app/goblinday/queue/\[slug\]/page.tsx web/app/goblinday/queue/\[slug\]/GoblinQueuePublicView.tsx
git commit -m "feat(goblin): add public queue page with poster grid and recommend form"
```

---

## Task 7: Add Recommendations Section + Share Button to GoblinWatchlistView

**Files:**
- Modify: `web/components/goblin/GoblinWatchlistView.tsx`

- [ ] **Step 1: Read the current component**

Read `web/components/goblin/GoblinWatchlistView.tsx` to understand the full structure.

- [ ] **Step 2: Destructure new hook values**

In the hook destructuring at the top of the component, add:

```typescript
    recommendations,
    recommendationCount,
    addRecommendation,
    dismissRecommendation,
```

- [ ] **Step 3: Add username state and share handler**

After the existing state declarations, add:

```typescript
  const [copied, setCopied] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch("/api/auth/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.profile?.username) setUsername(d.profile.username); })
      .catch(() => {});
  }, [isAuthenticated]);

  const handleCopyShareLink = () => {
    if (!username) return;
    const url = `https://lostcity.ai/goblinday/queue/${username}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
```

- [ ] **Step 4: Add SHARE button to header**

In the header `<div>`, next to the "+ ADD" button, add a SHARE button before it:

```tsx
{username && (
  <button
    onClick={handleCopyShareLink}
    className="px-3 py-1.5 text-2xs font-mono font-bold tracking-[0.2em] uppercase
      border border-zinc-700 text-zinc-500
      hover:text-amber-300 hover:border-amber-700 hover:shadow-[0_0_12px_rgba(255,217,61,0.15)]
      active:scale-95 transition-all"
  >
    {copied ? "COPIED!" : "SHARE"}
  </button>
)}
```

- [ ] **Step 5: Add recommendations section**

Between the header/tag filter section and the loading/entries section, add the recommendations display. Insert it right after the closing `</div>` of the header block (the `mb-8` div), before the loading check:

```tsx
{/* Recommendations */}
{recommendationCount > 0 && (
  <div className="mb-8 relative z-10">
    <div className="flex items-center gap-2 mb-4">
      <h3 className="text-xs font-mono font-bold tracking-[0.2em] uppercase text-amber-500/80">
        Recommendations
      </h3>
      <span className="px-1.5 py-0.5 text-2xs font-mono font-bold bg-amber-950/40 border border-amber-800/30 text-amber-400">
        {recommendationCount}
      </span>
    </div>
    <div className="space-y-2">
      {recommendations.map((rec) => (
        <div key={rec.id}
          className="flex items-center gap-3 p-3 bg-[rgba(5,5,8,0.8)] border border-zinc-800/30
            border-l-2 border-l-amber-700/40">
          {/* Poster */}
          <div className="w-10 h-15 flex-shrink-0 overflow-hidden bg-zinc-900">
            {rec.movie.poster_path && (
              <SmartImage
                src={`https://image.tmdb.org/t/p/w185${rec.movie.poster_path}`}
                alt={rec.movie.title} width={40} height={60} loading="lazy"
                className="object-cover w-full h-full" />
            )}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white uppercase tracking-wide truncate">
              {rec.movie.title}
              {rec.movie.year && <span className="text-zinc-600 font-normal ml-1.5">({rec.movie.year})</span>}
            </p>
            <p className="text-2xs text-zinc-500 font-mono mt-0.5">
              from <span className="text-amber-500/70">{rec.recommender_name}</span>
            </p>
            {rec.note && (
              <p className="text-2xs text-zinc-600 italic mt-1 line-clamp-1">
                &ldquo;{rec.note}&rdquo;
              </p>
            )}
          </div>
          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => addRecommendation(rec.id)}
              className="px-2 py-1 text-2xs font-mono font-bold text-emerald-500
                border border-emerald-800/40 hover:bg-emerald-950/30 transition-colors">
              + ADD
            </button>
            <button
              onClick={() => dismissRecommendation(rec.id)}
              className="px-2 py-1 text-2xs font-mono text-zinc-700
                hover:text-red-400 transition-colors">
              x
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

Note: You'll need to add `import SmartImage from "@/components/SmartImage";` at the top of the file if it's not already imported.

Also import `Recommendation` from the hook if it's exported from the utils, or ensure the type is available from the hook's return type.

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add web/components/goblin/GoblinWatchlistView.tsx
git commit -m "feat(goblin): add recommendations section and share button to watchlist view"
```

---

## Task 8: Push Migration + Verify

**Files:** None (verification only)

- [ ] **Step 1: Push migration to remote Supabase**

Run: `npx supabase db push`

If it says "up to date", the migration was already applied. Verify the table exists:

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('web/.env.local','utf8');
const key = env.match(/SUPABASE_SERVICE_KEY=(.+)/)[1].trim();
const c = createClient('https://rtppvljfrkjtoxmaizea.supabase.co', key);
(async () => {
  const { data, error } = await c.from('goblin_watchlist_recommendations').select('id').limit(1);
  if (error) console.log('ERROR:', error.message);
  else console.log('SUCCESS: table exists');
})();
"
```

- [ ] **Step 2: Verify TypeScript builds clean**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`

- [ ] **Step 3: Verify dev server loads the public page**

Start dev server if not running: `cd /Users/coach/Projects/LostCity/web && npm run dev`

Check that `/goblinday/queue/[your-username]` loads without errors.

- [ ] **Step 4: Commit any fixes**

```bash
git add -u
git commit -m "fix(goblin): address queue sharing integration issues"
```
