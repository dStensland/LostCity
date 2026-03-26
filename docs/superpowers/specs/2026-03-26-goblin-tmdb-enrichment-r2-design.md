# Goblin Day — TMDB Enrichment Round 2

**Date:** 2026-03-26
**Status:** Approved

## Overview

Add director, MPAA rating, real trailer URLs, backdrop images, IMDB IDs, and auto-populated synopses to the Goblin Day horror movie tracker. Consolidate the seed script's per-movie API calls into a single TMDB request using `append_to_response`.

## Database Changes

### New columns on `goblin_movies`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `director` | `text` | yes | First crew entry with `job = "Director"` from TMDB credits |
| `mpaa_rating` | `text` | yes | US certification from TMDB release_dates (R, PG-13, NR, etc.) |
| `trailer_url` | `text` | yes | Full YouTube URL for the official trailer |
| `backdrop_path` | `text` | yes | TMDB path fragment, same format as `poster_path` |
| `imdb_id` | `text` | yes | IMDB ID (e.g. "tt1234567") for link-outs |

### Existing column — `synopsis`

Already exists (migration `20260325400000`), currently unpopulated. Will be filled from TMDB's `overview` field.

## Seed Script Changes

### Consolidate API calls with `append_to_response`

Currently the `--update-tmdb` mode makes 3 separate calls per movie:
1. `/movie/{id}` — detail (runtime, overview, backdrop)
2. `/movie/{id}/keywords` — keywords
3. `/movie/{id}/watch/providers` — streaming

TMDB supports combining these: `/movie/{id}?append_to_response=credits,videos,release_dates,external_ids,keywords,watch/providers`

This returns everything in **one call per movie**. The response includes:
- Root level: `runtime`, `overview`, `backdrop_path`, `genres`, `vote_average`, `vote_count`, `popularity`
- `credits.crew[]` — filter for `job === "Director"`, take first match's `name`
- `videos.results[]` — filter for `site === "YouTube" && type === "Trailer"`, take first match, construct `https://www.youtube.com/watch?v={key}`
- `release_dates.results[]` — find US entry (`iso_3166_1 === "US"`), get `release_dates[0].certification`
- `external_ids.imdb_id` — string like "tt1234567"
- `keywords.keywords[]` — array of `{id, name}`, map to names
- `watch/providers.results.US` — existing logic for categorized streaming info

### New seed mode: `--update-tmdb` (enhanced)

The existing `--update-tmdb` flag will be updated to:
1. Make one consolidated call per movie
2. Populate all new fields (director, mpaa_rating, trailer_url, backdrop_path, imdb_id)
3. Populate `synopsis` from `overview`
4. Continue populating existing fields (genres, votes, runtime, keywords, streaming)

### Full seed path

New movie inserts will also use the consolidated call. The discover endpoint still provides the initial list, but per-movie enrichment uses the single combined call.

## UI Changes

### Card face

**MPAA rating badge** — displayed next to runtime in the existing TMDB score + runtime line:
```
TMDB 7.1 (2.3k)  R | 1h38m
```
If no rating, just shows runtime as before. Badge is plain text, no special color — it's informational, not a status.

**Trailer button** — the existing `TRAILER` button uses `movie.trailer_url` when available. Falls back to the current YouTube search URL (`https://www.youtube.com/results?search_query=...`) when `trailer_url` is null.

**Synopsis** — no UI change. The info flip already renders `movie.synopsis`. It just gets populated now.

### Info flip side

**Director** — new line at the top of the info flip, above keywords:
```
DIRECTED BY ASTER
```
Styled as a section header (`text-zinc-500 text-2xs font-bold tracking-[0.2em] uppercase`). Shows only when `director` is not null.

If last name extraction is ambiguous, just show the full name. Most horror directors are known by last name (Aster, Peele, Wan, Eggers) but the full name is fine too.

**IMDB + Letterboxd links** — two small link buttons at the bottom of the info flip, above "TAP TO CLOSE":
- IMDB: `https://www.imdb.com/title/{imdb_id}/`
- Letterboxd: `https://letterboxd.com/tmdb/{tmdb_id}/`

Both open in new tabs. Styled as subtle text links, not prominent buttons. Only show when the respective ID exists (IMDB needs `imdb_id`, Letterboxd always works since we have `tmdb_id`).

**Backdrop background** — when `backdrop_path` is available, the info flip side uses it as a dim background image instead of solid `bg-black/95`. The backdrop renders behind content with heavy darkening (`bg-black/85` overlay) so text remains readable. Falls back to solid black when no backdrop.

### What doesn't change

- Card face layout and density unchanged
- No new flip modes (still just `info` and `watch`)
- No new filters or sort options
- No changes to the watch flip side
- No changes to the page-level components (GoblinDayPage, sessions, etc.)

## GoblinMovie Type Updates

```typescript
export interface GoblinMovie {
  // ... existing fields ...
  director: string | null;
  mpaa_rating: string | null;
  trailer_url: string | null;
  backdrop_path: string | null;
  imdb_id: string | null;
}
```

## Scope Boundaries

**In scope:**
- Migration for 5 new columns
- Seed script consolidation + new field population
- Synopsis backfill from `overview`
- Card face: MPAA badge, real trailer URL
- Info flip: director, link-outs, backdrop background

**Out of scope:**
- MPAA rating filter (not worth it for 2 people)
- Director filter or search
- Any changes to the watch flip side
- Any page-level layout changes
