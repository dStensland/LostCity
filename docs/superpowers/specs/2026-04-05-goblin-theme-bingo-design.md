# Goblin Day Theme Bingo Matrix

**Date:** 2026-04-05
**Status:** Approved

## Overview

Replace the flat theme tag list in the live goblin day session view with an interactive matrix (themes × movies). Any session member can check off theme-movie intersections as they spot them during viewing. Shared state — one tap checks it for everyone.

## Data Model

### `goblin_theme_movies` — repurposed

Current semantics: static pre-tagging at theme creation time (never actually worked — themes POST was broken).

New semantics: a row means "someone spotted this theme in this movie during the session."

**Migration:**

1. Truncate existing `goblin_theme_movies` rows (all created from the broken flow, meaningless).
2. Add `checked_by uuid REFERENCES auth.users(id)` — who toggled it on.
3. Add `checked_at timestamptz NOT NULL DEFAULT now()`.

### `goblin_themes` — unchanged

Themes still belong to sessions via `session_id`. Created with just a `label`. Status is `active` or `canceled`.

### `goblin_timeline` — extended event types

Add two new event types to the CHECK constraint:

- `theme_checked` — someone checked a theme-movie cell
- `theme_unchecked` — someone unchecked a theme-movie cell

Both carry `theme_id` and `movie_id`.

## API Changes

### POST `/api/goblinday/sessions/[id]/themes`

**Simplified.** Remove `movie_ids` from the request body. Just accepts `{ label: string }`. Creates the theme, logs `theme_added` timeline event. No `goblin_theme_movies` rows created at this point.

### NEW: POST `/api/goblinday/sessions/[id]/themes/[themeId]/toggle`

**Body:** `{ movie_id: number }`

**Behavior:**
- Member-only (same `isSessionMember` check as other theme routes).
- If a `goblin_theme_movies` row exists for this theme+movie, delete it (uncheck). Log `theme_unchecked`.
- If no row exists, insert one with `checked_by = user.id`. Log `theme_checked`.
- Return `{ checked: boolean }` indicating the new state.

### GET `/api/goblinday/sessions/[id]`

Extend the themes select to include `checked_by` and `checked_at`:

```
goblin_theme_movies(movie_id, checked_by, checked_at)
```

No other changes — the response shape stays the same, just with richer theme_movies data.

### PATCH `/api/goblinday/sessions/[id]/themes/[themeId]`

Unchanged. Still toggles theme status between `active` and `canceled`.

## UI: Theme Bingo Matrix

Replaces the entire "THEMES" section in `GoblinSessionView` (the active theme tag strip, canceled theme tag strip, and theme creation form with movie checkboxes).

### Layout

```
              MOVIE 1    MOVIE 2    MOVIE 3    MOVIE 4
BODY HORROR   [  ✕  ]   [     ]   [  ✕  ]   [     ]
FINAL GIRL    [     ]   [  ✕  ]   [     ]   [  ✕  ]
JUMP SCARE    [  ✕  ]   [  ✕  ]   [  ✕  ]   [     ]

              [ + ADD THEME ]
```

- **Columns** = session movies in watch order. Header shows poster thumbnail (small, ~32×48px) and abbreviated title.
- **Rows** = active themes. Label fixed on the left edge. Small ✕ button on the label to cancel the theme.
- **Cells** = tap to toggle. Unchecked: empty/dark. Checked: red ✕ or filled marker (goblin aesthetic).
- **Horizontal scroll** on mobile when movies exceed viewport width. Theme labels stay pinned left.
- **"+ ADD THEME" button** below the matrix, opens simplified form (label input only, no movie checkboxes).

### Interactions

- Tap a cell → POST to toggle endpoint → optimistic UI update (flip immediately, rollback on error).
- Tap ✕ on a theme label → confirm cancel → PATCH theme status to canceled → theme row disappears from matrix.
- Canceled themes are hidden from the matrix entirely.

### Empty states

- No themes yet: show the "+ ADD THEME" button with hint text.
- No movies yet: show just the theme labels with a note that movies will appear as columns when added.

## Timeline Integration

New timeline event rendering in `renderTimelineEntry`:

- `theme_checked`: "{USER} SPOTTED {THEME} IN {MOVIE}"
- `theme_unchecked`: "{USER} REMOVED {THEME} FROM {MOVIE}"

## What Gets Removed

- Movie checkboxes in the theme creation form (`toggleThemeMovie`, `themeMovieIds` state).
- The flat active themes tag strip.
- The canceled themes tag strip.
- The `movie_ids` field from the POST themes request body.

## What Stays Unchanged

- "ADD MOVIE" section above.
- "MOVIES WATCHED" section.
- Timeline section at bottom (just gains new event types).
- Theme creation is member-only.
- Session detail API structure.
