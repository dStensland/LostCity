# Goblin Day Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone horror movie tracker page at `/goblin-day` for Daniel and Ashley to manage their shared watchlist.

**Architecture:** Supabase table for persistence, two API routes (GET list, PATCH toggle), a server-rendered page with client-side optimistic checkbox updates, and a TMDB seed script. No auth, no RLS.

**Tech Stack:** Next.js 16, Supabase, TMDB API, Tailwind v4, SmartImage

**Spec:** `docs/superpowers/specs/2026-03-25-goblin-day-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/20260325200000_goblin_movies.sql` | Create | Table + updated_at trigger |
| `web/app/[portal]/layout.tsx` | Modify (line 130) | Add "goblin-day" to reservedRoutes |
| `web/app/goblin-day/page.tsx` | Create | Server component — fetches movies, renders GoblinDayPage |
| `web/components/goblin/GoblinDayPage.tsx` | Create | Client component — year tabs, grid, checkbox toggling |
| `web/components/goblin/GoblinMovieCard.tsx` | Create | Single movie card — poster, scores, badges, checkboxes |
| `web/app/api/goblin-day/route.ts` | Create | GET handler — list movies with optional year filter |
| `web/app/api/goblin-day/[id]/route.ts` | Create | PATCH handler — update allowed fields |
| `web/scripts/seed-goblin-movies.ts` | Create | TMDB discover → Supabase seeder |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260325200000_goblin_movies.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Goblin Day horror movie tracker
CREATE TABLE goblin_movies (
  id serial PRIMARY KEY,
  tmdb_id integer,
  title text NOT NULL,
  release_date date,
  poster_path text,
  rt_critics_score integer CHECK (rt_critics_score >= 0 AND rt_critics_score <= 100),
  rt_audience_score integer CHECK (rt_audience_score >= 0 AND rt_audience_score <= 100),
  watched boolean NOT NULL DEFAULT false,
  daniel_list boolean NOT NULL DEFAULT false,
  ashley_list boolean NOT NULL DEFAULT false,
  streaming_info jsonb DEFAULT '[]'::jsonb,
  year integer NOT NULL CHECK (year >= 2024 AND year <= 2030),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Partial unique index: only one row per TMDB movie
CREATE UNIQUE INDEX goblin_movies_tmdb_id_unique
  ON goblin_movies (tmdb_id) WHERE tmdb_id IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION goblin_movies_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER goblin_movies_set_updated_at
  BEFORE UPDATE ON goblin_movies
  FOR EACH ROW EXECUTE FUNCTION goblin_movies_updated_at();

-- No RLS — public table for two friends
ALTER TABLE goblin_movies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goblin_movies_public" ON goblin_movies
  FOR ALL USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Apply migration locally**

Run: `cd /Users/coach/Projects/LostCity && npx supabase db push`
Expected: Migration applies cleanly.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260325200000_goblin_movies.sql
git commit -m "feat: add goblin_movies table for horror movie tracker"
```

---

### Task 2: Reserve Route + API GET Endpoint

**Files:**
- Modify: `web/app/[portal]/layout.tsx:130` — add "goblin-day" to reservedRoutes array
- Create: `web/app/api/goblin-day/route.ts`

- [ ] **Step 1: Add "goblin-day" to reservedRoutes**

In `web/app/[portal]/layout.tsx` line 130, add `"goblin-day"` to the array (alphabetical order, between "friends" and "happening-now").

- [ ] **Step 2: Write the GET API route**

Create `web/app/api/goblin-day/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const year = request.nextUrl.searchParams.get("year");

  let query = supabase
    .from("goblin_movies")
    .select("*")
    .order("release_date", { ascending: true, nullsFirst: false });

  if (year === "2025" || year === "2026") {
    query = query.eq("year", parseInt(year));
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

- [ ] **Step 3: Verify GET returns empty array**

Run the dev server and hit: `curl http://localhost:3000/api/goblin-day`
Expected: `[]` (empty array, no errors)

- [ ] **Step 4: Commit**

```bash
git add web/app/\[portal\]/layout.tsx web/app/api/goblin-day/route.ts
git commit -m "feat: goblin-day reserved route + GET API endpoint"
```

---

### Task 3: PATCH API Endpoint

**Files:**
- Create: `web/app/api/goblin-day/[id]/route.ts`

- [ ] **Step 1: Write the PATCH route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MUTABLE_FIELDS = new Set([
  "watched",
  "daniel_list",
  "ashley_list",
  "rt_critics_score",
  "rt_audience_score",
  "streaming_info",
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const movieId = parseInt(id);
  if (isNaN(movieId) || movieId <= 0) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const supabase = await createClient();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Filter to only allowed fields
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (MUTABLE_FIELDS.has(key)) {
      updates[key] = value;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("goblin_movies")
    .update(updates as never)
    .eq("id", movieId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

- [ ] **Step 2: Test with curl after seeding a test row**

Insert a test row via Supabase dashboard or SQL, then:
```bash
curl -X PATCH http://localhost:3000/api/goblin-day/1 \
  -H "Content-Type: application/json" \
  -d '{"watched": true}'
```
Expected: Returns updated movie with `watched: true`.

Test rejection of invalid fields:
```bash
curl -X PATCH http://localhost:3000/api/goblin-day/1 \
  -H "Content-Type: application/json" \
  -d '{"id": 999, "title": "hacked"}'
```
Expected: `{"error": "No valid fields to update"}` with 400 status.

- [ ] **Step 3: Commit**

```bash
git add web/app/api/goblin-day/\[id\]/route.ts
git commit -m "feat: goblin-day PATCH endpoint with field allowlist"
```

---

### Task 4: Movie Card Component

**Files:**
- Create: `web/components/goblin/GoblinMovieCard.tsx`

- [ ] **Step 1: Define the GoblinMovie type and card component**

```typescript
"use client";

import SmartImage from "@/components/SmartImage";

export interface GoblinMovie {
  id: number;
  tmdb_id: number | null;
  title: string;
  release_date: string | null;
  poster_path: string | null;
  rt_critics_score: number | null;
  rt_audience_score: number | null;
  watched: boolean;
  daniel_list: boolean;
  ashley_list: boolean;
  streaming_info: string[] | null;
  year: number;
}

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

interface Props {
  movie: GoblinMovie;
  onToggle: (id: number, field: string, value: boolean) => void;
}

export default function GoblinMovieCard({ movie, onToggle }: Props) {
  const posterUrl = movie.poster_path
    ? `${TMDB_IMAGE_BASE}${movie.poster_path}`
    : null;

  const releaseDate = movie.release_date
    ? new Date(movie.release_date + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "TBD";

  const isReleased = movie.release_date
    ? new Date(movie.release_date) <= new Date()
    : false;

  const streaming = movie.streaming_info ?? [];
  const inTheaters = streaming.includes("theaters");
  const streamingProviders = streaming.filter((s) => s !== "theaters");

  return (
    <div className="bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-colors">
      {/* Poster */}
      <div className="relative aspect-[2/3] bg-zinc-800">
        {posterUrl ? (
          <SmartImage
            src={posterUrl}
            alt={movie.title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
            No Poster
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <div>
          <h3 className="font-semibold text-white text-sm leading-tight truncate">
            {movie.title}
          </h3>
          <p className="text-zinc-400 text-xs mt-0.5">{releaseDate}</p>
        </div>

        {/* RT Scores */}
        <div className="flex gap-3 text-xs">
          <span title="Critics Score">
            🍅 {movie.rt_critics_score != null ? `${movie.rt_critics_score}%` : "N/A"}
          </span>
          <span title="Audience Score">
            🍿 {movie.rt_audience_score != null ? `${movie.rt_audience_score}%` : "N/A"}
          </span>
        </div>

        {/* Availability */}
        <div className="flex flex-wrap gap-1">
          {inTheaters && (
            <span className="text-2xs px-1.5 py-0.5 rounded bg-red-900/50 text-red-300 border border-red-800/50">
              In Theaters
            </span>
          )}
          {streamingProviders.map((provider) => (
            <span
              key={provider}
              className="text-2xs px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-300 border border-emerald-800/50"
            >
              {provider}
            </span>
          ))}
          {!isReleased && streaming.length === 0 && (
            <span className="text-2xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700/50">
              Not Released
            </span>
          )}
        </div>

        {/* Checkboxes */}
        <div className="flex flex-col gap-1.5 pt-1 border-t border-zinc-800">
          {(["watched", "daniel_list", "ashley_list"] as const).map((field) => {
            const labels: Record<string, string> = {
              watched: "Watched",
              daniel_list: "Daniel's List",
              ashley_list: "Ashley's List",
            };
            return (
              <label
                key={field}
                className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer hover:text-white transition-colors"
              >
                <input
                  type="checkbox"
                  checked={movie[field]}
                  onChange={() => onToggle(movie.id, field, !movie[field])}
                  className="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/30 focus:ring-offset-0"
                />
                {labels[field]}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/goblin/GoblinMovieCard.tsx
git commit -m "feat: GoblinMovieCard component with poster, scores, badges, checkboxes"
```

---

### Task 5: Page Component + Client Wrapper

**Files:**
- Create: `web/components/goblin/GoblinDayPage.tsx`
- Create: `web/app/goblin-day/page.tsx`

- [ ] **Step 1: Write the client-side page wrapper**

Create `web/components/goblin/GoblinDayPage.tsx`:

```typescript
"use client";

import { useState, useCallback } from "react";
import GoblinMovieCard, { type GoblinMovie } from "./GoblinMovieCard";

interface Props {
  initialMovies: GoblinMovie[];
}

export default function GoblinDayPage({ initialMovies }: Props) {
  const [movies, setMovies] = useState(initialMovies);
  const [activeYear, setActiveYear] = useState<2025 | 2026>(2026);

  const filteredMovies = movies.filter((m) => m.year === activeYear);

  const handleToggle = useCallback(
    async (id: number, field: string, value: boolean) => {
      // Optimistic update
      setMovies((prev) =>
        prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
      );

      try {
        const res = await fetch(`/api/goblin-day/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });

        if (!res.ok) {
          // Revert on failure
          setMovies((prev) =>
            prev.map((m) => (m.id === id ? { ...m, [field]: !value } : m))
          );
        }
      } catch {
        // Revert on error
        setMovies((prev) =>
          prev.map((m) => (m.id === id ? { ...m, [field]: !value } : m))
        );
      }
    },
    []
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="text-center py-12 px-4">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          🎃 Goblin Day 🎃
        </h1>
        <p className="text-zinc-400 mt-2 text-lg">
          Horror movies. Scary vibes. Daniel & Ashley.
        </p>
      </header>

      {/* Year Tabs */}
      <div className="flex justify-center gap-2 mb-8">
        {([2025, 2026] as const).map((year) => (
          <button
            key={year}
            onClick={() => setActiveYear(year)}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
              activeYear === year
                ? "bg-orange-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
            }`}
          >
            {year}
          </button>
        ))}
      </div>

      {/* Movie Grid */}
      <main className="max-w-7xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredMovies.map((movie) => (
            <GoblinMovieCard
              key={movie.id}
              movie={movie}
              onToggle={handleToggle}
            />
          ))}
        </div>

        {filteredMovies.length === 0 && (
          <p className="text-center text-zinc-500 py-16">
            No movies yet for {activeYear}. Run the seed script!
          </p>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Write the server page**

Create `web/app/goblin-day/page.tsx`:

```typescript
import { createClient } from "@/lib/supabase/server";
import GoblinDayPage from "@/components/goblin/GoblinDayPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Goblin Day — Horror Movie Tracker",
  description: "Daniel & Ashley's horror movie watchlist for 2025-2026",
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();

  const { data: movies } = await supabase
    .from("goblin_movies")
    .select("*")
    .order("release_date", { ascending: true, nullsFirst: false });

  return <GoblinDayPage initialMovies={movies ?? []} />;
}
```

- [ ] **Step 3: Verify the page loads at localhost:3000/goblin-day**

Run: `cd /Users/coach/Projects/LostCity/web && npm run dev`
Navigate to `http://localhost:3000/goblin-day`
Expected: Page loads with header, year tabs, and empty state message. No errors.

- [ ] **Step 4: Commit**

```bash
git add web/components/goblin/GoblinDayPage.tsx web/app/goblin-day/page.tsx
git commit -m "feat: Goblin Day page with year tabs and optimistic checkbox toggling"
```

---

### Task 6: TMDB Seed Script

**Files:**
- Create: `web/scripts/seed-goblin-movies.ts`

**Prerequisites:** User needs a TMDB API key. Sign up free at https://www.themoviedb.org/settings/api — add as `TMDB_API_KEY` in `web/.env.local`.

- [ ] **Step 1: Write the seed script**

Create `web/scripts/seed-goblin-movies.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// --- Env loading (same pattern as other seed scripts) ---
function loadEnv(envPath: string): Record<string, string> {
  const contents = fs.readFileSync(envPath, "utf-8");
  const env: Record<string, string> = {};
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return env;
}

const envPath = path.resolve(__dirname, "../.env.local");
const env = loadEnv(envPath);

const supabase = createClient(
  env["NEXT_PUBLIC_SUPABASE_URL"],
  env["SUPABASE_SERVICE_KEY"]
);

const TMDB_KEY = env["TMDB_API_KEY"];
if (!TMDB_KEY) {
  console.error("Missing TMDB_API_KEY in .env.local");
  process.exit(1);
}

const TMDB_BASE = "https://api.themoviedb.org/3";
const US_REGION = "US";

interface TmdbMovie {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
}

interface TmdbProvider {
  provider_name: string;
}

interface TmdbWatchProviders {
  results?: {
    US?: {
      flatrate?: TmdbProvider[];
      rent?: TmdbProvider[];
      buy?: TmdbProvider[];
      // "link" field exists but we don't need it
    };
  };
}

// Fetch all pages of horror movies for a given year
async function fetchHorrorMovies(year: number): Promise<TmdbMovie[]> {
  const movies: TmdbMovie[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = `${TMDB_BASE}/discover/movie?api_key=${TMDB_KEY}&with_genres=27&primary_release_year=${year}&region=${US_REGION}&sort_by=primary_release_date.asc&page=${page}`;
    const res = await fetch(url);
    const data = await res.json();
    totalPages = Math.min(data.total_pages, 20); // Cap at 20 pages
    movies.push(...data.results);
    page++;
    // Be nice to TMDB
    await new Promise((r) => setTimeout(r, 250));
  }

  return movies;
}

// Fetch streaming providers for a movie
async function fetchProviders(tmdbId: number): Promise<string[]> {
  const url = `${TMDB_BASE}/movie/${tmdbId}/watch/providers?api_key=${TMDB_KEY}`;
  const res = await fetch(url);
  const data: TmdbWatchProviders = await res.json();
  const us = data.results?.US;
  if (!us) return [];

  const providers: string[] = [];
  if (us.flatrate) {
    providers.push(...us.flatrate.map((p) => p.provider_name));
  }
  return providers;
}

// Check if movie is currently in theaters (released within last 60 days, no streaming)
function isInTheaters(releaseDate: string, streamingProviders: string[]): boolean {
  if (streamingProviders.length > 0) return false;
  const release = new Date(releaseDate);
  const now = new Date();
  const daysSinceRelease = (now.getTime() - release.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceRelease >= 0 && daysSinceRelease <= 90;
}

async function seed() {
  console.log("Seeding Goblin Day movies...\n");

  for (const year of [2025, 2026]) {
    console.log(`--- ${year} ---`);
    const movies = await fetchHorrorMovies(year);
    console.log(`Found ${movies.length} horror movies from TMDB\n`);

    let inserted = 0;
    let skipped = 0;

    for (const movie of movies) {
      // Skip movies with no title or very short titles (likely data noise)
      if (!movie.title || movie.title.length < 2) continue;

      // Fetch streaming info
      const streamingProviders = await fetchProviders(movie.id);
      const streamingInfo: string[] = [...streamingProviders];

      if (movie.release_date && isInTheaters(movie.release_date, streamingProviders)) {
        streamingInfo.unshift("theaters");
      }

      const row = {
        tmdb_id: movie.id,
        title: movie.title,
        release_date: movie.release_date || null,
        poster_path: movie.poster_path,
        streaming_info: streamingInfo.length > 0 ? streamingInfo : [],
        year,
      };

      // Check if exists (partial unique index doesn't support upsert)
      const { data: existing } = await supabase
        .from("goblin_movies")
        .select("id")
        .eq("tmdb_id", movie.id)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      const { error } = await supabase
        .from("goblin_movies")
        .insert(row as never);

      if (error) {
        console.error(`  Error inserting "${movie.title}":`, error.message);
      } else {
        inserted++;
      }

      // Rate limit
      await new Promise((r) => setTimeout(r, 200));
    }

    console.log(`  Inserted: ${inserted}, Skipped (duplicates): ${skipped}\n`);
  }

  console.log("Done!");
}

seed().catch(console.error);
```

- [ ] **Step 2: Get a TMDB API key**

User action: Sign up at https://www.themoviedb.org/settings/api (free). Add to `web/.env.local`:
```
TMDB_API_KEY=your_key_here
```

- [ ] **Step 3: Run the seed script**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsx scripts/seed-goblin-movies.ts`
Expected: Movies inserted for both 2025 and 2026. Console shows counts.

- [ ] **Step 4: Verify page shows movies**

Navigate to `http://localhost:3000/goblin-day`
Expected: Movie grid populated with posters, titles, release dates, streaming badges. Checkboxes toggle and persist on refresh.

- [ ] **Step 5: Commit**

```bash
git add web/scripts/seed-goblin-movies.ts
git commit -m "feat: TMDB seed script for Goblin Day horror movies"
```

---

### Task 7: TypeScript Check + Visual Polish

**Files:**
- Possibly modify: any of the above files if tsc finds issues

- [ ] **Step 1: Run TypeScript check**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: No errors in goblin-day files. Fix any that appear.

- [ ] **Step 2: Visual QA in browser**

Check at `http://localhost:3000/goblin-day`:
- Poster images load correctly
- Year tab switching works
- Checkboxes toggle with optimistic updates (no page reload)
- "Not Released" badge shows for unreleased movies
- Streaming badges show provider names
- Mobile responsive (375px width)

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A web/components/goblin/ web/app/goblin-day/
git commit -m "fix: goblin-day visual polish and TypeScript fixes"
```
