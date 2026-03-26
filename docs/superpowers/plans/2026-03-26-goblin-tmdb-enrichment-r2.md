# Goblin Day TMDB Enrichment Round 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add director, MPAA rating, real trailer URLs, backdrop images, IMDB IDs, and auto-populated synopses to the Goblin Day horror movie tracker, while consolidating the seed script's multiple per-movie API calls into a single TMDB request.

**Architecture:** One migration for 5 new columns. Seed script refactored to use TMDB's `append_to_response` (1 call/movie instead of 3-4). Card component updated for MPAA badge on face, director/links/backdrop on info flip. Trailer button uses real URL.

**Tech Stack:** Supabase (migration), TMDB API (`append_to_response`), Next.js/React (card component)

**Spec:** `docs/superpowers/specs/2026-03-26-goblin-tmdb-enrichment-r2-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/20260326200000_goblin_enrichment_r2.sql` | Create | Add 5 new columns |
| `web/scripts/seed-goblin-movies.ts` | Modify | Consolidate API calls, extract new fields |
| `web/components/goblin/GoblinMovieCard.tsx` | Modify | Type updates, MPAA badge, trailer URL, info flip (director, links, backdrop) |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260326200000_goblin_enrichment_r2.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Goblin Day TMDB enrichment round 2
ALTER TABLE goblin_movies
  ADD COLUMN IF NOT EXISTS director text,
  ADD COLUMN IF NOT EXISTS mpaa_rating text,
  ADD COLUMN IF NOT EXISTS trailer_url text,
  ADD COLUMN IF NOT EXISTS backdrop_path text,
  ADD COLUMN IF NOT EXISTS imdb_id text;
```

- [ ] **Step 2: Apply migration**

Run: `cd /Users/coach/Projects/LostCity && npx supabase db push`
Expected: Migration applies cleanly.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260326200000_goblin_enrichment_r2.sql
git commit -m "feat: add director, mpaa_rating, trailer_url, backdrop_path, imdb_id to goblin_movies"
```

---

### Task 2: Consolidate Seed Script API Calls

**Files:**
- Modify: `web/scripts/seed-goblin-movies.ts`

This task replaces `fetchMovieDetail()`, `fetchKeywords()`, and `fetchProviders()` with a single `fetchAllMovieData()` that uses `append_to_response`. It also updates the `--update-tmdb` mode and full seed path to use it.

- [ ] **Step 1: Add the enrichment result interface and consolidated fetch function**

Replace the existing `TmdbMovieDetail` interface and `fetchMovieDetail()`, `fetchKeywords()`, `fetchProviders()` functions with:

```typescript
interface MovieEnrichment {
  runtime: number | null;
  overview: string | null;
  backdrop_path: string | null;
  director: string | null;
  mpaa_rating: string | null;
  trailer_url: string | null;
  imdb_id: string | null;
  keywords: string[];
  genres: string[];
  vote_average: number | null;
  vote_count: number | null;
  popularity: number | null;
  streaming: StreamingInfo;
}

async function fetchAllMovieData(tmdbId: number): Promise<MovieEnrichment> {
  const url = `${TMDB_BASE}/movie/${tmdbId}?api_key=${TMDB_KEY}&append_to_response=credits,videos,release_dates,external_ids,keywords,watch/providers`;
  const res = await fetch(url);
  const data = await res.json();

  // Director — first crew member with job "Director"
  const director: string | null =
    data.credits?.crew?.find((c: any) => c.job === "Director")?.name ?? null;

  // Trailer — first YouTube trailer
  const trailer = data.videos?.results?.find(
    (v: any) => v.site === "YouTube" && v.type === "Trailer"
  );
  const trailer_url = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;

  // MPAA rating — US certification
  const usRelease = data.release_dates?.results?.find(
    (r: any) => r.iso_3166_1 === "US"
  );
  const mpaa_rating: string | null =
    usRelease?.release_dates?.[0]?.certification || null;

  // IMDB ID
  const imdb_id: string | null = data.external_ids?.imdb_id ?? null;

  // Keywords
  const keywords: string[] =
    (data.keywords?.keywords ?? []).map((k: any) => k.name);

  // Genres (from detail endpoint — full objects, not IDs)
  const genres: string[] =
    (data.genres ?? []).map((g: any) => g.name);

  // Streaming — same parsing logic as old fetchProviders
  const us = data["watch/providers"]?.results?.US;
  const streaming: StreamingInfo = {};
  if (us) {
    const names = (arr?: any[]) => arr?.map((p: any) => p.provider_name) ?? [];
    const stream = names(us.flatrate);
    const rent = names(us.rent);
    const buy = names(us.buy);
    const ads = names(us.ads);
    const free = names(us.free);
    if (stream.length > 0) streaming.stream = stream;
    if (rent.length > 0) streaming.rent = rent;
    if (buy.length > 0) streaming.buy = buy;
    if (ads.length > 0) streaming.ads = ads;
    if (free.length > 0) streaming.free = free;
  }

  return {
    runtime: data.runtime ?? null,
    overview: data.overview || null,
    backdrop_path: data.backdrop_path ?? null,
    director,
    mpaa_rating,
    trailer_url,
    imdb_id,
    keywords,
    genres,
    vote_average: data.vote_average ?? null,
    vote_count: data.vote_count ?? null,
    popularity: data.popularity ?? null,
    streaming,
  };
}
```

