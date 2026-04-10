# Goblin Day: To-Watch List (The Queue)

## Overview

A personal watchlist within Goblin Day. Add any movie you want to watch via TMDB search or quick-add from horror tabs. Manually order and categorize with watchlist-specific tags. When you watch a movie, a "Watched" action funnels it into The Log with date/notes/tags — then removes it from the queue. The watchlist and Log are distinct surfaces connected by that single action.

## What It Does

- **Add movies to watch**: TMDB search from the watchlist view, or quick-add from horror movie cards (replaces the old bookmark toggle)
- **Organize**: Drag-to-reorder priority ranking, categorize with watchlist-specific tags (separate from Log tags)
- **"Watched" action**: Opens a pre-filled modal with Log fields (date, note, watched-with, Log tags). On submit, creates a Log entry and removes the watchlist entry atomically.
- **Quick-add from horror tabs**: The existing bookmark/SAVED behavior on horror movie cards rewires to create watchlist entries instead of toggling `goblin_user_movies.bookmarked`

## What It Doesn't Do

- No public sharing page (Log has this; watchlist is private-only for now)
- No "watched" history — that's The Log's job
- No import from Letterboxd/external lists
- No collaborative watchlists (future possibility via `goblin_lists`)

## Data Model

### New Tables

**`goblin_watchlist_entries`** — one row per movie the user wants to watch

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `user_id` | uuid FK auth.users | ON DELETE CASCADE |
| `movie_id` | integer FK goblin_movies | Inserted via TMDB if new |
| `note` | text | Optional ("Ashley recommended this") |
| `sort_order` | integer | Manual ordering, lower = higher priority |
| `added_at` | timestamptz | DEFAULT now() |

Unique constraint: (user_id, movie_id) — can't add the same movie twice.
RLS: Users CRUD own rows. Public SELECT.

**`goblin_watchlist_tags`** — watchlist-specific tag library

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `user_id` | uuid FK auth.users | ON DELETE CASCADE |
| `name` | text NOT NULL | e.g. "date night pick", "solo watch" |
| `color` | text | Hex, auto-assigned from palette if null |
| `created_at` | timestamptz | DEFAULT now() |

Unique constraint: (user_id, name). RLS: Users manage own. Public SELECT.

**`goblin_watchlist_entry_tags`** — join table

| Column | Type | Notes |
|--------|------|-------|
| `entry_id` | integer FK goblin_watchlist_entries | ON DELETE CASCADE |
| `tag_id` | integer FK goblin_watchlist_tags | ON DELETE CASCADE |

PK: (entry_id, tag_id). RLS follows entry ownership.

### Changes to Existing Tables

None. `goblin_user_movies.bookmarked` stays in place but is no longer written to by new code.

### Data Migration

One-time backfill in the migration: rows in `goblin_user_movies` where `bookmarked = true` are copied into `goblin_watchlist_entries` with `sort_order` assigned by `created_at` order. The `bookmarked` column is not dropped — cleanup is a separate follow-up.

## API Routes

### Watchlist Entry CRUD

**`GET /api/goblinday/me/watchlist`** — Fetch user's watchlist
- Query params: `?tag=date-night`
- Returns entries with movie data (poster, title, genres, director, year) and watchlist tags
- Ordered by `sort_order`
- Auth required

**`POST /api/goblinday/me/watchlist`** — Add movie to watchlist
- Body: `{ tmdb_id: number, note?: string, tag_ids?: number[] }`
- If movie doesn't exist in `goblin_movies`, fetch from TMDB API and insert
- Assigns `sort_order` = max existing + 1 (bottom of list)
- Auth required

**`PATCH /api/goblinday/me/watchlist/[id]`** — Update entry (note, tags)
- Body: subset of `{ note, tag_ids }`
- Auth required, must own entry

**`DELETE /api/goblinday/me/watchlist/[id]`** — Remove from watchlist
- Auth required, must own entry

**`POST /api/goblinday/me/watchlist/reorder`** — Reorder entries
- Body: `{ ids: number[] }` — full ordered list of entry IDs
- Same pattern as existing `/api/goblinday/me/log/reorder`
- Auth required

### Watchlist Tag CRUD

**`GET /api/goblinday/me/watchlist-tags`** — Fetch user's watchlist tags
- Auth required

**`POST /api/goblinday/me/watchlist-tags`** — Create tag
- Body: `{ name: string, color?: string }`
- Auto-assigns color from palette if not provided
- Auth required

**`PATCH /api/goblinday/me/watchlist-tags/[id]`** — Update tag
- Auth required, must own tag

**`DELETE /api/goblinday/me/watchlist-tags/[id]`** — Delete tag (cascades)
- Auth required, must own tag

### "Watched" Action

