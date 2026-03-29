# Goblin Day: Personal Movie Log

## Overview

A personal movie diary within Goblin Day. Log any movie you watch (not just horror), with date, notes, who you watched with, and custom tags. Shareable public page. Looks cool as hell.

## What It Does

- **Log a movie**: TMDB search -> pick date watched, add optional note, optional "watched with" text, optional tags
- **Browse your log**: Chronological list for a given year, newest first. Poster-forward. Filter by year, by tag.
- **Tags**: Free-form, user-created (e.g. "cbmc", "plaza", "date-night"). Colored pills. Type to create, pick from existing.
- **Edit anything**: Date, note, watched_with, tags all editable after creation.
- **Public page**: `/goblinday/log/[username]` — read-only, no auth to view. Clean poster grid with year picker.

## What It Doesn't Do (Yet)

- No rankings or star ratings (future add)
- No social features (no comments from others, no follows)
- No import from Letterboxd/CSV
- No rewatch tracking (one entry per watch — if you rewatch, it's a new entry)

## Data Model

### New Tables

**`goblin_log_entries`** — one row per movie-watch event

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `user_id` | uuid FK auth.users | ON DELETE CASCADE |
| `movie_id` | integer FK goblin_movies | Movie from catalog |
| `watched_date` | date NOT NULL | When you watched it |
| `note` | text | Optional short comment |
| `watched_with` | text | Optional free text ("Ashley + Daniel") |
| `sort_order` | integer | Manual ordering within a year (default: reverse chrono by watched_date) |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

RLS: Users read/write own rows. Public SELECT for the public log page.

**`goblin_tags`** — user's tag library

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `user_id` | uuid FK auth.users | ON DELETE CASCADE |
| `name` | text NOT NULL | e.g. "cbmc", "plaza", "date-night" |
| `color` | text | Hex color for the pill. Auto-assigned from a palette if not set. |
| `created_at` | timestamptz | |

Unique constraint: (user_id, name). RLS: Users manage own tags. Public SELECT.

**`goblin_log_entry_tags`** — join table

| Column | Type | Notes |
|--------|------|-------|
| `entry_id` | integer FK goblin_log_entries | ON DELETE CASCADE |
| `tag_id` | integer FK goblin_tags | ON DELETE CASCADE |

PK: (entry_id, tag_id). RLS: Follows entry ownership.

### Changes to Existing Tables

**`goblin_movies`** — no schema changes. Non-horror movies get added to this table via TMDB search on log entry creation. The `year` column CHECK constraint (2024-2030) needs to be dropped or widened since users may log older movies.

**`goblin_user_profiles`** — new table (or extend existing profile system)

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | uuid PK FK auth.users | ON DELETE CASCADE |
| `slug` | text UNIQUE NOT NULL | URL-safe username for public page |
| `display_name` | text | |
| `created_at` | timestamptz | |

RLS: Owner can update. Public SELECT.

## API Routes

### Log Entry CRUD

**`GET /api/goblinday/me/log`** — Fetch user's log entries
- Query params: `?year=2026`, `?tag=cbmc`
- Returns entries with movie data (poster, title, genres, etc.) and tags
- Auth required

**`POST /api/goblinday/me/log`** — Create a log entry
- Body: `{ tmdb_id: number, watched_date: string, note?: string, watched_with?: string, tag_ids?: number[] }`
- If movie doesn't exist in `goblin_movies`, fetch from TMDB API and insert it first
- Auth required

**`PATCH /api/goblinday/me/log/[id]`** — Update a log entry
- Body: any subset of `{ watched_date, note, watched_with, tag_ids, sort_order }`
- Auth required, must own entry

**`DELETE /api/goblinday/me/log/[id]`** — Delete a log entry
- Auth required, must own entry

### Tag CRUD

**`GET /api/goblinday/me/tags`** — Fetch user's tags
- Auth required

**`POST /api/goblinday/me/tags`** — Create a tag
- Body: `{ name: string, color?: string }`
- Auto-assigns color from palette if not provided
- Auth required

**`PATCH /api/goblinday/me/tags/[id]`** — Update tag name or color
- Auth required, must own tag

**`DELETE /api/goblinday/me/tags/[id]`** — Delete a tag (cascades to entry associations)
- Auth required, must own tag

### Public Log

**`GET /api/goblinday/log/[slug]`** — Fetch a user's public log
- Query params: `?year=2026`
- Returns log entries with movie data and tags. No auth required.
- 404 if slug not found.

### Profile

**`GET /api/goblinday/me/profile`** — Get or create goblin profile
- Auto-creates profile with generated slug on first access
- Auth required

**`PATCH /api/goblinday/me/profile`** — Update slug/display_name
- Validates slug uniqueness, URL safety
- Auth required

### TMDB Search

**`GET /api/goblinday/tmdb/search`** — Search TMDB for any movie
- Query params: `?q=parasite`
- Returns array of `{ tmdb_id, title, poster_path, release_date, overview }`
- Proxied through our API to protect TMDB key
- Auth required (only logged-in users can search to add)

## Pages & Components

### New Tab: "My Log" in GoblinDayPage

Added as a new tab alongside existing tabs (next, contenders, upcoming, watched). Only visible when authenticated.

### GoblinLogView (main log component)

- Year selector (horizontal pill strip, current year default)
- Tag filter (show entries matching a tag)
- Poster grid/list of entries, chronological (newest first)
- Each entry: poster thumbnail, title, watched_date, tags as colored pills, note preview, watched_with
- Click entry to expand/edit inline or open detail modal
- "Add Movie" FAB or button -> opens TMDB search modal

### GoblinLogEntryCard

- Movie poster (TMDB w500) as the visual anchor
- Title + year overlay or below
- Date watched, formatted nicely ("Mar 15, 2026")
- Tag pills (colored, compact)
- Watched with text (subtle, secondary)
- Note preview (truncated, expand on click)
- Edit button -> inline edit or modal

### GoblinAddMovieModal

- TMDB search input with debounced autocomplete
- Results as poster + title + year rows
- Select a movie -> form appears: date (default today), note, watched_with, tag picker
- Tag picker: shows existing tags as chips, "+" to create new tag inline
- Submit -> creates entry, animates into the log

### GoblinLogPublicPage (`/goblinday/log/[slug]`)

- Server-rendered, no auth needed
- User's display name + year picker
- Poster grid of the year's movies
- Click a poster -> expands to show note, tags, watched_with, date
- Minimal, clean, shareable. OG metadata for social sharing.

### GoblinEditEntryModal

- Pre-filled form with current values
- Same fields as add: date, note, watched_with, tags
- Save/cancel/delete actions

## Visual Design

Dark theme consistent with existing Goblin Day aesthetic. Design system tokens from `globals.css`.

### Animations ("cool af")

- **Entry add**: New entry animates in from the top with a poster flip/scale-up. Staggered entrance on initial load.
- **Poster hover**: Subtle lift + glow (consistent with `hover-lift` but with a poster-specific glow color sampled from the poster or using `--coral`).
- **Tag pills**: Spring animation on add/remove. Colored pills with subtle glow matching tag color.
- **Year switch**: Crossfade transition between years, posters stagger in.
- **Entry expand**: Smooth height animation revealing note/details.
- **Delete**: Entry shrinks and fades out, remaining entries slide up.
- **Public page**: Staggered poster entrance on scroll (intersection observer), subtle parallax on poster grid.

### Layout

- **Private log**: Masonry-style poster grid (2 cols mobile, 3-4 cols desktop) or vertical timeline with poster thumbnails. Poster-forward — the visual should feel like looking at a wall of movie posters.
- **Public page**: Clean poster grid. Minimal chrome. User name + year as the only header. Posters are the star.

### Tag Colors

Auto-assigned from a curated palette of 12 distinct colors that work on dark backgrounds. User can override. Colors are vibrant but not neon — more like muted jewel tones.

```
Palette: coral, amber, emerald, sky, violet, rose, teal, orange, lime, fuchsia, cyan, indigo
```

## TMDB Integration

The `POST /api/goblinday/me/log` endpoint handles TMDB movie insertion:

1. Check if `tmdb_id` exists in `goblin_movies`
2. If not, call TMDB API (`/movie/{tmdb_id}`) to fetch: title, poster_path, backdrop_path, release_date, genres, runtime, director (from credits), overview
3. Insert into `goblin_movies` (the same table used by horror movies — it just grows to include any movie)
4. Create the log entry pointing to the movie

The `year` CHECK constraint on `goblin_movies` (currently `year >= 2024 AND year <= 2030`, NOT NULL) must be dropped and the column made nullable, since someone might log a movie from 1994 or an obscure film with no year.

## Migration Plan

Single migration file:
1. Drop/widen `year` CHECK on `goblin_movies`
2. Create `goblin_user_profiles`
3. Create `goblin_tags`
4. Create `goblin_log_entries`
5. Create `goblin_log_entry_tags`
6. RLS policies for all new tables
7. Indexes on `goblin_log_entries(user_id, watched_date)` and `goblin_tags(user_id)`
