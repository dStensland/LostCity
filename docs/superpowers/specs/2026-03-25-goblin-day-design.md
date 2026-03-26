# Goblin Day — Horror Movie Tracker

**Date:** 2026-03-25
**Status:** Approved

## Overview

A standalone page at `/goblin-day` for tracking horror movies from 2025 and 2026. Built for two friends (Daniel and Ashley) who have a recurring "Goblin Day" tradition of watching scary movies together. Shows movie posters, Rotten Tomatoes scores, streaming availability, and personal watchlist checkboxes.

## Data Model

### Supabase table: `goblin_movies`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| tmdb_id | integer | Nullable — manual entries won't have one. Partial unique index: `UNIQUE WHERE tmdb_id IS NOT NULL` |
| title | text | Not null |
| release_date | date | Nullable for TBD releases |
| poster_path | text | TMDB path fragment (e.g. `/kF0uvZ0VGh0.jpg`). Prepend `https://image.tmdb.org/t/p/w500` at render time |
| rt_critics_score | integer | Nullable, 0-100 |
| rt_audience_score | integer | Nullable, 0-100 |
| watched | boolean | Default false. Shared flag — means "either of us has watched it" (typically on a previous Goblin Day) |
| daniel_list | boolean | Default false. Daniel's personal watchlist pick |
| ashley_list | boolean | Default false. Ashley's personal watchlist pick |
| streaming_info | jsonb | Always an array of strings. `["Shudder", "Peacock"]` for streaming, `["theaters"]` for theatrical, `["theaters", "Shudder"]` for both, `[]` or `null` for unreleased |
| year | integer | 2025 or 2026 |
| created_at | timestamptz | Default now() |
| updated_at | timestamptz | Default now(), auto-updated via trigger |

No RLS. No auth. Single shared table.

## Routing

Page lives at `/goblin-day`. The LostCity app has a `[portal]` dynamic segment that catches top-level slugs — `"goblin-day"` must be added to the `reservedRoutes` array in `web/app/[portal]/layout.tsx` so it doesn't 404.

Page file: `web/app/goblin-day/page.tsx` — standalone, no portal layout/nav.

## API Routes

### `GET /api/goblin-day`
Returns all movies sorted by release date. Accepts optional `?year=2025` or `?year=2026` query param.

### `PATCH /api/goblin-day/[id]`
Updates movie fields. Body: `{ field: value }`. Server-side allowlist of mutable fields:
```
watched, daniel_list, ashley_list, rt_critics_score, rt_audience_score, streaming_info
```
Rejects any field not in the list.

## UI Design

### Layout
- Dark, spooky page header with "Goblin Day" branding
- Year tabs: **2025** | **2026**
- Responsive grid of movie cards

### Movie Card
- Large poster image (TMDB `w500` poster via `SmartImage` component — avoids needing TMDB in `next.config.js` remote patterns)
- Title + release date
- RT critics score (tomato icon) + audience score (popcorn icon), or "N/A" if not set
- Availability badge:
  - **"In Theaters"** — red badge (streaming_info includes `"theaters"`)
  - **"Streaming on [Provider]"** — green badge with provider name(s)
  - **"Not Released"** — gray badge (streaming_info is null or empty array)
  - A movie can be both in theaters and streaming — show both badges
- Three checkboxes with labels: Watched, Daniel's List, Ashley's List
- Checkboxes toggle immediately via PATCH call (optimistic UI)

### Sorting
Chronological by release date. Already-released movies first, then upcoming. Within each group, sorted by date ascending. Movies with null release_date sort at the end of the upcoming group.

## Data Seeding

### TMDB API Script
A seed script (`web/scripts/seed-goblin-movies.ts`) that:
1. Hits TMDB discover endpoint for genre 27 (Horror), years 2025 and 2026
2. Fetches title, release_date, poster_path, and watch providers (via TMDB watch/providers endpoint)
3. Inserts into `goblin_movies` table using `ON CONFLICT (tmdb_id) DO NOTHING` for idempotent re-runs
4. Manual entries (no tmdb_id) are unaffected by re-runs

### Manual Curation
RT scores are manually entered via Supabase dashboard. Additional movies from Reddit watchlists (r/horror 2025 and 2026 lists) can be added manually or via the seed script with hardcoded TMDB IDs.

## Scope Boundaries

**In scope:**
- Movie list display with posters and metadata
- RT score display (manually maintained)
- Streaming/theater availability
- Shared watchlist checkboxes (watched, Daniel, Ashley)
- TMDB-based seed script
- Year filtering

**Out of scope:**
- User authentication
- Automatic RT score fetching
- Reviews, ratings, or comments
- Search or filtering beyond year tabs
- Admin UI for adding movies (use Supabase dashboard or seed script)