**`POST /api/goblinday/me/watchlist/[id]/watched`** — Mark as watched
- Body: `{ watched_date: string, note?: string, watched_with?: string, log_tag_ids?: number[] }`
- Creates a `goblin_log_entries` row using the watchlist entry's `movie_id`
- Deletes the `goblin_watchlist_entries` row
- Both in a single request — atomic from the client's perspective
- Returns `{ log_entry_id: number }`
- Auth required, must own watchlist entry

## Pages & Components

### New Tab in GoblinDayPage

"Watchlist" tab added between "watched" and "log":

```
next | contenders | upcoming | watched | watchlist | log
```

Only visible when authenticated.

### GoblinWatchlistView (main component)

- Header: "The Queue" + entry count + active tag indicator
- "+ ADD" button opens GoblinAddToWatchlistModal
- Tag filter strip (watchlist tags, colored pills, same style as Log)
- Drag-to-reorder list (drag handles, arrow up/down, move-to-rank — same interaction as Log)
- Rank numbers on the left
- Empty state: "Nothing in the queue yet" + "Add a movie" button
- Amber/gold accent to visually distinguish from The Log's cyan

### GoblinWatchlistCard (individual entry)

- Rank number + poster thumbnail + title + year
- Watchlist tag pills
- Note preview (if present)
- Actions:
  - **"WATCHED"** button — opens GoblinWatchlistWatchedModal
  - **Edit** — inline edit note/tags
  - **Remove** — delete from watchlist (no log entry created)
- Same horizontal row layout as GoblinLogEntryCard, but with amber/gold accent instead of cyan

### GoblinAddToWatchlistModal

- Same two-phase TMDB search flow as GoblinAddMovieModal
- Simpler form phase (no date, no watched-with):
  - Optional note
  - Watchlist tag picker
- Submit button: "Add to Queue"

### GoblinWatchlistWatchedModal

- Triggered from watchlist card "WATCHED" button
- Movie poster + title pre-filled at top (not changeable)
- Fields: Date Watched (default today), Watched With, Note, Log Tags (from Log's tag library)
- Submit button: "Log It"
- On success: entry removed from watchlist, log entry created

### Quick-Add from Horror Movie Cards

- `GoblinMovieCard`'s `onToggleBookmark` rewired: creates/deletes `goblin_watchlist_entries` rows instead of toggling `goblin_user_movies.bookmarked`
- "SAVED" badge visual stays the same — now means "on your watchlist"
- `GoblinDayPage` tracks `watchlistMovieIds: Set<number>` from the hook to show correct bookmark state on horror cards

## Hook: useGoblinWatchlist

Mirrors `useGoblinLog` pattern:

- **State**: `entries`, `watchlistTags`, `loading`
- **Entry ops**: `addEntry`, `updateEntry`, `deleteEntry`, `reorderEntries`
- **Tag ops**: `createTag`, `deleteTag`
- **Watched**: `markWatched(entryId, logData)` — calls `/watched` endpoint, optimistically removes from local state
- **TMDB**: `searchTMDB` — reuses same function from `goblin-log-utils`
- **Quick-add support**: exposes `watchlistMovieIds: Set<number>` and `addByTmdbId(tmdbId)` for the horror card bookmark toggle

### Data Flow: "Watched" Action

1. User clicks "WATCHED" on a watchlist card
2. `GoblinWatchlistWatchedModal` opens with movie pre-filled, Log tags loaded
3. User fills in date/note/watched-with/tags, hits "Log It"
4. Client calls `POST /api/goblinday/me/watchlist/[id]/watched`
5. Server creates log entry + deletes watchlist entry
6. Client: optimistically removes from watchlist state
7. Log view picks up the new entry on next load/tab switch

## Visual Design

Same dark Goblin Day aesthetic. Key distinction: **amber/gold accent** for the watchlist vs **cyan** for The Log.

- Watchlist header glow: `rgba(255,217,61,0.2)` (--gold)
- Watchlist border accent on cards: amber/gold instead of cyan
- Tag pill palette: same 12 jewel-tone colors as Log (shared palette, separate tag instances)
- Drag-to-reorder: same grab handle + drop indicator animation as Log
- "WATCHED" button: emerald accent (same green as the existing "WATCHED" stamp on horror cards)

## Migration Plan

Single migration file:
1. Create `goblin_watchlist_tags` + RLS + indexes
2. Create `goblin_watchlist_entries` + RLS + indexes
3. Create `goblin_watchlist_entry_tags` + RLS
4. Backfill: `INSERT INTO goblin_watchlist_entries (user_id, movie_id, sort_order, added_at) SELECT user_id, movie_id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at), created_at FROM goblin_user_movies WHERE bookmarked = true`
