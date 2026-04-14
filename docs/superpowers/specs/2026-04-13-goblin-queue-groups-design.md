# Goblin Day: Queue Groups

**Date:** 2026-04-13
**Status:** Approved

## Summary

Extend the Goblin Day queue with curated movie groups — collapsible sections that appear below the ranked queue. Each group has its own internal ordering, movies can be added manually via TMDB search or auto-seeded from a director's filmography / genre discovery. Recommendations from other users become a group with the same visual treatment.

## Motivation

The ranked queue is a priority list — "what to watch next." But there are collections of movies worth tracking that don't have a priority rank: a director's complete works, a genre deep-dive, recommendations from friends. These need a home in the queue without cluttering the ranked list.

## Data Model

### Migration: Extend `goblin_lists` and `goblin_list_movies`

**`goblin_lists` — new columns:**

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `description` | `text` | `null` | Optional flavor text ("The complete filmography") |
| `sort_order` | `integer` | `null` | Controls group ordering in the queue view |
| `is_recommendations` | `boolean` | `false` | Marks the auto-created recommendations group |

**`goblin_list_movies` — new columns:**

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `sort_order` | `integer` | `null` | Internal ordering within a group |
| `note` | `text` | `null` | Per-movie note (who recommended it, why it's here) |

No new tables. Everything builds on existing `goblin_lists`, `goblin_list_movies`, and `goblin_movies`.

### Recommendations Integration

- When user accepts a recommendation, it goes into a special "Recommendations" group (`is_recommendations = true`)
- This group is auto-created on first accepted recommendation if it doesn't exist
- The recommender's name is stored in the `note` field on `goblin_list_movies` (e.g. "Recommended by Sarah")
- Dismissing a recommendation still works as-is (status change on `goblin_watchlist_recommendations`, no group involvement)
- The existing recommendations UI block above the ranked queue is replaced by the Recommendations group section below it

## API Changes

### Enhanced Existing Routes

**`GET /api/goblinday/me/lists`**
- Returns lists with full movie objects (joined through `goblin_movies`), ordered by `sort_order`
- Each movie includes: id, tmdb_id, title, poster_path, year, director, runtime_minutes, rt_critics_score, rt_audience_score, tmdb_vote_average, mpaa_rating, imdb_id, synopsis, trailer_url
- Each movie entry includes its `sort_order` and `note` from `goblin_list_movies`

**`POST /api/goblinday/me/lists`**
- Accepts `description` field
- Auto-assigns next `sort_order`

**`PATCH /api/goblinday/me/lists/[id]`**
- Accepts `description` and `sort_order` updates

### New Routes

**`POST /api/goblinday/me/lists/[id]/movies`**
- Body: `{ tmdb_id: number, note?: string }`
- Auto-fetches/creates `goblin_movies` row from TMDB if not exists (same pattern as watchlist add)
- Assigns next `sort_order` within the group
- Returns the created movie entry

**`DELETE /api/goblinday/me/lists/[id]/movies/[movieId]`**
- Removes movie from group
- `movieId` is the `goblin_movies.id` (not tmdb_id)

**`POST /api/goblinday/me/lists/[id]/movies/[movieId]/watched`**
- Body: `{ watched_date: string, note?: string, watched_with?: string, log_tag_ids?: number[] }`
- Creates `goblin_log_entries` row + removes from group (same atomic pattern as watchlist watched)

**`POST /api/goblinday/me/lists/[id]/movies/reorder`**
- Body: `{ order: [{ movie_id: number, sort_order: number }] }`
- Reorders movies within a group

**`POST /api/goblinday/me/lists/reorder`**
- Body: `{ order: [{ id: number, sort_order: number }] }`
- Reorders groups in the queue view

**`GET /api/goblinday/tmdb/person?q={query}`**
- Searches TMDB for people (directors, actors)
- Returns: `{ results: [{ id, name, known_for_department, profile_path }] }`

**`GET /api/goblinday/tmdb/person/[id]/filmography`**
- Fetches filmography for a person from TMDB
- Returns: `{ person: { name }, movies: [{ tmdb_id, title, poster_path, year, overview }] }`
- Sorted by release date descending

**`GET /api/goblinday/tmdb/discover?genre={id}`**
- Discovers movies by genre from TMDB
- Returns same shape as filmography endpoint

### Recommendations Flow Change

**`POST /api/goblinday/me/recommendations/[id]/action` (action: "add")**
- Instead of creating a `goblin_watchlist_entries` row, adds the movie to the Recommendations group
- Auto-creates the Recommendations group if it doesn't exist
- Sets note to "Recommended by {recommender_name}"

## UI Components

### GoblinWatchlistView Changes

Layout order:
1. Header ("The Queue" + tag filters + buttons)
2. ~~Recommendations block~~ (removed — becomes a group section)
3. Ranked queue entries (unchanged)
4. Group sections (new)
5. "New Group" button at bottom (if no groups exist, this is prominent)

Header button additions:
- "+ GROUP" button alongside existing "+ ADD" and "SHARE"

### New: GoblinGroupSection

Renders a single group as a collapsible section.

**Header:**
- Group name: `font-black text-white uppercase tracking-[0.08em]`
- Movie count: `text-2xs text-zinc-600 font-mono`
- Description (if present): `text-xs text-zinc-500 italic`
- Collapse/expand chevron
- Overflow menu (edit, delete, add movie)
- Border-bottom accent matching queue amber theme

**Body (when expanded):**
- Movie cards: same `GoblinWatchlistCard` component with `hideRank` prop
- Drag-to-reorder within the group
- Each card has `[WATCHED]`, `[i]`, `[trailer]`, `[imdb]`, `[x]` actions (same as ranked queue)
- For recommendations group: cards show recommender name in metadata line

**Footer:**
- "+ Add Movie" inline button (opens TMDB search scoped to this group)

**Collapsed state:**
- Just the header line with movie count and chevron

### New: GoblinCreateGroupModal

Two-phase modal for creating a group.

**Phase 1: Group details**
- Name field (required)
- Description field (optional)
- "Seed from TMDB" toggle/section:
  - Person search: autocomplete field → pick person → see filmography
  - Genre picker: dropdown of TMDB genres
- "Create" button (if no seed) or "Next" (if seed selected)

**Phase 2: Movie selection (only if seed)**
- List of candidate movies from TMDB with checkboxes
- Poster, title, year, director for each
- "Select All" / "Deselect All"
- "Create Group" button with count of selected movies

### GoblinWatchlistCard Modifications

New optional props:
- `hideRank?: boolean` — suppresses rank number column, removes rank-based sizing
- `recommenderName?: string` — shows "from {name}" in metadata line
- `groupId?: number` — routes remove/watched actions to group-specific endpoints
- `onRemove` signature stays the same (parent passes group-aware handler)

### New: useGoblinGroups Hook

Manages group state parallel to `useGoblinWatchlist`:
- `groups: GoblinGroup[]` — all groups with movies
- `loading: boolean`
- `createGroup(data)` — create with optional seed movies
- `updateGroup(id, data)` — edit name/description
- `deleteGroup(id)` — delete group and all associations
- `addMovie(groupId, tmdbId, note?)` — add movie to group
- `removeMovie(groupId, movieId)` — remove from group
- `markWatched(groupId, movieId, logData)` — watched flow
- `reorderMovies(groupId, order)` — reorder within group
- `reorderGroups(order)` — reorder groups
- `searchPerson(query)` — TMDB person search
- `getFilmography(personId)` — TMDB filmography
- `discoverByGenre(genreId)` — TMDB genre discovery

### Type Definitions

```typescript
interface GoblinGroup {
  id: number;
  name: string;
  description: string | null;
  sort_order: number | null;
  is_recommendations: boolean;
  created_at: string;
  movies: GoblinGroupMovie[];
}

interface GoblinGroupMovie {
  movie_id: number;
  sort_order: number | null;
  note: string | null;
  added_at: string;
  movie: {
    id: number;
    tmdb_id: number | null;
    title: string;
    poster_path: string | null;
    year: number | null;
    director: string | null;
    runtime_minutes: number | null;
    rt_critics_score: number | null;
    rt_audience_score: number | null;
    tmdb_vote_average: number | null;
    mpaa_rating: string | null;
    imdb_id: string | null;
    synopsis: string | null;
    trailer_url: string | null;
  };
}
```

## What Doesn't Change

- The ranked queue stays exactly as-is (entries, ordering, tags, drag-to-reorder)
- Watchlist tags remain independent of groups
- The `[x]` remove button already handles "remove without watching"
- The `[WATCHED]` modal flow is the same
- Public queue sharing page (shows ranked queue only — groups are private for now)
- TMDB search for the ranked queue add modal

## Future Considerations (Not In Scope)

- Sharing groups publicly (like the public queue)
- Importing groups from Letterboxd or other services
- Group-level progress tracking ("4 of 12 watched")
- Moving movies between groups or from group to ranked queue
