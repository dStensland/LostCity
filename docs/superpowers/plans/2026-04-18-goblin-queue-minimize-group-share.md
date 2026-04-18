# Goblin Queue Minimize, Group Focus & Share Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the Goblin Day queue by default, add per-group focus + public share URLs, and add a one-click `[SEEN]` action distinct from the log-modal `[WATCHED]` flow.

**Architecture:** Add nullable `slug` to `goblin_lists` (immutable once set, auto-generated server-side). Add nullable `list_id` to `goblin_watchlist_recommendations` so a public group-scoped recommend endpoint can target a specific group. Owner queue view gets a `localStorage`-persisted collapse toggle and a `?g=<slug>` URL param that hides the queue + sibling groups. A new public page at `/goblinday/queue/[username]/g/[groupSlug]` mirrors the existing public queue chrome, scoped to one group. Card-level `[SEEN]` reuses existing delete endpoints with zero schema change.

**Tech Stack:** Next.js 16 App Router, Supabase (service client), React 19 + Tailwind v4, existing Goblin Day hooks (`useGoblinWatchlist`, `useGoblinGroups`), Vitest.

**Spec:** `docs/superpowers/specs/2026-04-18-goblin-queue-minimize-group-share-design.md`

---

## File Structure

**Database migrations (parity pair):**
- Create: `database/migrations/NNN_goblin_lists_slug.sql` — uses `create_migration_pair.py`
- Create: `supabase/migrations/YYYYMMDDHHMMSS_goblin_lists_slug.sql`

**Shared slug utility:**
- Create: `web/lib/goblin-slug.ts` — `slugify(name)` + `generateUniqueGroupSlug(serviceClient, userId, name)`
- Create: `web/lib/__tests__/goblin-slug.test.ts`

**Types:**
- Modify: `web/lib/goblin-group-utils.ts` — add `slug: string | null` to `GoblinGroup`

**Auth-side API:**
- Modify: `web/app/api/goblinday/me/lists/route.ts` — GET returns slug; POST generates slug before insert

**Public API (new):**
- Create: `web/app/api/goblinday/queue/[slug]/g/[groupSlug]/route.ts` — GET group + movies + recommendations
- Create: `web/app/api/goblinday/queue/[slug]/g/[groupSlug]/recommend/route.ts` — POST recommend to group

**Public page (new):**
- Create: `web/app/goblinday/queue/[slug]/g/[groupSlug]/page.tsx`
- Create: `web/components/goblin/GoblinGroupPublicView.tsx`

**Owner queue view:**
- Modify: `web/components/goblin/GoblinWatchlistView.tsx` — collapse toggle, focus mode, chip row
- Modify: `web/components/goblin/GoblinWatchlistCard.tsx` — `[SEEN]` action
- Modify: `web/components/goblin/GoblinGroupSection.tsx` — `[SHARE]` + focus buttons, `[SEEN]` on movie rows

---

## Task 1: Schema migration — goblin_lists.slug + recommendations.list_id

**Files:**
- Create: `database/migrations/NNN_goblin_lists_slug.sql` (scaffolded)
- Create: `supabase/migrations/YYYYMMDDHHMMSS_goblin_lists_slug.sql` (scaffolded)

- [ ] **Step 1: Scaffold the migration pair**

Run: `python3 /Users/coach/Projects/LostCity/database/create_migration_pair.py goblin_lists_slug`

This creates both files with matching timestamps/numbers. Note both paths in the output.

- [ ] **Step 2: Write the migration body**

Open both files and replace their body with the same SQL:

```sql
-- Goblin Day: per-group slug for shareable URLs + list_id on recommendations
-- for group-scoped public recommendations.

-- 1. goblin_lists.slug
ALTER TABLE goblin_lists
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2. Backfill slugs for existing non-recommendations lists, resolving
-- per-user collisions by suffixing with -2, -3, ...
DO $$
DECLARE
  rec RECORD;
  base_slug TEXT;
  candidate TEXT;
  n INT;
BEGIN
  FOR rec IN
    SELECT id, user_id, name
    FROM goblin_lists
    WHERE is_recommendations = false AND slug IS NULL
    ORDER BY created_at ASC
  LOOP
    base_slug := lower(regexp_replace(rec.name, '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    IF base_slug = '' THEN
      base_slug := 'group';
    END IF;

    candidate := base_slug;
    n := 2;
    WHILE EXISTS (
      SELECT 1 FROM goblin_lists
      WHERE user_id = rec.user_id
        AND slug = candidate
        AND is_recommendations = false
    ) LOOP
      candidate := base_slug || '-' || n;
      n := n + 1;
    END LOOP;

    UPDATE goblin_lists SET slug = candidate WHERE id = rec.id;
  END LOOP;
END $$;

-- 3. Unique partial index — recommendations lists are excluded
CREATE UNIQUE INDEX IF NOT EXISTS idx_goblin_lists_user_slug
  ON goblin_lists (user_id, slug)
  WHERE is_recommendations = false AND slug IS NOT NULL;

-- 4. goblin_watchlist_recommendations.list_id — nullable, cascade on list delete
ALTER TABLE goblin_watchlist_recommendations
  ADD COLUMN IF NOT EXISTS list_id INTEGER
    REFERENCES goblin_lists(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_watchlist_rec_list
  ON goblin_watchlist_recommendations (list_id)
  WHERE list_id IS NOT NULL;
```

- [ ] **Step 3: Run parity audit**

Run: `python3 /Users/coach/Projects/LostCity/database/audit_migration_parity.py --fail-on-unmatched`
Expected: exit 0, both files present with matching body hashes.

