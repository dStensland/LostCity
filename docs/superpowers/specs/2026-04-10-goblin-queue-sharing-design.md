# Goblin Day: Public Queue & Recommendations

## Overview

A shareable public page for your watchlist ("The Queue") where visitors can see what you want to watch and recommend movies to you. Recommendations are TMDB-backed (real movie entries with posters/metadata), optionally attributed to signed-in users or anonymous visitors with a typed name. Queue owner manages pending recommendations from their private watchlist view.

## What It Does

- **Public queue page** (`/goblinday/queue/[slug]`): read-only poster grid of your watchlist, plus a "Recommend a Movie" section with TMDB search
- **Recommendations**: visitors search TMDB, pick a movie, add their name + optional note. Signed-in users get auto-attributed.
- **Private management**: pending recommendations appear at the top of your watchlist view. One-click "Add to Queue" or dismiss.
- **Share link**: "SHARE" button on the private watchlist copies the public URL to clipboard

## What It Doesn't Do

- No rate limiting on recommendations (audience is friends, not the public internet)
- No notification system (you see recommendations when you open your watchlist)
- No commenting or threading on recommendations
- No recommendation history visible to visitors (they don't see if someone else already recommended something)

## Data Model

### New Table

**`goblin_watchlist_recommendations`** — one row per movie recommendation

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `target_user_id` | uuid FK auth.users | Queue owner. ON DELETE CASCADE |
| `movie_id` | integer FK goblin_movies | The recommended movie |
| `recommender_user_id` | uuid FK auth.users | Nullable — set if visitor is signed in |
| `recommender_name` | text NOT NULL | Auto-filled from profile if signed in, typed if anonymous |
| `note` | text | Optional message |
| `status` | text NOT NULL DEFAULT 'pending' | `pending`, `added`, `dismissed` |
| `created_at` | timestamptz | DEFAULT now() |

Unique constraint: `(target_user_id, movie_id, recommender_name)` — same person can't recommend the same movie twice.

RLS:
- Public INSERT (anyone can recommend)
- Owner SELECT/UPDATE on rows where `target_user_id = auth.uid()` (to view and change status)
- Anon SELECT for the insert conflict check

### No Changes to Existing Tables

## API Routes

### Public Queue Page

**`GET /api/goblinday/queue/[slug]`** — Fetch a user's public queue
- Returns watchlist entries with movie data (poster, title, year, director, genres), ordered by sort_order
- Resolves user via `goblin_user_profiles.slug`
- No auth required. 404 if slug not found.

### Public TMDB Search Proxy

**`GET /api/goblinday/queue/[slug]/search`** — TMDB search for the recommend form
- Query params: `?q=chinatown`
- Proxies to TMDB search, returns `{ results: TMDBSearchResult[] }`
- No auth required. Scoped to this page context.

### Submit Recommendation

**`POST /api/goblinday/queue/[slug]/recommend`** — Submit a movie recommendation
- Body: `{ tmdb_id: number, recommender_name: string, note?: string }`
- If visitor is authenticated, auto-attaches `recommender_user_id` and overrides `recommender_name` with profile display name
- Ensures movie exists in `goblin_movies` via TMDB (`ensureMovie` pattern)
- Returns 409 if this person already recommended this movie to this user
- No auth required

### Private Recommendation Management

**`GET /api/goblinday/me/recommendations`** — Fetch pending recommendations
- Returns recommendations where `status = 'pending'` with movie data
- Auth required

**`POST /api/goblinday/me/recommendations/[id]/action`** — Act on a recommendation
- Body: `{ action: 'add' | 'dismiss' }`
- `add`: creates `goblin_watchlist_entries` row at bottom of queue, sets status to `added`
- `dismiss`: sets status to `dismissed`
- Auth required, must own the recommendation (`target_user_id`)

## Pages & Components

### Public Page: `/goblinday/queue/[slug]`

**`GoblinQueuePublicPage`** — server-rendered page

- Header: user's display name + "The Queue" + film count
- Poster grid of queued movies (read-only — posters with title/year, no rank numbers)
- Amber/gold accent consistent with private watchlist

**`GoblinQueueRecommendForm`** — client component within the public page

- TMDB search input (debounced, uses `/api/goblinday/queue/[slug]/search`)
- Search results as poster + title + year rows
- Select a movie → form: name field (pre-filled if signed in, editable), optional note textarea
- "Recommend" submit button
- Success state: "Recommendation sent!" inline message, fades after a few seconds
- Checks auth client-side to pre-fill name

### Private Side: Recommendations in GoblinWatchlistView

- New section at top of watchlist view, only shown when pending recommendations exist
- Header: "Recommendations" + count
- Each card: poster thumbnail + title + year + "from [name]" + note
- Two buttons: "+ Add" (adds to queue, marks as `added`) and "×" (dismisses)
- Section disappears when all recommendations are handled
- Lighter visual treatment than queue cards — no rank numbers, subtle border

### Share Link

- "SHARE" button on private watchlist header (same pattern as The Log's share button)
- Copies `https://lostcity.ai/goblinday/queue/[username]` to clipboard

## Hook Changes

**Extend `useGoblinWatchlist`:**

- Add `recommendations` state (pending only)
- Add `fetchRecommendations()` — called on mount
- Add `addRecommendation(id)` — calls `/action` with `add`, optimistic removal from list, refetches entries
- Add `dismissRecommendation(id)` — calls `/action` with `dismiss`, optimistic removal
- Add `recommendationCount` — number of pending recommendations

## Migration Plan

Single migration file:
1. Create `goblin_watchlist_recommendations` table
2. RLS policies: public INSERT, owner SELECT/UPDATE
3. Index on `(target_user_id, status)` for efficient pending queries
4. Unique constraint on `(target_user_id, movie_id, recommender_name)`