- [ ] **Step 2: Update the `--update-tmdb` block**

Replace the body of the `if (UPDATE_TMDB)` block's per-movie loop with:

```typescript
    let updated = 0;
    for (const movie of movies) {
      const enrichment = await fetchAllMovieData(movie.tmdb_id);
      await new Promise((r) => setTimeout(r, 300));

      // Theater detection
      const { data: movieRow } = await supabase
        .from("goblin_movies")
        .select("release_date")
        .eq("id", movie.id)
        .single();

      if (movieRow?.release_date && isInTheaters(movieRow.release_date, enrichment.streaming)) {
        enrichment.streaming.theaters = true;
      }

      await supabase
        .from("goblin_movies")
        .update({
          genres: enrichment.genres,
          tmdb_vote_average: enrichment.vote_average,
          tmdb_vote_count: enrichment.vote_count,
          tmdb_popularity: enrichment.popularity,
          runtime_minutes: enrichment.runtime,
          keywords: enrichment.keywords,
          streaming_info: Object.keys(enrichment.streaming).length > 0 ? enrichment.streaming : {},
          synopsis: enrichment.overview,
          director: enrichment.director,
          mpaa_rating: enrichment.mpaa_rating,
          trailer_url: enrichment.trailer_url,
          backdrop_path: enrichment.backdrop_path,
          imdb_id: enrichment.imdb_id,
        } as never)
        .eq("id", movie.id);

      updated++;
      console.log(
        `  ${movie.title}: dir=${enrichment.director ?? "?"} | ${enrichment.mpaa_rating ?? "NR"} | trailer=${enrichment.trailer_url ? "yes" : "no"} | imdb=${enrichment.imdb_id ?? "?"}`
      );
    }
    console.log(`\nUpdated: ${updated} movies`);
```

- [ ] **Step 3: Update the full seed path**

In the main seed loop (the `for (const movie of movies)` block under `// Full seed`), replace the separate `fetchProviders`, `fetchMovieDetail`, `fetchKeywords` calls with:

```typescript
      // Fetch all enrichment data in one call
      const enrichment = await fetchAllMovieData(movie.id);
      await new Promise((r) => setTimeout(r, 300));

      // Theater detection
      if (movie.release_date && isInTheaters(movie.release_date, enrichment.streaming)) {
        enrichment.streaming.theaters = true;
      }
```

And update the row construction to:

```typescript
      const row = {
        tmdb_id: movie.id,
        title: movie.title,
        release_date: movie.release_date || null,
        poster_path: movie.poster_path,
        rt_critics_score: scores.critics,
        rt_audience_score: scores.audience,
        streaming_info: Object.keys(enrichment.streaming).length > 0 ? enrichment.streaming : {},
        genres: enrichment.genres.length > 0 ? enrichment.genres : movie.genre_ids.map((id) => TMDB_GENRES[id]).filter(Boolean),
        tmdb_vote_average: movie.vote_average,
        tmdb_vote_count: movie.vote_count,
        tmdb_popularity: movie.popularity,
        runtime_minutes: enrichment.runtime,
        keywords: enrichment.keywords,
        synopsis: enrichment.overview,
        director: enrichment.director,
        mpaa_rating: enrichment.mpaa_rating,
        trailer_url: enrichment.trailer_url,
        backdrop_path: enrichment.backdrop_path,
        imdb_id: enrichment.imdb_id,
        year,
      };
```

- [ ] **Step 4: Remove dead functions**

Delete `fetchMovieDetail()`, `fetchKeywords()`, `fetchProviders()`, and the `TmdbMovieDetail` interface. They are fully replaced by `fetchAllMovieData()`.

