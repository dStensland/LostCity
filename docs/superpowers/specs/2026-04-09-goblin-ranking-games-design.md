# Goblin Day: Ranking Games

**Date:** 2026-04-09
**Status:** Draft

## Overview

A generic ranking game system for Goblin Day that lets participants independently rank items across categories, then browse each other's rankings. First use case: Mission: Impossible franchise — rank the movies, the stunts, and the sequences.

Games are seeded by the creator (no submission UX). Each participant drags items into their preferred order with optional tier buckets, reusing the same UX pattern as the existing movie log.

## Data Model

### `goblin_ranking_games`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| name | text NOT NULL | e.g., "Mission: Impossible" |
| description | text | optional flavor text |
| image_url | text | optional hero/poster image |
| created_by | uuid FK auth.users | game creator |
| status | text NOT NULL DEFAULT 'open' | 'open' or 'closed' |
| created_at | timestamptz DEFAULT now() | |

### `goblin_ranking_categories`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| game_id | integer FK goblin_ranking_games | |
| name | text NOT NULL | e.g., "Movies", "Stunts", "Sequences" |
| description | text | optional |
| sort_order | integer NOT NULL DEFAULT 0 | display order of categories |
| created_at | timestamptz DEFAULT now() | |

### `goblin_ranking_items`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| category_id | integer FK goblin_ranking_categories | |
| name | text NOT NULL | e.g., "Burj Khalifa Climb" |
| subtitle | text | e.g., "Ghost Protocol" — which movie it's from |
| image_url | text | optional |
| created_at | timestamptz DEFAULT now() | |

### `goblin_ranking_entries`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| item_id | integer FK goblin_ranking_items | |
| user_id | uuid FK auth.users | |
| sort_order | integer NOT NULL | position (1 = top) |
| tier_name | text | optional, e.g., "Transcendent" |
| tier_color | text | optional hex color |
| created_at | timestamptz DEFAULT now() | |
| updated_at | timestamptz DEFAULT now() | |

**Unique constraint:** `(item_id, user_id)` — one ranking per user per item.

### RLS Policy

- **Read:** Any authenticated user can read all games, categories, items, and entries.
- **Write entries:** Users can only insert/update/delete their own entries (`user_id = auth.uid()`).
- **Write games/categories/items:** No client-side writes. Seeded via migration or direct SQL.

## API Routes

All under `/api/goblinday/rankings/`.

### `GET /rankings`

List all games. Returns `id`, `name`, `description`, `image_url`, `status`, `created_at`.

### `GET /rankings/[gameId]`

Game detail with nested categories and items. Returns the game object with `categories[]`, each containing `items[]`. No user-specific data.

### `GET /rankings/[gameId]/entries`

All participants' ranking entries for this game. Returns entries grouped by user (with display name and avatar from profiles). Used for browsing others' rankings.

### `GET /rankings/[gameId]/me`

Current user's ranking entries across all categories in this game.

### `POST /rankings/[gameId]/me`

Bulk upsert for a single category. Request body:

```json
{
  "category_id": 1,
  "entries": [
    { "item_id": 10, "sort_order": 1, "tier_name": "Masterpiece", "tier_color": "#00f0ff" },
    { "item_id": 11, "sort_order": 2, "tier_name": "Masterpiece", "tier_color": "#00f0ff" },
    { "item_id": 12, "sort_order": 3, "tier_name": null, "tier_color": null }
  ]
}
```

Validates that all `item_id`s belong to the given `category_id` and the category belongs to the game. Upserts on `(item_id, user_id)`. Items omitted from the array are deleted (user un-ranked them). Updates `updated_at` on every touched entry.

Rate limited at `RATE_LIMITS.write` (30/min).

## UI

### Route

`/goblinday/rankings/[gameId]`

Entry point: card/link from the main Goblin Day page, or direct URL.

### Layout

1. **Game header** — name, description, optional hero image.

2. **Category tabs** — horizontal tab bar switching between categories (e.g., "Movies" | "Stunts" | "Sequences"). Tab order follows `sort_order`.