- [ ] **Step 4: Apply via Supabase CLI (local or remote per user)**

Ask the user to run the migration in Supabase (local dev: `npx supabase db reset` if scratch OK, or `npx supabase migration up`; prod: push via Supabase dashboard). Do not apply to prod without the user's explicit go-ahead.

- [ ] **Step 5: Verify**

Run in Supabase SQL editor:
```sql
SELECT id, name, slug, is_recommendations FROM goblin_lists ORDER BY user_id, sort_order LIMIT 20;
```
Expected: every non-recommendations row has a non-null slug; recommendations rows have `slug IS NULL`.

Also check:
```sql
SELECT column_name FROM information_schema.columns
  WHERE table_name = 'goblin_watchlist_recommendations' AND column_name = 'list_id';
```
Expected: one row.

- [ ] **Step 6: Commit**

```bash
git add database/migrations/*goblin_lists_slug* supabase/migrations/*goblin_lists_slug*
git commit -m "feat(goblin/db): add goblin_lists.slug + recommendations.list_id"
```

---

## Task 2: Slug utility + unit tests

**Files:**
- Create: `web/lib/goblin-slug.ts`
- Create: `web/lib/__tests__/goblin-slug.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `web/lib/__tests__/goblin-slug.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { slugify } from "../goblin-slug";