- [ ] **Step 5: Verify script compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add web/scripts/seed-goblin-movies.ts
git commit -m "refactor: consolidate seed script to single TMDB call with append_to_response"
```

---

### Task 3: Backfill Existing Movies

**Files:** None (runs the updated seed script)

- [ ] **Step 1: Run the backfill**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsx scripts/seed-goblin-movies.ts --update-tmdb`
Expected: All 336 movies updated. Console shows director, MPAA rating, trailer status, IMDB ID for each.

- [ ] **Step 2: Spot-check data**

Run a quick query to verify the new columns are populated:

```bash
cd /Users/coach/Projects/LostCity/web && npx tsx -e "
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
function loadEnv(p) { const c = fs.readFileSync(p,'utf-8'); const e = {}; for (const l of c.split('\n')) { const t = l.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i===-1) continue; e[t.slice(0,i).trim()] = t.slice(i+1).trim(); } return e; }
const env = loadEnv(path.resolve(__dirname, '.env.local'));
const sb = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_KEY']);
(async () => {
  const { data } = await sb.from('goblin_movies').select('title, director, mpaa_rating, trailer_url, imdb_id, synopsis, backdrop_path').not('director','is',null).limit(10);
  for (const m of data) {
    console.log(m.title + ': dir=' + m.director + ' | ' + m.mpaa_rating + ' | trailer=' + (m.trailer_url ? 'yes' : 'no') + ' | imdb=' + m.imdb_id + ' | synopsis=' + (m.synopsis ? m.synopsis.slice(0,40) + '...' : 'null') + ' | backdrop=' + (m.backdrop_path ? 'yes' : 'no'));
  }
  // Count coverage
  const { count: dirCount } = await sb.from('goblin_movies').select('*', { count: 'exact', head: true }).not('director','is',null);
  const { count: trailerCount } = await sb.from('goblin_movies').select('*', { count: 'exact', head: true }).not('trailer_url','is',null);
  const { count: synopsisCount } = await sb.from('goblin_movies').select('*', { count: 'exact', head: true }).not('synopsis','is',null);
  const { count: total } = await sb.from('goblin_movies').select('*', { count: 'exact', head: true });
  console.log('\\nCoverage: ' + dirCount + '/' + total + ' directors, ' + trailerCount + '/' + total + ' trailers, ' + synopsisCount + '/' + total + ' synopses');
})();
"
```

