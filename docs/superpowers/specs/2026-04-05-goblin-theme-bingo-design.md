# Goblin Day Theme Tracking Matrix

**Date:** 2026-04-05
**Status:** Approved (revised after architecture + product design review)

## Overview

Replace the flat theme tag list in the live goblin day session view with an interactive matrix (themes × movies). Any session member can check off theme-movie intersections as they spot them during viewing. Shared state — one tap checks it for everyone.

## Data Model

### `goblin_theme_movies` — repurposed

Current semantics: static pre-tagging at theme creation time (never actually worked — themes POST was broken).

New semantics: a row means "someone spotted this theme in this movie during the session."

**Migration:**

1. `TRUNCATE goblin_theme_movies` (all rows from broken flow, meaningless).
2. Add `checked_by uuid NOT NULL REFERENCES auth.users(id)` — who toggled it on. NOT NULL because every row requires a checker.
3. Add `checked_at timestamptz NOT NULL DEFAULT now()`.

### `goblin_themes` — unchanged

Themes still belong to sessions via `session_id`. Created with just a `label`. Status is `active` or `canceled`.

### `goblin_timeline` — extended event types

Drop and recreate the CHECK constraint (auto-named `goblin_timeline_event_type_check`):

```sql
ALTER TABLE goblin_timeline DROP CONSTRAINT goblin_timeline_event_type_check;
ALTER TABLE goblin_timeline ADD CONSTRAINT goblin_timeline_event_type_check
  CHECK (event_type IN (
    'movie_started', 'movie_finished',
    'theme_added', 'theme_canceled',
    'theme_checked', 'theme_unchecked'
  ));
```

Both `theme_checked` and `theme_unchecked` carry `theme_id` and `movie_id`.

## API Changes

### POST `/api/goblinday/sessions/[id]/themes`

**Simplified.** Remove `movie_ids` from the request body. Just accepts `{ label: string }`. Creates the theme, logs `theme_added` timeline event. No `goblin_theme_movies` rows created at this point.

### NEW: POST `/api/goblinday/sessions/[id]/themes/[themeId]/toggle`

**Body:** `{ movie_id: number }`

**Behavior:**
- Member-only (same `isSessionMember` check as other theme routes).
- **Validate theme belongs to session:** confirm the `themeId` URL param actually belongs to the `sessionId` URL param. Without this, a member of session A could toggle themes in session B.
- **Race-safe toggle:** Use `INSERT ... ON CONFLICT (theme_id, movie_id) DO NOTHING`. If the insert affected 0 rows (row already existed), delete it instead (uncheck). This handles two users tapping the same cell simultaneously without a PK violation 500.
- Log `theme_checked` or `theme_unchecked` to timeline with `theme_id`, `movie_id`, and `user_id`.
- Return `{ checked: boolean }` indicating the new state.

### GET `/api/goblinday/sessions/[id]`

Two changes:

1. Extend the themes select to include `checked_by` and `checked_at`:
   ```
   goblin_theme_movies(movie_id, checked_by, checked_at)
   ```

2. **Add `checked_by` UUIDs to profile resolution.** The existing GET handler collects all user IDs from `sessionMovies.proposed_by`, `timeline.user_id`, and `members.user_id` for batch profile lookup. The `checked_by` values from `goblin_theme_movies` must be added to the `allUserIds` set so the UI has display names for who checked each cell.

### PATCH `/api/goblinday/sessions/[id]/themes/[themeId]`

Unchanged. Still toggles theme status between `active` and `canceled`. (Route already exists at `web/app/api/goblinday/sessions/[id]/themes/[themeId]/route.ts`.)

## UI: Theme Tracking Matrix

Replaces the entire "THEMES" section in `GoblinSessionView` (the active theme tag strip, canceled theme tag strip, and theme creation form with movie checkboxes).

### DOM Structure

Use a `<table>` inside a `div` with `overflow-x: auto` for horizontal scrolling:

- First `<td>` in each row: theme label cell with `position: sticky; left: 0; z-index: 10; background: zinc-950` to pin labels during horizontal scroll. Opaque background prevents bleed-through.
- Column headers: movie poster thumbnail (32×48px) + title truncated to 8–10 characters. "The Shining" → "THE SHIN…".
- Theme label max-width: ~100px with `text-overflow: ellipsis` on mobile.