3. **View toggle** — "My Rankings" vs "Everyone's Rankings".

4. **My Rankings view:**
   - Drag-to-reorder list, same UX as the movie log.
   - Each item shows rank number (with neon glow treatment for top positions), name, and subtitle.
   - Optional image thumbnail if `image_url` is set.
   - Tier bucket support — items grouped under tier headers with colored dividers.
   - **Unranked section** at the bottom: items the user hasn't positioned yet. Drag from here into the ranked list.
   - Auto-saves on reorder/tier change (debounced bulk upsert).

5. **Everyone's Rankings view:**
   - List of participants who have entries in this game.
   - Tap a participant to see their read-only ranked list for the current category.
   - Participant list shows name, avatar, and count of items ranked.

### Components

Reuse and extend from the existing log:

- **Drag-reorder logic** — same as `GoblinLogView.tsx` reorder handling.
- **Tier bucket rendering** — same tier header/divider pattern from log entries.
- **Rank badge styling** — same neon glow treatment (cyan top 3, magenta 4-10, muted 11+).

New components:

- `GoblinRankingGamePage` — page-level container, fetches game data + user entries.
- `GoblinRankingCategoryTabs` — tab bar for category switching.
- `GoblinRankingList` — the drag-reorder ranking list (my rankings).
- `GoblinRankingReadOnly` — read-only view of another participant's rankings.
- `GoblinRankingParticipants` — participant list for "Everyone's Rankings" view.

## Seed Data: Mission: Impossible

### Movies (7)

1. Mission: Impossible (1996)
2. Mission: Impossible 2 (2000)
3. Mission: Impossible III (2006)
4. Mission: Impossible – Ghost Protocol (2011)
5. Mission: Impossible – Rogue Nation (2015)
6. Mission: Impossible – Fallout (2018)
7. Mission: Impossible – Dead Reckoning (2023)

### Stunts (~18)

| Stunt | Movie |
|-------|-------|
| Langley ceiling hang | MI |
| Aquarium restaurant explosion | MI |
| Channel Tunnel helicopter chase | MI |
| Rock climbing free solo | MI:2 |
| Motorcycle joust | MI:2 |
| Vatican infiltration | MI:III |
| Shanghai factory swing | MI:III |
| Burj Khalifa climb | Ghost Protocol |
| Mumbai parking garage chase | Ghost Protocol |
| Plane door hang (takeoff) | Rogue Nation |
| Morocco motorcycle chase | Rogue Nation |
| Underwater Torus breach | Rogue Nation |
| HALO jump | Fallout |
| Helicopter canyon chase | Fallout |
| Paris motorcycle chase | Fallout |
| Kashmir cliff fight | Fallout |
| Motorcycle cliff jump | Dead Reckoning |
| Orient Express train roof fight | Dead Reckoning |

### Sequences (~16)

| Sequence | Movie |
|----------|-------|
| NOC list theft (embassy) | MI |
| Bible reveal / mole hunt | MI |
| Seville nightclub infiltration | MI:2 |
| Chimera lab break-in | MI:2 |
| Bridge ambush / Davian capture | MI:III |
| Shanghai rooftop run | MI:III |
| Kremlin infiltration | Ghost Protocol |
| Sandstorm pursuit | Ghost Protocol |
| Vienna opera house | Rogue Nation |
| London pursuit / glass box | Rogue Nation |
| Lane interrogation (The Syndicate reveal) | Rogue Nation |
| Belfast bathroom fight | Fallout |
| Kashmir nuclear deactivation | Fallout |
| Airport runway standoff | Dead Reckoning |
| Venice chase | Dead Reckoning |
| Rome car chase (Fiat) | Dead Reckoning |

*Lists are a starting point — easy to add/remove items before the hang.*

## Out of Scope

- Submission/nomination UX for participants (items are seeded by creator)
- Aggregate scoring / average position views (nice-to-have for later)
- Comments or discussion per item
- Multiple rankings per user per item (one position, one tier)
- Bracket/tournament mode