describe("slugify", () => {
  it("lowercases and replaces non-alphanumerics with dashes", () => {
    expect(slugify("Sword & Sorcery")).toBe("sword-sorcery");
  });

  it("trims leading/trailing dashes", () => {
    expect(slugify("  Sword & Sorcery  ")).toBe("sword-sorcery");
    expect(slugify("!!!Movies!!!")).toBe("movies");
  });

  it("collapses runs of non-alphanumerics into a single dash", () => {
    expect(slugify("A — B — C")).toBe("a-b-c");
  });

  it("preserves digits", () => {
    expect(slugify("Top 10 of 2024")).toBe("top-10-of-2024");
  });

  it("falls back to 'group' for empty-after-normalize inputs", () => {
    expect(slugify("")).toBe("group");
    expect(slugify("!!!")).toBe("group");
    expect(slugify("   ")).toBe("group");
  });

  it("handles unicode by stripping it", () => {
    expect(slugify("Café Noir")).toBe("caf-noir");
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd web && npx vitest run lib/__tests__/goblin-slug.test.ts`
Expected: FAIL with "Cannot find module '../goblin-slug'".

- [ ] **Step 3: Implement `slugify` + collision resolver**

Create `web/lib/goblin-slug.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Lowercase, collapse non-alphanumerics to single dashes, trim dashes.
 * Falls back to "group" for empty results so the slug column is never "".
 * Matches the Postgres backfill used in the schema migration.
 */
export function slugify(input: string): string {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized === "" ? "group" : normalized;
}

interface SlugRow {
  slug: string | null;
}

/**
 * Given a user and a group name, return a unique slug (suffixing with -2, -3, …
 * against that user's existing non-recommendations groups).
 */
export async function generateUniqueGroupSlug(
  serviceClient: SupabaseClient,
  userId: string,
  name: string
): Promise<string> {
  const base = slugify(name);

  const { data } = await serviceClient
    .from("goblin_lists")
    .select("slug")
    .eq("user_id", userId)
    .eq("is_recommendations", false)
    .not("slug", "is", null)
    .returns<SlugRow[]>();

  const existing = new Set((data || []).map((r) => r.slug).filter((s): s is string => !!s));

  if (!existing.has(base)) return base;

  let n = 2;
  while (existing.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd web && npx vitest run lib/__tests__/goblin-slug.test.ts`
Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/goblin-slug.ts web/lib/__tests__/goblin-slug.test.ts
git commit -m "feat(goblin/web): slugify + generateUniqueGroupSlug helpers"
```

---

## Task 3: Types — add slug to GoblinGroup

**Files:**
- Modify: `web/lib/goblin-group-utils.ts`

- [ ] **Step 1: Add slug to the interface**

In `web/lib/goblin-group-utils.ts`, replace the `GoblinGroup` interface:

```ts
export interface GoblinGroup {
  id: number;
  slug: string | null;
  name: string;
  description: string | null;
  sort_order: number | null;
  is_recommendations: boolean;
  created_at: string;
  movies: GoblinGroupMovie[];
}
```

- [ ] **Step 2: Verify the type compiles**

Run: `cd web && npx tsc --noEmit`
Expected: no new type errors (existing code with `GoblinGroup` doesn't reference `slug` yet so nothing breaks).

- [ ] **Step 3: Commit**

```bash
git add web/lib/goblin-group-utils.ts
git commit -m "feat(goblin/web): add slug to GoblinGroup type"
```

---

## Task 4: `/api/goblinday/me/lists` — generate + return slug

**Files:**
- Modify: `web/app/api/goblinday/me/lists/route.ts`

- [ ] **Step 1: Update GET to include slug**

In the GET handler, update the select + the `ListRow` interface:

```ts
interface ListRow {
  id: number;
  slug: string | null;
  name: string;
  description: string | null;
  sort_order: number | null;
  is_recommendations: boolean;
  created_at: string;
}
```

And update the select string in the `.from("goblin_lists").select(...)` call to include `slug`:

```ts
.select("id, slug, name, description, sort_order, is_recommendations, created_at")
```

Do the same for the `.select("id, slug, name, ...")` on the `.single<ListRow>()` call at the end of POST.

- [ ] **Step 2: Update POST to generate the slug before insert**

At the top of the file, add:

```ts
import { generateUniqueGroupSlug } from "@/lib/goblin-slug";
```

Inside the POST handler, before the `serviceClient.from("goblin_lists").insert(...)` call, compute the slug and add it to the insert payload:

```ts
const slug = await generateUniqueGroupSlug(serviceClient, user.id, name);

const { data: list, error: listError } = await serviceClient
  .from("goblin_lists")
  .insert({
    user_id: user.id,
    slug,
    name,
    description: description?.trim() || null,
    sort_order: nextSortOrder,
  } as never)
  .select("id, slug, name, description, sort_order, is_recommendations, created_at")
  .single<ListRow>();
```

- [ ] **Step 3: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Manual verification**

Start `cd web && npm run dev`. In the browser, signed in as the test user:
1. Create a new group called "Sword & Sorcery" via the + GROUP modal.
2. Hit `http://localhost:3000/api/goblinday/me/lists` in DevTools/curl (logged in).
3. Confirm the new list has `"slug": "sword-sorcery"`.
4. Create another group with the same name. Confirm its slug is `"sword-sorcery-2"`.
5. Delete those test groups if not needed.

- [ ] **Step 5: Commit**

```bash
git add web/app/api/goblinday/me/lists/route.ts
git commit -m "feat(goblin/api): generate and return slug on group create"
```

---

## Task 5: Public group GET endpoint

**Files:**
- Create: `web/app/api/goblinday/queue/[slug]/g/[groupSlug]/route.ts`

- [ ] **Step 1: Create the endpoint**

Create `web/app/api/goblinday/queue/[slug]/g/[groupSlug]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface ProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface ListRow {
  id: number;
  slug: string;
  name: string;
  description: string | null;
}

interface ListMovieDetailRow {
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
}

interface ListMovieJoinRow {
  movie_id: number;
  sort_order: number | null;
  note: string | null;
  added_at: string;
  movie: ListMovieDetailRow | null;
}

interface RecommendationRow {
  id: number;
  recommender_name: string;
  note: string | null;
  created_at: string;
  movie: {
    id: number;
    tmdb_id: number | null;
    title: string;
    poster_path: string | null;
    release_date: string | null;
    year: number | null;
  } | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; groupSlug: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug: username, groupSlug } = await params;
  const serviceClient = createServiceClient();

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("username", username)
    .maybeSingle<ProfileRow>();

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: list } = await serviceClient
    .from("goblin_lists")
    .select("id, slug, name, description")
    .eq("user_id", profile.id)
    .eq("slug", groupSlug)
    .eq("is_recommendations", false)
    .maybeSingle<ListRow>();

  if (!list) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const { data: movieRows } = await serviceClient
    .from("goblin_list_movies")
    .select(`
      movie_id, sort_order, note, added_at,
      movie:goblin_movies!movie_id (
        id, tmdb_id, title, poster_path, backdrop_path, release_date, genres,
        runtime_minutes, director, year, rt_critics_score, rt_audience_score,
        tmdb_vote_average, tmdb_vote_count, mpaa_rating, imdb_id, synopsis, trailer_url
      )
    `)
    .eq("list_id", list.id)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("added_at", { ascending: true })
    .returns<ListMovieJoinRow[]>();

  const movies = (movieRows || [])
    .filter((r) => r.movie !== null)
    .map((r) => ({
      movie_id: r.movie_id,
      sort_order: r.sort_order,
      note: r.note,
      added_at: r.added_at,
      movie: r.movie!,
    }));

  const { data: recRows } = await serviceClient
    .from("goblin_watchlist_recommendations")
    .select(`
      id, recommender_name, note, created_at,
      movie:goblin_movies!movie_id (
        id, tmdb_id, title, poster_path, release_date, year
      )
    `)
    .eq("target_user_id", profile.id)
    .eq("list_id", list.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .returns<RecommendationRow[]>();

  const recommendations = (recRows || [])
    .filter((r) => r.movie !== null)
    .map((r) => ({
      id: r.id,
      recommender_name: r.recommender_name,
      note: r.note,
      created_at: r.created_at,
      movie: r.movie!,
    }));

  return NextResponse.json({
    user: {
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
    },
    group: {
      slug: list.slug,
      name: list.name,
      description: list.description,
    },
    movies,
    recommendations,
  });
}
```

- [ ] **Step 2: Manual verification**

With `npm run dev` running and a test group called "Sword & Sorcery" already on your account:
1. `curl http://localhost:3000/api/goblinday/queue/<your-username>/g/sword-sorcery`
2. Expect JSON with `user`, `group`, `movies`, `recommendations` arrays.
3. `curl .../g/nope-nonexistent` → expect 404.
4. `curl .../<fake-user>/g/whatever` → expect 404.

- [ ] **Step 3: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add web/app/api/goblinday/queue/
git commit -m "feat(goblin/api): public GET endpoint for a single group"
```

---

## Task 6: Public group recommend endpoint

**Files:**
- Create: `web/app/api/goblinday/queue/[slug]/g/[groupSlug]/recommend/route.ts`

- [ ] **Step 1: Create the endpoint**

Create `web/app/api/goblinday/queue/[slug]/g/[groupSlug]/recommend/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { ensureMovie } from "@/lib/goblin-movie-utils";

export const dynamic = "force-dynamic";

interface ProfileRow {
  id: string;
}

interface ListRow {
  id: number;
}

interface RecommendBody {
  tmdb_id?: number;
  recommender_name?: string | null;
  note?: string | null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; groupSlug: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug: username, groupSlug } = await params;
  const serviceClient = createServiceClient();

  const raw: unknown = await request.json();
  const body: RecommendBody =
    typeof raw === "object" && raw !== null ? (raw as RecommendBody) : {};

  const tmdb_id = Number(body.tmdb_id);
  const recommender_name = (body.recommender_name || "").trim();
  const note = (body.note || "").trim() || null;

  if (!Number.isFinite(tmdb_id) || tmdb_id <= 0) {
    return NextResponse.json({ error: "tmdb_id required" }, { status: 400 });
  }
  if (!recommender_name) {
    return NextResponse.json({ error: "recommender_name required" }, { status: 400 });
  }

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle<ProfileRow>();
  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: list } = await serviceClient
    .from("goblin_lists")
    .select("id")
    .eq("user_id", profile.id)
    .eq("slug", groupSlug)
    .eq("is_recommendations", false)
    .maybeSingle<ListRow>();
  if (!list) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const movie = await ensureMovie(serviceClient, tmdb_id);
  if (!movie) return NextResponse.json({ error: "Movie not found" }, { status: 404 });

  const { error: insertError } = await serviceClient
    .from("goblin_watchlist_recommendations")
    .insert({
      target_user_id: profile.id,
      list_id: list.id,
      movie_id: movie.id,
      recommender_name,
      note,
      status: "pending",
    } as never);

  if (insertError) {
    // 23505 = unique_violation — the existing recommender-level unique indexes
    // prevent the same recommender+movie+target. Return 409.
    if ((insertError as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "You already recommended this movie to this queue" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to recommend" }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
```

- [ ] **Step 2: Manual verification**

With dev running and a group at slug `sword-sorcery`:
1. `curl -X POST -H 'Content-Type: application/json' -d '{"tmdb_id":680,"recommender_name":"Test","note":"Pulp!"}' http://localhost:3000/api/goblinday/queue/<username>/g/sword-sorcery/recommend`
2. Expect 201 with `{"success":true}`.
3. Repeat the exact same curl → expect 409.
4. Sign into the queue owner account, open `/goblinday`, confirm the recommendation shows up in the Recommendations inbox with the recommender name "Test".

- [ ] **Step 3: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add web/app/api/goblinday/queue/
git commit -m "feat(goblin/api): group-scoped public recommend endpoint"
```

---

## Task 7: Public group view page + component

**Files:**
- Create: `web/app/goblinday/queue/[slug]/g/[groupSlug]/page.tsx`
- Create: `web/components/goblin/GoblinGroupPublicView.tsx`

- [ ] **Step 1: Create the page**

Create `web/app/goblinday/queue/[slug]/g/[groupSlug]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import GoblinGroupPublicView from "@/components/goblin/GoblinGroupPublicView";

export const dynamic = "force-dynamic";

interface ProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface ListRow {
  id: number;
  slug: string;
  name: string;
  description: string | null;
}

interface MovieRow {
  id: number;
  tmdb_id: number | null;
  title: string;
  poster_path: string | null;
  release_date: string | null;
  genres: string[] | null;
  runtime_minutes: number | null;
  director: string | null;
  year: number | null;
}

interface ListMovieJoinRow {
  movie_id: number;
  sort_order: number | null;
  movie: MovieRow | null;
}

interface RecommendationRow {
  id: number;
  recommender_name: string;
  note: string | null;
  created_at: string;
  movie: {
    id: number;
    tmdb_id: number | null;
    title: string;
    poster_path: string | null;
    release_date: string | null;
    year: number | null;
  } | null;
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string; groupSlug: string }>;
}) {
  const { slug: username, groupSlug } = await params;
  const serviceClient = createServiceClient();

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("username", username)
    .maybeSingle<ProfileRow>();
  if (!profile) notFound();

  const { data: list } = await serviceClient
    .from("goblin_lists")
    .select("id, slug, name, description")
    .eq("user_id", profile.id)
    .eq("slug", groupSlug)
    .eq("is_recommendations", false)
    .maybeSingle<ListRow>();
  if (!list) notFound();

  const { data: movieRows } = await serviceClient
    .from("goblin_list_movies")
    .select(`
      movie_id, sort_order,
      movie:goblin_movies!movie_id (
        id, tmdb_id, title, poster_path, release_date, genres,
        runtime_minutes, director, year
      )
    `)
    .eq("list_id", list.id)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("added_at", { ascending: true })
    .returns<ListMovieJoinRow[]>();

  const entries = (movieRows || [])
    .filter((r) => r.movie !== null)
    .map((r, i) => ({ id: r.movie_id + i * 100000, movie: r.movie! }));

  const { data: recRows } = await serviceClient
    .from("goblin_watchlist_recommendations")
    .select(`
      id, recommender_name, note, created_at,
      movie:goblin_movies!movie_id (
        id, tmdb_id, title, poster_path, release_date, year
      )
    `)
    .eq("target_user_id", profile.id)
    .eq("list_id", list.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .returns<RecommendationRow[]>();

  const recommendations = (recRows || [])
    .filter((r) => r.movie !== null)
    .map((r) => ({
      id: r.id,
      recommender_name: r.recommender_name,
      note: r.note,
      created_at: r.created_at,
      movie: r.movie!,
    }));

  return (
    <GoblinGroupPublicView
      user={{
        username: profile.username,
        displayName: profile.display_name,
        avatarUrl: profile.avatar_url,
      }}
      slug={username}
      group={{ slug: list.slug, name: list.name, description: list.description }}
      entries={entries}
      recommendations={recommendations}
    />
  );
}
```

- [ ] **Step 2: Create the view component**

Create `web/components/goblin/GoblinGroupPublicView.tsx` by adapting `GoblinQueuePublicView.tsx`. Copy that file to the new path, then make these changes:

1. Add a `group` prop and update the `Props` interface:

```tsx
interface Props {
  user: { username: string; displayName: string | null; avatarUrl: string | null };
  slug: string; // username (for back link)
  group: { slug: string; name: string; description: string | null };
  entries: QueueEntry[];
  recommendations?: PublicRecommendation[];
}
```

2. Replace the header block that renders the user's display name / "The Queue" label with a group-scoped header:

```tsx
<div className="mb-10 pb-6 px-6 pt-6 rounded-lg bg-white/[0.03] border border-amber-900/20 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
  <p
    className="text-2xs text-amber-600/80 tracking-[0.5em] uppercase mb-1.5 font-mono"
    style={{ textShadow: "0 0 6px rgba(255,217,61,0.2)" }}
  >
    {displayName}&rsquo;s Queue &nbsp;/&nbsp; Group
  </p>
  <h1
    className="text-3xl sm:text-5xl font-black text-white uppercase tracking-[0.15em] leading-none"
    style={{
      textShadow:
        "0 0 2px rgba(255,217,61,0.6), 0 0 20px rgba(255,217,61,0.35), 0 0 60px rgba(255,217,61,0.12)",
    }}
  >
    {group.name}
  </h1>
  {group.description && (
    <p className="mt-4 text-sm text-zinc-400 font-mono italic leading-relaxed max-w-xl">
      {group.description}
    </p>
  )}
  <div className="mt-6 flex items-center justify-between">
    <span className="text-2xs text-zinc-600 tracking-[0.3em] uppercase tabular-nums">
      {entries.length} film{entries.length !== 1 ? "s" : ""}
    </span>
    <Link
      href={`/goblinday/queue/${slug}`}
      className="text-2xs text-amber-700 font-mono tracking-[0.2em] uppercase hover:text-amber-500 transition-colors"
    >
      ← full queue
    </Link>
  </div>
</div>
```

3. Change the recommend endpoint URL in the `handleSubmit` + `handleSearchChange` callbacks from `/api/goblinday/queue/${slug}/...` to `/api/goblinday/queue/${slug}/g/${group.slug}/...`:

```tsx
// in handleSearchChange's debounced fetch:
const res = await fetch(
  `/api/goblinday/queue/${encodeURIComponent(slug)}/g/${encodeURIComponent(group.slug)}/search?q=${encodeURIComponent(q.trim())}`
);

// in handleSubmit:
const res = await fetch(
  `/api/goblinday/queue/${encodeURIComponent(slug)}/g/${encodeURIComponent(group.slug)}/recommend`,
  { /* same body */ }
);
```

4. For search, we'll reuse the queue-level search endpoint rather than build a new one. Change the search URL to the existing queue endpoint (no `/g/`):

```tsx
const res = await fetch(
  `/api/goblinday/queue/${encodeURIComponent(slug)}/search?q=${encodeURIComponent(q.trim())}`
);
```

(The recommend POST stays group-scoped; only the TMDB search is shared.)

5. Update the "Recommend a Film" blurb:

```tsx
<p className="text-zinc-500 font-mono text-xs mb-6 tracking-wide">
  Send {displayName} a movie for the <span className="text-amber-500/90">{group.name}</span> group.
</p>
```

6. Empty-state copy:

```tsx
{/* replace "// Queue is empty" with: */}
<p className="text-zinc-600 font-mono text-sm tracking-widest uppercase">
  {`// ${group.name} is empty`}
</p>
```

- [ ] **Step 3: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Browser verification**

1. `cd web && npm run dev`.
2. Open `http://localhost:3000/goblinday/queue/<your-username>/g/<a-group-slug>` in a logged-out incognito tab.
3. Confirm: group name as hero, description (if set), N films grid, back link to full queue, recommend form.
4. Submit a test recommendation from the public page, then log in and confirm it shows up in the owner's Recommendations inbox.
5. Check 375px viewport: grid reflows 3-col, no overflow, recommend form usable.

- [ ] **Step 5: Commit**

```bash
git add web/app/goblinday/queue/ web/components/goblin/GoblinGroupPublicView.tsx
git commit -m "feat(goblin/web): public per-group view page"
```

---

## Task 8: Queue collapse toggle with localStorage

**Files:**
- Modify: `web/components/goblin/GoblinWatchlistView.tsx`

- [ ] **Step 1: Add collapsed state + persistence**

Near the other `useState` calls in `GoblinWatchlistView`, add:

```tsx
const [queueCollapsed, setQueueCollapsed] = useState<boolean>(true);

// Hydrate from localStorage after mount
useEffect(() => {
  try {
    const v = localStorage.getItem("goblin.queue.collapsed");
    if (v !== null) setQueueCollapsed(v === "1");
  } catch {
    /* ignore */
  }
}, []);

const toggleQueueCollapsed = useCallback(() => {
  setQueueCollapsed((prev) => {
    const next = !prev;
    try {
      localStorage.setItem("goblin.queue.collapsed", next ? "1" : "0");
    } catch {
      /* ignore */
    }
    return next;
  });
}, []);
```

- [ ] **Step 2: Wrap the title + count in a clickable button**

Replace the existing title block (the `<h2>The Queue</h2>` + count `<p>`) with:

```tsx
<button
  onClick={toggleQueueCollapsed}
  className="text-left group/queue-toggle"
  aria-expanded={!queueCollapsed}
>
  <h2
    className="text-2xl sm:text-3xl font-black text-white uppercase tracking-[0.25em] leading-none flex items-center gap-3"
    style={{
      textShadow:
        "0 0 30px rgba(255,217,61,0.2), 0 0 60px rgba(255,217,61,0.05)",
    }}
  >
    The Queue
    <span className="text-amber-500/60 text-lg transition-transform duration-200">
      {queueCollapsed ? "▾" : "▴"}
    </span>
  </h2>
  <p className="text-2xs text-zinc-600 font-mono mt-2 tracking-[0.3em] uppercase">
    {filteredEntries.length} film{filteredEntries.length !== 1 ? "s" : ""}
    {activeTag && (
      <span className="text-amber-400/70"> / #{activeTag}</span>
    )}
  </p>
</button>
```

- [ ] **Step 3: Hide tag filters + list when collapsed**

Wrap the existing "Tag filters" block (the `{tags.length > 0 && (...)}` block) in a `{!queueCollapsed && ...}` guard.

Wrap the loading / empty-state / entries render — the `loading ? (...) : filteredEntries.length === 0 ? (...) : (<div>{filteredEntries.map(...)}</div>)` ternary — in `{!queueCollapsed && (...)}`.

Do NOT wrap the Recommendations inbox block (`{recommendationCount > 0 && ...}`) — per spec it stays visible regardless.

Do NOT wrap the Groups section (`{groupsHook.groups.length > 0 && ...}`) — groups always render.

- [ ] **Step 4: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Browser verification**

1. Load `/goblinday` in browser. On first visit (or after clearing localStorage), the queue should start collapsed — only header + buttons visible, group sections directly below.
2. Click the header → list expands, caret flips to ▴.
3. Refresh → stays expanded (localStorage persisted "0").
4. Click again → collapsed, refresh → still collapsed.
5. Verify at 375px: toggle is tappable, no layout breakage.

- [ ] **Step 6: Commit**

```bash
git add web/components/goblin/GoblinWatchlistView.tsx
git commit -m "feat(goblin/web): collapse toggle on queue, localStorage-persisted"
```

---

## Task 9: Group focus URL sync + focus state

**Files:**
- Modify: `web/components/goblin/GoblinWatchlistView.tsx`

- [ ] **Step 1: Add focus state, URL sync, and helpers**

Near the other `useState` calls, add:

```tsx
const [focusGroupSlug, setFocusGroupSlug] = useState<string | null>(null);

// Initialize from ?g= on mount
useEffect(() => {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const g = params.get("g");
  if (g) setFocusGroupSlug(g);
}, []);

const updateFocusSlug = useCallback((slug: string | null) => {
  setFocusGroupSlug(slug);
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (slug) url.searchParams.set("g", slug);
  else url.searchParams.delete("g");
  window.history.replaceState({}, "", url.toString());
}, []);
```

- [ ] **Step 2: Resolve the focused group (and gracefully recover from a stale slug)**

After the groups hook and state declarations:

```tsx
const focusedGroup = useMemo(() => {
  if (!focusGroupSlug) return null;
  return groupsHook.groups.find((g) => g.slug === focusGroupSlug) || null;
}, [focusGroupSlug, groupsHook.groups]);

// Non-existent slug → strip param silently
useEffect(() => {
  if (focusGroupSlug && !focusedGroup && groupsHook.groups.length > 0) {
    updateFocusSlug(null);
  }
}, [focusGroupSlug, focusedGroup, groupsHook.groups.length, updateFocusSlug]);
```

- [ ] **Step 3: Render focus mode conditionally**

Replace the existing Groups block (`{groupsHook.groups.length > 0 && (<div className="mt-10 space-y-6 ...">...)` and keep in mind the queue/recommendation/tag blocks above) with a branched render:

```tsx
{focusedGroup ? (
  <div className="mt-4 space-y-4 relative z-10">
    <button
      onClick={() => updateFocusSlug(null)}
      className="text-2xs font-mono tracking-[0.2em] uppercase text-amber-500/70 hover:text-amber-300 transition-colors"
    >
      ← All groups
    </button>
    <GoblinGroupSection
      key={focusedGroup.id}
      group={focusedGroup}
      username={username}
      onAddMovie={() => setAddToGroupId(focusedGroup.id)}
      onRemoveMovie={groupsHook.removeMovie}
      onMarkWatched={groupsHook.markWatched}
      onDeleteGroup={groupsHook.deleteGroup}
      onReorderMovies={handleGroupReorderMovies}
      logTags={logHook.tags}
      onCreateLogTag={logHook.createTag}
      onFocus={updateFocusSlug}
      isFocused={true}
    />
  </div>
) : (
  groupsHook.groups.length > 0 && (
    <div className="mt-10 space-y-6 relative z-10">
      <div
        className="h-px"
        style={{ background: "linear-gradient(to right, transparent, rgba(255,217,61,0.15), transparent)" }}
      />
      {groupsHook.groups.map((group) => (
        <GoblinGroupSection
          key={group.id}
          group={group}
          username={username}
          onAddMovie={() => setAddToGroupId(group.id)}
          onRemoveMovie={groupsHook.removeMovie}
          onMarkWatched={groupsHook.markWatched}
          onDeleteGroup={groupsHook.deleteGroup}
          onReorderMovies={handleGroupReorderMovies}
          logTags={logHook.tags}
          onCreateLogTag={logHook.createTag}
          onFocus={updateFocusSlug}
          isFocused={false}
        />
      ))}
    </div>
  )
)}
```

- [ ] **Step 4: Hide queue + recommendations when focused**

Wrap the queue header button (Task 8 block) AND the queue body render AND the Recommendations inbox block — everything above the Groups block — in `{!focusedGroup && (...)}`. The header buttons row (SHARE / + GROUP / + ADD) should also be hidden in focus mode. Keep focus-mode render minimal: back link + the one group.

If it's simpler, wrap the entire JSX above the groups block in a single `{!focusedGroup && ( ... )}` fragment.

- [ ] **Step 5: Typecheck (expect failure; Task 10 fixes)**

Run: `cd web && npx tsc --noEmit`
Expected: errors about `GoblinGroupSection` not accepting `username`, `onFocus`, `isFocused`. These are fixed in Task 10.

- [ ] **Step 6: Do not commit yet**

The project won't compile until Task 10. Continue directly to Task 10.

---

## Task 10: Group chip row + GoblinGroupSection [SHARE] / [FOCUS] / [SEEN]

**Files:**
- Modify: `web/components/goblin/GoblinWatchlistView.tsx`
- Modify: `web/components/goblin/GoblinGroupSection.tsx`

- [ ] **Step 1: Extend `GoblinGroupSection` props**

At the top of `web/components/goblin/GoblinGroupSection.tsx`, add the three new props (leave existing props alone):

```tsx
interface Props {
  // ...existing props...
  username: string | null;
  onFocus: (slug: string | null) => void;
  isFocused: boolean;
}
```

- [ ] **Step 2: Add the [SHARE] + [FOCUS] header buttons**

In the group header row (next to the existing `+ ADD` / delete-group actions), add:

```tsx
const [copied, setCopied] = useState(false);

const handleShare = () => {
  if (!group.slug || !username) return;
  const url = `https://lostcity.ai/goblinday/queue/${username}/g/${group.slug}`;
  navigator.clipboard.writeText(url);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};

// Rendered inside the group header action row:
{group.slug && username && !isFocused && (
  <>
    <button
      onClick={handleShare}
      className="px-2 py-1 text-2xs font-mono font-bold tracking-[0.2em] uppercase
        border border-zinc-700 text-zinc-500
        hover:text-amber-300 hover:border-amber-700 transition-all"
    >
      {copied ? "COPIED!" : "SHARE"}
    </button>
    <button
      onClick={() => onFocus(group.slug)}
      className="px-2 py-1 text-2xs font-mono font-bold tracking-[0.2em] uppercase
        border border-zinc-700 text-zinc-500
        hover:text-amber-300 hover:border-amber-700 transition-all"
    >
      FOCUS
    </button>
  </>
)}
```

(Exact placement depends on the existing header markup — put the two buttons immediately before the existing "+ ADD" button inside the header action row.)

- [ ] **Step 3: Add [SEEN] to the group's movie row actions**

Locate the movie-row action bar in `GoblinGroupSection` (the row where `onMarkWatched` and `onRemoveMovie` are wired). Add a `[SEEN]` button between the existing watched and remove/`×` actions, calling the same remove handler but as a distinct intent:

```tsx
<button
  onClick={() => onRemoveMovie(group.id, movie.movie_id)}
  className="py-1 text-zinc-500 hover:text-amber-400 font-mono text-xs font-bold uppercase tracking-wider transition-colors"
  title="Mark as seen (removes from group, no log)"
>
  [SEEN]
</button>
```

Keep the existing `[WATCHED]` (log-modal) and `[×]` (remove) buttons as-is.

- [ ] **Step 4: Add the group chip row to `GoblinWatchlistView`**

In `GoblinWatchlistView`, above the Groups section render (and inside the `{!focusedGroup && (...)}` wrapper), add:

```tsx
{groupsHook.groups.length > 0 && (
  <div className="mt-6 mb-2 flex items-center gap-1.5 overflow-x-auto scrollbar-hide relative z-10
    [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] sm:[mask-image:none]">
    {groupsHook.groups.map((g) => (
      <button
        key={g.id}
        onClick={() => updateFocusSlug(g.slug)}
        disabled={!g.slug}
        className="flex-shrink-0 px-2.5 py-1 rounded-full font-mono text-2xs font-medium
          border border-zinc-700 text-zinc-400
          hover:text-amber-300 hover:border-amber-700
          disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        {g.name}
        <span className="ml-1.5 text-zinc-600">{g.movies.length}</span>
      </button>
    ))}
  </div>
)}
```

(The `disabled` + null-slug guard handles the auto-generated Recommendations list, which has `slug = null`.)

- [ ] **Step 5: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Browser verification**

1. Load `/goblinday`. Confirm the group chip row appears above the groups.
2. Click a group chip → URL updates with `?g=<slug>`; queue + other groups hide; "← All groups" link shows.
3. Click "← All groups" → URL param clears; full view returns.
4. In full view, click a group's `[SHARE]` → clipboard contains the full `lostcity.ai/goblinday/queue/.../g/<slug>` URL; "COPIED!" toast briefly.
5. Click `[SEEN]` on a group movie → movie removed from the group, no log modal opens, no `goblin_movie_log` row created (check via SQL).
6. Test on 375px.

- [ ] **Step 7: Commit**

```bash
git add web/components/goblin/GoblinWatchlistView.tsx web/components/goblin/GoblinGroupSection.tsx
git commit -m "feat(goblin/web): group focus mode, chip row, [SHARE], [SEEN] on group cards"
```

---

## Task 11: [SEEN] on queue cards (GoblinWatchlistCard)

**Files:**
- Modify: `web/components/goblin/GoblinWatchlistCard.tsx`

- [ ] **Step 1: Add [SEEN] to the action bar**

In `GoblinWatchlistCard.tsx`, find the action bar that contains `[WATCHED]`, `[i]`, `[▶]`, `[imdb]`, `[×]`. Insert `[SEEN]` immediately after `[WATCHED]`:

```tsx
<button
  onClick={() => onRemove(entry.id)}
  className="py-1 text-zinc-500 hover:text-amber-400 font-bold transition-colors"
  title="Mark as seen (removes from queue, no log)"
>
  [SEEN]
</button>
```

Keep `[×]` at the end unchanged — it's the "remove by mistake" affordance.

- [ ] **Step 2: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Browser verification**

1. Expand the queue. Hover any card on desktop (or view mobile where the bar is always visible).
2. Confirm `[SEEN]` appears between `[WATCHED]` and `[i]` with amber hover color.
3. Click `[SEEN]` → card disappears optimistically; refresh → still gone.
4. Verify via SQL: `SELECT * FROM goblin_movie_log WHERE movie_id = <that movie's id> AND user_id = <owner>;` → zero rows created by the click.

- [ ] **Step 4: Commit**

```bash
git add web/components/goblin/GoblinWatchlistCard.tsx
git commit -m "feat(goblin/web): [SEEN] action on queue cards (remove without logging)"
```

---

## Task 12: End-to-end verification

**Files:** none (manual verification pass)

- [ ] **Step 1: Typecheck the whole web app**

Run: `cd web && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 2: Run the vitest suite (slug util + any existing tests)**

Run: `cd web && npx vitest run`
Expected: all pass.

- [ ] **Step 3: Full happy-path browser walkthrough**

Signed in as the queue owner at `http://localhost:3000/goblinday`:
1. Page loads with queue collapsed by default. Header reads `THE QUEUE · N films · ▾`. Group chip row visible under the SHARE/+GROUP/+ADD buttons.
2. Click a group chip → URL gains `?g=<slug>`, queue hidden, other groups hidden, "← All groups" and the focused group render.
3. Click `← All groups` → back to full view, URL param cleared.
4. Expand the queue (click `THE QUEUE …`). Hover a card, click `[SEEN]` → card disappears; no log modal; no `goblin_movie_log` row created.
5. Click `[WATCHED]` on a different card → existing log modal opens, unchanged.
6. Click a group's `[SHARE]` → clipboard contains the shareable URL.
7. Open that URL in incognito → public group page loads, back link visible, recommend form works. Submit a recommendation.
8. Back as the signed-in owner → the new recommendation appears in the Recommendations inbox on `/goblinday`.
9. Reload `/goblinday` → collapse state from step 4 persists.

- [ ] **Step 4: Mobile (375px) walkthrough**

Repeat the happy path at 375px. Check: collapse toggle tappable, chip row horizontal-scrolls with amber mask, focus-mode group fits, `[SEEN]` reachable on always-visible mobile action bar, public group grid reflows to 3-col.

- [ ] **Step 5: Edge cases**

1. Navigate directly to `http://localhost:3000/goblinday?g=does-not-exist` → the bad slug is cleared from the URL and the full view renders.
2. Create a new group with a name that collides ("Sword Sorcery" after "Sword & Sorcery") → confirm the new slug is `sword-sorcery-2`.
3. Rename an existing group → confirm its old share URL still works.
4. Delete a group → confirm any `goblin_watchlist_recommendations` rows that targeted it are cascaded away (no orphans).

- [ ] **Step 6: Lint**

Run: `cd web && npm run lint`
Expected: clean (or only pre-existing warnings).

- [ ] **Step 7: Final commit (only if previous tasks left anything uncommitted)**

If nothing is uncommitted, skip. Otherwise commit cleanup or small fixes found during verification with a focused message.

```bash
git status
# if clean, done
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Task(s) |
|---|---|
| Schema: `goblin_lists.slug`, partial index, backfill | Task 1 |
| Schema: `goblin_watchlist_recommendations.list_id` | Task 1 |
| Slug generation + collision resolution | Tasks 1 (SQL backfill), 2 (JS) |
| `GET /api/goblinday/me/lists` returns slug | Task 4 |
| `POST /api/goblinday/me/lists` generates slug | Task 4 |
| `PATCH` does not touch slug | Already true (existing PATCH doesn't include slug); Task 4 leaves it alone |
| Queue collapse toggle + localStorage default-collapsed | Task 8 |
| Group focus mode (URL, hide sibling state) | Tasks 9, 10 |
| Group chip row | Task 10 |
| `[SHARE]` on group header | Task 10 |
| `[SEEN]` on queue cards | Task 11 |
| `[SEEN]` on group movie rows | Task 10 |
| Public GET endpoint | Task 5 |
| Public recommend endpoint (`list_id` routing + 409 dedupe) | Task 6 |
| Public group view page + component | Task 7 |
| Verification gates (tsc, 375px, cascade on delete) | Task 12 |

No gaps.

**Placeholder scan:** None.

**Type consistency:** `GoblinGroup.slug: string | null` everywhere. `onFocus(slug: string | null)`. `slug` field is nullable-in-type but for non-recommendations groups it's always set in data. Recommendations groups are filtered out of the chip row and focus logic via `disabled={!g.slug}` and the public endpoint's `is_recommendations = false` filter.