Expected: Most movies have director + synopsis populated. Trailer coverage will vary (some movies don't have trailers on TMDB).

---

### Task 4: Update GoblinMovie Type

**Files:**
- Modify: `web/components/goblin/GoblinMovieCard.tsx` (lines 15-34, the `GoblinMovie` interface)

- [ ] **Step 1: Add new fields to GoblinMovie interface**

Add these fields to the `GoblinMovie` interface after `keywords`:

```typescript
  director: string | null;
  mpaa_rating: string | null;
  trailer_url: string | null;
  backdrop_path: string | null;
  imdb_id: string | null;
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: No errors (the new fields are all nullable, so existing code still works).

- [ ] **Step 3: Commit**

```bash
git add web/components/goblin/GoblinMovieCard.tsx
git commit -m "feat: add director, mpaa_rating, trailer_url, backdrop_path, imdb_id to GoblinMovie type"
```

---

### Task 5: Card Face — MPAA Badge + Real Trailer URL

**Files:**
- Modify: `web/components/goblin/GoblinMovieCard.tsx`

- [ ] **Step 1: Add MPAA badge next to runtime**

Replace the TMDB Score + Runtime block (lines 193-206) with:

```tsx
        {/* TMDB Score + Runtime + MPAA */}
        <div className="flex items-center gap-2 text-2xs text-zinc-500">
          {movie.tmdb_vote_average != null && (
            <span className={`${movie.tmdb_vote_average >= 7 ? "text-amber-500" : movie.tmdb_vote_average >= 5 ? "text-zinc-400" : "text-zinc-600"}`}>
              TMDB {movie.tmdb_vote_average.toFixed(1)}
              {movie.tmdb_vote_count != null && (
                <span className="text-zinc-600 ml-0.5">({formatVoteCount(movie.tmdb_vote_count)})</span>
              )}
            </span>
          )}
          {movie.mpaa_rating && (
            <span className="text-zinc-400">{movie.mpaa_rating}</span>
          )}
          {movie.mpaa_rating && movie.runtime_minutes != null && (
            <span className="text-zinc-700">|</span>
          )}
          {movie.runtime_minutes != null && (
            <span className="text-zinc-500">{formatRuntime(movie.runtime_minutes)}</span>
          )}
        </div>
```

- [ ] **Step 2: Use real trailer URL when available**

Replace the `trailerUrl` const (line 95) with:

```typescript
  const trailerUrl = movie.trailer_url
    ?? `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + " " + movie.year + " trailer")}`;
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add web/components/goblin/GoblinMovieCard.tsx
git commit -m "feat: MPAA badge on card face, real trailer URLs"
```

---

### Task 6: Info Flip — Director, Links, Backdrop

**Files:**
- Modify: `web/components/goblin/GoblinMovieCard.tsx`

- [ ] **Step 1: Update info button visibility**

The info flip button currently shows when `(movie.keywords && movie.keywords.length > 0) || movie.synopsis`. Update the condition (line 139) to also show when director or imdb_id exist:

```tsx
          {(movie.director || (movie.keywords && movie.keywords.length > 0) || movie.synopsis || movie.imdb_id) && (
```

- [ ] **Step 2: Add director line at top of info flip**

Inside the `{flipMode === "info" && ( ... )}` block, add this as the first element (before the Keywords section):

```tsx
              {/* Director */}
              {movie.director && (
                <h4 className="text-zinc-400 text-2xs font-bold tracking-[0.2em] uppercase mb-3">
                  DIRECTED BY <span className="text-white">{movie.director.toUpperCase()}</span>
                </h4>
              )}
```

- [ ] **Step 3: Add IMDB + Letterboxd links at bottom of info flip**

Inside the `{flipMode === "info" && ( ... )}` block, after the Synopsis section and before the closing `</>`, add:

```tsx
              {/* External links */}
              {(movie.imdb_id || movie.tmdb_id) && (
                <div className="flex gap-2 mt-3 pt-2 border-t border-zinc-800/50">
                  {movie.imdb_id && (
                    <a
                      href={`https://www.imdb.com/title/${movie.imdb_id}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-2xs text-amber-500/70 hover:text-amber-400 tracking-wider uppercase transition-colors"
                    >
                      IMDB &rarr;
                    </a>
                  )}
                  {movie.tmdb_id && (
                    <a
                      href={`https://letterboxd.com/tmdb/${movie.tmdb_id}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-2xs text-emerald-500/70 hover:text-emerald-400 tracking-wider uppercase transition-colors"
                    >
                      LETTERBOXD &rarr;
                    </a>
                  )}
                </div>
              )}
```

Note: `e.stopPropagation()` prevents the link click from triggering the parent div's `onClick` (which closes the flip).

- [ ] **Step 4: Add backdrop background to info flip**

Replace the info flip overlay's opening div (line 274-276):

```tsx
      {flipMode && (
        <div
          className="absolute inset-0 z-20 bg-black/95 p-3 flex flex-col cursor-pointer overflow-y-auto"
          onClick={() => setFlipMode(null)}
        >
```

With:

```tsx
      {flipMode && (
        <div
          className="absolute inset-0 z-20 p-3 flex flex-col cursor-pointer overflow-y-auto"
          onClick={() => setFlipMode(null)}
        >
          {/* Backdrop background (info flip only) */}
          {flipMode === "info" && movie.backdrop_path ? (
            <div className="absolute inset-0 -z-10">
              <SmartImage
                src={`https://image.tmdb.org/t/p/w780${movie.backdrop_path}`}
                alt=""
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-black/88" />
            </div>
          ) : (
            <div className="absolute inset-0 -z-10 bg-black/95" />
          )}
```

- [ ] **Step 5: Verify build**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add web/components/goblin/GoblinMovieCard.tsx
git commit -m "feat: director, IMDB/Letterboxd links, backdrop on info flip"
```

---

### Task 7: Verify Everything End-to-End

**Files:** None

- [ ] **Step 1: TypeScript full check**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: Clean — no errors.

- [ ] **Step 2: Run pre-commit tests**

Run: `cd /Users/coach/Projects/LostCity/web && npx vitest run --reporter=verbose 2>&1 | tail -20`
Expected: All tests pass. (Goblin day has no tests — just verify nothing else broke.)

- [ ] **Step 3: Visual check (dev server)**

Run: `cd /Users/coach/Projects/LostCity/web && npm run dev`
Navigate to `http://localhost:3000/goblin-day`

Check:
- Contenders tab: cards show MPAA rating next to runtime (e.g. `R | 1h38m`)
- Click trailer button: opens a real YouTube video page (not a search), for movies that have trailers
- Click info (i) button: see "DIRECTED BY [NAME]" at top, backdrop image dimly visible behind content
- Info flip bottom: IMDB and LETTERBOXD links open correct pages in new tabs
- Synopsis text appears on info flip for movies that have it
- Watch (play) button still works as before
