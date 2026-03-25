# Goblin Day Sessions

**Date:** 2026-03-25
**Status:** Approved

## Overview

Goblin Day sessions track live movie-watching events. A session is a spontaneous hangout — start one, pull in movies as you go, track themes that emerge between films, and build a timeline log of the day. Past sessions are viewable as history.

## Data Model

### `goblin_sessions`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | text | Optional — "Goblin Day #4" or auto-generated |
| date | date | Not null, defaults to today |
| is_active | boolean | Default true. Only one active at a time |
| created_at | timestamptz | Default now() |

### `goblin_session_movies`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| session_id | integer FK → goblin_sessions | |
| movie_id | integer FK → goblin_movies | |
| added_at | timestamptz | Default now() |
| watch_order | integer | 1, 2, 3... order watched |

### `goblin_themes`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| session_id | integer FK → goblin_sessions | |
| label | text | Freetext — "Evil Children", "Creepy Houses" |
| status | text | `active` or `canceled` |
| created_at | timestamptz | Default now() |
| canceled_at | timestamptz | Nullable |

### `goblin_theme_movies`

| Column | Type | Notes |
|---|---|---|
| theme_id | integer FK → goblin_themes | |
| movie_id | integer FK → goblin_movies | |
| PK | composite | (theme_id, movie_id) |

### `goblin_timeline`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| session_id | integer FK → goblin_sessions | |
| event_type | text | `movie_started`, `movie_finished`, `theme_added`, `theme_canceled` |
| movie_id | integer | Nullable — for movie events |
| theme_id | integer | Nullable — for theme events |
| created_at | timestamptz | Default now() |

All tables: no RLS, permissive public policy (same as goblin_movies).

## API Routes

### `GET /api/goblinday/sessions`
List all sessions ordered by date desc. Returns id, name, date, is_active, movie count, surviving theme labels.

### `POST /api/goblinday/sessions`
Create a new session. Body: `{ name?: string }`. Sets date to today, is_active to true. Returns 400 if a session is already active.

### `GET /api/goblinday/sessions/[id]`
Full session detail: session info, movies (with goblin_movies data joined), themes (with their tagged movies), timeline log.

### `PATCH /api/goblinday/sessions/[id]`
End session: `{ is_active: false }`. Marks session inactive.

### `POST /api/goblinday/sessions/[id]/movies`
Add movie to session. Body: `{ movie_id: number }`. Auto-assigns next watch_order. Creates `movie_started` timeline entry. Also marks the movie as `watched: true` in goblin_movies.

### `POST /api/goblinday/sessions/[id]/themes`
Add theme. Body: `{ label: string, movie_ids?: number[] }`. Creates theme with status `active`, creates theme_movies join rows, creates `theme_added` timeline entry.

### `PATCH /api/goblinday/sessions/[id]/themes/[themeId]`
Cancel or reactivate theme. Body: `{ status: "canceled" | "active" }`. Updates status + canceled_at. Creates `theme_canceled` timeline entry.

## UI

### Route
Same `/goblinday` page. The "Next Goblin Day" tab transforms based on session state.

### No active session (default)
- Large "START GOBLIN DAY" button
- Below: history of past sessions as a list
  - Each row: date, name (or "Goblin Day #N"), movie count, surviving theme pills
  - Clicking a past session shows its detail view (timeline + themes + movies)

### Active session
Two-section layout (stacked on mobile, side-by-side on desktop):

**Top/Left: Movies**
- Current movie displayed prominently (poster + title)
- "NEXT MOVIE" button — opens a picker showing proposed movies + search
- List of movies watched so far in order

**Bottom/Right: Timeline + Themes**
- Active themes as pills at top, each with X to cancel
- "ADD THEME" input — text field + optional checkboxes for which movies it applies to
- Chronological timeline log below:
  - `▶ Started watching Sinners`
  - `+ Added theme "Evil Children" → Sinners, Companion`
  - `✕ Canceled theme "Evil Children"`
  - `▶ Started watching The Monkey`
- Canceled themes shown struck-through in the pills area

**End session:** "END GOBLIN DAY" button in the header area. Confirms, then shows summary.

### Past session detail
- Movie list with posters in watch order
- Surviving themes (active) as pills
- Canceled themes struck-through
- Full timeline log

## Scope Boundaries

**In scope:**
- Session CRUD (start, end, view history)
- Add movies to session from proposed or all movies
- Theme CRUD (add, cancel, tag movies)
- Timeline log (auto-generated from actions)
- Past session history + detail view

**Out of scope:**
- Real-time sync between devices (each person refreshes to see updates)
- Timer/duration tracking per movie
- Theme voting or scoring
- Editing past sessions
