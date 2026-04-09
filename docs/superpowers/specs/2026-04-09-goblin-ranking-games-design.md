# Goblin Day: Ranking Games

**Date:** 2026-04-09
**Status:** Draft (v2 — updated after architecture, product, and strategy review)

## Overview

A generic ranking game system for Goblin Day that lets participants independently rank items across categories, then browse and compare each other's rankings. First use case: Mission: Impossible franchise — rank the movies, the stunts, and the sequences.

Games are seeded by the creator (no submission UX). Each participant drags items into their preferred order with optional tier buckets, reusing the same UX pattern as the existing movie log. The social payoff comes from comparison — seeing where you agree and disagree with friends, with an aggregate "Group Rankings" view as the centerpiece.

## Data Model

### `goblin_ranking_games`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| name | text NOT NULL | e.g., "Mission: Impossible" |
| description | text | optional flavor text |
| image_url | text | optional hero/poster image |
| status | text NOT NULL DEFAULT 'open' | CHECK (status IN ('open', 'closed')) |
| created_at | timestamptz DEFAULT now() | |

No `created_by` — games are seeded via migration, not created through the UI.

### `goblin_ranking_categories`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| game_id | integer FK goblin_ranking_games ON DELETE CASCADE | |
| name | text NOT NULL | e.g., "Movies", "Stunts", "Sequences" |
| description | text | optional |
| sort_order | integer NOT NULL DEFAULT 0 | display order of categories |
| created_at | timestamptz DEFAULT now() | |

### `goblin_ranking_items`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| category_id | integer FK goblin_ranking_categories ON DELETE CASCADE | |
| name | text NOT NULL | e.g., "Burj Khalifa Climb" |
| subtitle | text | e.g., "Ghost Protocol" — which movie it's from |
| image_url | text | optional |
| created_at | timestamptz DEFAULT now() | |

### `goblin_ranking_entries`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| item_id | integer FK goblin_ranking_items ON DELETE CASCADE | |
| user_id | uuid FK auth.users ON DELETE CASCADE | |
| sort_order | integer NOT NULL | position (1 = top) |
| tier_name | text | optional, e.g., "Transcendent" |
| tier_color | text | optional hex color |
| created_at | timestamptz DEFAULT now() | |
| updated_at | timestamptz DEFAULT now() | |

**Unique constraint:** `(item_id, user_id)` — one ranking per user per item.

### Indexes

- `idx_ranking_entries_user_item` on `goblin_ranking_entries(user_id, item_id)` — user-first lookups for "my rankings"
- `idx_ranking_categories_game_order` on `goblin_ranking_categories(game_id, sort_order)` — category ordering
- `idx_ranking_items_category` on `goblin_ranking_items(category_id)` — item lookups by category

### RLS Policies

Reference tables (games, categories, items) — authenticated read-only:

```sql
CREATE POLICY "read_games" ON goblin_ranking_games FOR SELECT USING (true);
CREATE POLICY "read_categories" ON goblin_ranking_categories FOR SELECT USING (true);
CREATE POLICY "read_items" ON goblin_ranking_items FOR SELECT USING (true);
-- No INSERT/UPDATE/DELETE policies — seeded via service client only
```

Entry table — owner writes, public reads:

```sql
CREATE POLICY "read_all_entries" ON goblin_ranking_entries
  FOR SELECT USING (true);
CREATE POLICY "manage_own_entries" ON goblin_ranking_entries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

Two policies per table, matching the movie log pattern.

## API Routes

All under `/api/goblinday/rankings/`.

### `GET /rankings`

List all games. Returns `id`, `name`, `description`, `image_url`, `status`, `created_at`.

### `GET /rankings/[gameId]`

Game detail with nested categories and items. Returns the game object with `categories[]`, each containing `items[]`. No user-specific data.

### `GET /rankings/[gameId]/entries`

All participants' ranking entries for this game, returned as a user-grouped structure:

```json
{
  "participants": [
    {
      "user_id": "...",
      "display_name": "Daniel",
      "avatar_url": "...",
      "items_ranked": 34,
      "entries": [
        { "item_id": 10, "sort_order": 1, "tier_name": "Masterpiece", "tier_color": "#00f0ff" }
      ]
    }
  ]
}
```

Grouped by user in the API layer (not flat entries). Profile data joined from user profiles. Includes users who have ranked at least one item.

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

**Validation:**
- All `item_id`s must belong to the given `category_id`, and the category must belong to the game.
- **Game must be open.** If `status = 'closed'`, reject with 403.

**Delete scope:** Items omitted from the array **for this category only** are deleted. Entries in other categories are untouched. This prevents race conditions when auto-saving across rapid tab switches.

**Upserts** on `(item_id, user_id)`. Updates `updated_at` on every touched entry.

Rate limited at `RATE_LIMITS.write` (30/min).

## UI

### Route

`/goblinday/rankings/[gameId]`

Entry point: card/link from the main Goblin Day page, or direct URL share.

### Landing / First Visit

When a user first opens the game (no entries yet):

- Game header with name, description, hero image.
- Category tabs default to the first category.
- The ranked list is empty with a prompt: **"Drag items up to rank them, or tap a number to place them."**
- All items appear in the **Unranked** section below, visually dimmed (no rank badge, lower opacity). These are the pool to draw from.

The prompt and visual distinction between ranked/unranked make the mechanic self-evident without a tutorial.

### Layout

1. **Game header** — name, description, optional hero image.

2. **Category tabs** — horizontal tab bar switching between categories (e.g., "Movies" | "Stunts" | "Sequences"). Tab order follows `sort_order`. Max 4 visible tabs (overflow scrolls). Tab labels should be 1-2 words. Switching tabs preserves scroll position per tab.

3. **View toggle** — three views: "My Rankings" | "Compare" | "Group Rankings".

4. **Save indicator** — subtle "Saving..." / "Saved" at the top of the list during auto-save. Silent on success after initial indicator, visible on error with retry.

### My Rankings View

- Drag-to-reorder list, same UX as the movie log.
- Each item shows rank number (with neon glow treatment for top positions), name, and subtitle.
- Optional image thumbnail if `image_url` is set. Items without images get a category-tinted placeholder.
- Tier bucket support — items grouped under tier headers with colored dividers.
- **Unranked section** at the bottom: items the user hasn't positioned yet, visually dimmed. Drag from here into the ranked list.
- **Un-rank action**: each ranked item has a small remove button (X) to send it back to unranked. Dragging back to the unranked section also works.
- Auto-saves on reorder/tier change (debounced bulk upsert).

**Mobile mechanics:**
- **Tap rank number** to type a target position (jump to #3) — primary mobile ranking mechanic, already exists in log entry cards.
- **Long-press to drag** on mobile (not always-draggable) so taps on card content remain tappable.
- **Remove button** for un-ranking (more reliable than drag-back on mobile).

### Compare View

The social core of the feature. Two modes:

**Person comparison:** Select a participant from a dropdown/list. Their ranked list is shown for the current category with your rank displayed alongside each item:

```
Sarah's #1:  Burj Khalifa Climb (Ghost Protocol)     You: #7  [-6]
Sarah's #2:  HALO Jump (Fallout)                      You: #1  [+1]
Sarah's #3:  Helicopter Canyon (Fallout)               You: #3  [=]
```

Disagreements (delta > 3 positions) are visually highlighted. Agreements (same position or within 1) get a subtle match indicator.

Items the other person ranked but you haven't are shown as "Unranked by you." Items you ranked but they haven't are omitted from this view (it's their list).

**Participant list** shows all users with entries, their avatar, name, and items ranked count. Users who haven't started ranking anything are shown as "Hasn't ranked yet" — creates gentle peer pressure.

### Group Rankings View

Aggregate view across all participants for the current category. Each item shows:

- **Average position** across all participants who ranked it
- **Spread** — highest and lowest rank given (e.g., "Avg #3 — range #1–#7")
- **Your rank** alongside for quick comparison

Sorted by average position (best first). Items where participants disagree most (highest spread) get a visual "contested" indicator — these are the debate starters.

This view is always available but becomes the primary view when the game is closed.

### Game States

**Open:** All views available. My Rankings is editable. Compare and Group Rankings update as people rank.

**Closed:** My Rankings becomes read-only. The page defaults to Group Rankings as the landing view. Compare view still works. A "Final Results" header replaces the game description. This is the reveal moment — the host closes the game and everyone sees the group consensus (and controversies) together.

### Components

Reuse and extend from the existing log:

- **Drag-reorder logic** — same as `GoblinLogView.tsx` reorder handling.
- **Tier bucket rendering** — same tier header/divider pattern from log entries.
- **Rank badge styling** — same neon glow treatment (cyan top 3, magenta 4-10, muted 11+).

New components:

- `GoblinRankingGamePage` — page-level container, fetches game data + user entries.
- `GoblinRankingCategoryTabs` — tab bar for category switching.
- `GoblinRankingList` — the drag-reorder ranking list (my rankings).
- `GoblinRankingCompare` — side-by-side comparison of your rankings vs another participant.
- `GoblinRankingGroup` — aggregate group rankings with average positions and spread.
- `GoblinRankingParticipants` — participant picker for compare view.

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
- Comments or discussion per item
- Multiple rankings per user per item (one position, one tier)
- Bracket/tournament mode