### Cell Dimensions

- **Min row height: 44px.** Non-negotiable for touch targets — mis-taps during a movie are frustrating and instant-toggle has no undo confirmation.
- 8 themes × 44px = 352px matrix height. Page already scrolls vertically; don't try to fit the full matrix on screen.
- Cell width: match column header width (~70–80px per movie column).

### Cell Aesthetic

- **Checked:** filled `bg-red-900/60` with white ✕ centered. Reads clearly as "marked" at a glance across columns.
- **Unchecked:** `bg-zinc-900` with `border border-zinc-800`. No icon — empty cell.

### Theme Cancel Interaction

Cancel action uses **long-press** on the theme label (not a visible ✕ button). On mobile, a tap-target ✕ adjacent to the first scrollable column invites accidental cancels. Long-press surfaces a confirm prompt, then PATCHes the theme to `canceled` and removes the row from the matrix.

On desktop, a small ✕ appears on hover over the theme label (hover isn't available on mobile, so no conflict).

### Layout

```
              MOVIE 1    MOVIE 2    MOVIE 3    MOVIE 4
BODY HORROR   [  ✕  ]   [     ]   [  ✕  ]   [     ]
FINAL GIRL    [     ]   [  ✕  ]   [     ]   [  ✕  ]
JUMP SCARE    [  ✕  ]   [  ✕  ]   [  ✕  ]   [     ]

              [ + ADD THEME ]
```

- **Columns** = session movies in watch order.
- **Rows** = active themes. Label pinned left.
- **Horizontal scroll** on mobile when movies exceed viewport width.
- **"+ ADD THEME" button** below the matrix, opens simplified form (label input only, no movie checkboxes).

### Interactions

- Tap a cell → POST to toggle endpoint → optimistic UI update (flip immediately, rollback on error).
- Long-press theme label → confirm cancel → PATCH theme status to canceled → row disappears.
- Canceled themes hidden from matrix entirely.

### New theme feedback

On successful theme creation, auto-scroll the new row into view and briefly pulse the row background (`bg-red-900/40`, single animation cycle) to direct attention.

### Empty states

- **Movies exist, no themes yet:** Show movie column headers with an empty grid area and centered hint text "ADD A THEME TO START TRACKING" above the + ADD THEME button.
- **Themes exist, no movies yet:** Show theme labels with a note that movie columns appear when movies are added to the session.

## Sync Strategy

The current session view uses manual `onRefresh` (full refetch). The matrix makes staleness more visible — User A checks a cell, User B doesn't see it until refresh.

**V1: 15-second polling.** When the session is `live`, poll `GET /api/goblinday/sessions/[id]` every 15 seconds. This is cheap (the endpoint is already optimized, small payload for a friends-sized session) and makes the matrix feel shared without adding real-time infrastructure.

**Future:** Supabase Realtime subscription on `goblin_theme_movies` changes for the session's theme IDs. Not in scope for v1.

## Timeline Integration

New timeline event rendering in `renderTimelineEntry`:

- `theme_checked`: "{USER} SPOTTED {THEME} IN {MOVIE}"
- `theme_unchecked`: "{USER} REMOVED {THEME} FROM {MOVIE}"

**Visual weight:** Render check/uncheck events at `text-zinc-600` (quieter than the default `text-zinc-400`) so movie/session milestone events remain visually dominant. With 5 themes × 4 movies, toggle events can outnumber milestone events — they shouldn't drown them out.

## What Gets Removed

- Movie checkboxes in the theme creation form (`toggleThemeMovie`, `themeMovieIds` state).
- The flat active themes tag strip.
- The canceled themes tag strip.
- The `movie_ids` field from the POST themes request body.

## What Stays Unchanged

- "ADD MOVIE" section above.
- "MOVIES WATCHED" section.
- Timeline section at bottom (just gains new event types + quieter styling for toggles).
- Theme creation is member-only, toggling is member-only.
- Session detail API structure.
