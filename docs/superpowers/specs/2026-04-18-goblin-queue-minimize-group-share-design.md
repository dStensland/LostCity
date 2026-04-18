# Goblin Day — Queue Minimize, Group Focus & Share, Seen-without-logging

**Date:** 2026-04-18
**Scope:** Goblin Day personal project. Not part of the LostCity mission.

## Problem

The Goblin Day Queue page forces three frictions on the owner:

1. **Queue blocks groups.** The ranked watchlist is a long scroll. Groups render below it. To reach a group you have to scroll past the full queue every time.
2. **No group-level sharing.** Queues have a public share URL (`/goblinday/queue/[username]`), but groups don't. If the owner wants someone to see just "Sword & Sorcery," they can only link the whole queue.
3. **"Already watched elsewhere" has no clean exit.** The only `[WATCHED]` action opens a log modal (date/note/tags). For movies already logged — or not worth logging — the owner has to log-and-then-delete. A `[×]` remove exists but reads as "delete by mistake," not as a deliberate "I'm done with it."

## Goals

- Collapse the queue so groups are reachable without scrolling.
- Allow focusing the page on a single group and sharing a public URL for it.
- Give cards a one-click "seen, no log" action distinct from the log flow.

## Non-goals

- Reordering groups from focus mode.
- Editing group name/description inline.
- Reactions or comments on the public group page.
- Custom user-chosen slugs (slugs are auto-generated).
- Any change to the logging modal itself, the ranked queue card's visual layout, or the Groups data model beyond adding a slug column.

## Design

### 1. Schema

Add a slug column to `goblin_lists`:

- `slug TEXT NULL` — generated server-side from `name` (lowercased, non-alphanumerics collapsed to `-`, trimmed).
- Nullable because the auto-generated `is_recommendations = true` list has no slug and is never shareable at a group URL.
- Unique index `(user_id, slug) WHERE is_recommendations = false AND slug IS NOT NULL`.
- Collisions suffix with `-2`, `-3`, etc.
- Backfill all existing non-recommendations lists by deriving the slug from `name`, resolving collisions per-user.
- Slug is **immutable after creation**. Renaming a group updates `name` but not `slug`, so existing share links do not break.

Also add `list_id INTEGER NULL REFERENCES goblin_lists(id) ON DELETE CASCADE` to `goblin_watchlist_recommendations`. When a recommendation comes in via the group-scoped public endpoint, `list_id` is set. When the owner accepts it, the movie lands in that group directly (instead of the default Recommendations list). Existing queue-wide recommendations keep `list_id = NULL` and behave exactly as today.

Migration pair (`database/migrations/` + `supabase/migrations/`):

```sql
ALTER TABLE goblin_lists ADD COLUMN IF NOT EXISTS slug TEXT;

-- Backfill (per-user collision resolution in a procedural block)

CREATE UNIQUE INDEX IF NOT EXISTS idx_goblin_lists_user_slug
  ON goblin_lists (user_id, slug)
  WHERE is_recommendations = false AND slug IS NOT NULL;

ALTER TABLE goblin_watchlist_recommendations
  ADD COLUMN IF NOT EXISTS list_id INTEGER
    REFERENCES goblin_lists(id) ON DELETE CASCADE;
```

### 2. Auth-side API changes

- `POST /api/goblinday/me/lists` — generates `slug` from the submitted `name` before insert. Collision resolver looks up existing slugs for the user and suffixes as needed.
- `PATCH /api/goblinday/me/lists/[id]` — does **not** touch `slug` when `name` changes.
- `GET /api/goblinday/me/lists` — returns the slug in the payload so the client can build share URLs and URL-param filters.

### 3. Queue page (`GoblinWatchlistView`)

**Collapse toggle.**
- Header becomes a clickable row: `THE QUEUE · N films · ▾`.
- Collapsed state hides tag filter chips and the list; keeps SHARE / + GROUP / + ADD buttons visible so the owner can still act on the queue without expanding.
- Expanded caret flips to `▴`.
- State persisted in `localStorage` under key `goblin.queue.collapsed`. Default is **collapsed**.
- Recommendations section (if any pending) remains visible regardless of collapse state — it's an inbox, not part of the ranked queue.

**Group focus mode.**
- New state: `focusGroupSlug: string | null`. Driven by the `g` URL search param.
- When a group is focused:
  - The queue section (collapsed or expanded) is hidden.
  - Pending Recommendations are hidden.
  - Other groups are hidden.
  - A "← All groups" link renders above the focused group.
  - The focused group renders in the same `GoblinGroupSection` component, full-width.
- Entering focus: click a new focus icon in each `GoblinGroupSection` header (or a chip in a new group-selector row above the groups list — see UI note below).
- Leaving focus: click "← All groups" or clear the `g` param.
- URL writes use `window.history.replaceState` (do not trigger a full Next.js navigation through Suspense — see `web/CLAUDE.md` filter patterns).

**Group chip row** (lightweight group selector above the groups list):
- Horizontal chip row: one chip per group, shows name + count.
- Clicking a chip = enter focus mode for that group. Clicking the active chip again exits focus.
- Matches the existing tag-filter chip visual language on the queue (amber accent when active).

**Group share.**
- `GoblinGroupSection` header gains a `[SHARE]` button next to existing actions.
- Click copies `https://lostcity.ai/goblinday/queue/{username}/g/{slug}` to clipboard and shows "COPIED!" for 2s (same pattern as the existing queue SHARE button).
- The component needs `username` — pass it from `GoblinWatchlistView` (which already fetches it).

**Card `[SEEN]` action.**
- Add a new button between `[WATCHED]` and `[i]` in `GoblinWatchlistCard`'s action bar: `[SEEN]`.
- Click: calls `deleteEntry(entry.id)` — same API as the existing `[×]`. No log is created, no modal opens.
- Visual: neutral zinc text, not red. Distinct from `[×]` which stays in place but reads as "delete/cancel."
- Matching action on `GoblinGroupSection`'s movie cards — calls the existing group-remove handler with no log side-effect.
- Rationale for keeping `[×]`: hover affordance for mistaken adds stays; `[SEEN]` is the deliberate "watched, done with it" intent.

### 4. Public group page

**Route:** `web/app/goblinday/queue/[slug]/g/[groupSlug]/page.tsx` (server component — fetches data, resolves user by username, resolves group by slug+user, 404 if either miss).

**Component:** `web/components/goblin/GoblinGroupPublicView.tsx`.

**Layout** — reuses the `GoblinQueuePublicView` chrome (trunk-ring canvas background, amber laser divider, vignette) so the public group page feels like a sibling of the queue page, not a new surface.

- Header card: group name (large, amber glow), description (if present), `N films`, small "← full queue" link back to `/goblinday/queue/{username}`.
- Poster grid: same 3/4/5-column responsive grid as the public queue.
- "Recommended" section: public recommendations targeted at this group (if any), grouped by recommender name — same treatment as `GoblinQueuePublicView`.
- "Recommend a film" section: TMDB search → select → name + note → submit. Posts to a new group-scoped recommend endpoint.

**Public JSON endpoint:** `GET /api/goblinday/queue/[slug]/g/[groupSlug]`
- Returns `{ user: { username, displayName, avatarUrl }, group: { name, description, slug }, movies: [...], recommendations: [...] }`.
- 404 if user or group not found. Recommendations list is excluded (matches auth-side behavior).

**Recommend endpoint:** `POST /api/goblinday/queue/[slug]/g/[groupSlug]/recommend`
- Body: `{ tmdb_id, recommender_name, note }`.
- Resolves user by username, group by slug+user. Inserts into `goblin_watchlist_recommendations` with `list_id` set to the group's id.
- Conflict on duplicate (same recommender + same movie + same target user): 409 — reuses the existing recommender-level unique indexes (no per-group dedupe; a recommender who already sent a movie to your queue can't re-send it to a group).

**TMDB search endpoint:** `GET /api/goblinday/queue/[slug]/g/[groupSlug]/search?q=` — or reuse the existing `/api/goblinday/queue/[slug]/search`, which is already public and user-scoped. Leaning reuse to minimize surface area.

## Data flow

Owner (signed in, on `/goblinday`):
1. Lands → queue starts collapsed (from `localStorage`), groups visible below. First-visit default is also collapsed.
2. Clicks group chip → URL becomes `/goblinday?g=sword-and-sorcery` (replaceState), view enters focus mode.
3. Clicks `[SHARE]` on group header → clipboard gets `https://lostcity.ai/goblinday/queue/{username}/g/sword-and-sorcery`.
4. On a queue card, clicks `[SEEN]` → `deleteEntry(id)` → row removed optimistically, no log entry.

Friend (not signed in, opens shared link):
1. Lands on `/goblinday/queue/{username}/g/sword-and-sorcery`.
2. Server fetches user + group + movies + recommendations, renders `GoblinGroupPublicView`.
3. Optional: submits a recommendation → appears in the owner's pending-recommendations inbox on the main `/goblinday` page.

## Error & edge cases

- **Group renamed after share link sent.** Slug is immutable → old links still work. The header just shows the new name.
- **Group deleted.** Public page 404s. (Acceptable.)
- **Slug collisions on creation.** Server resolver appends `-2`, `-3`, etc. by checking existing slugs for that user.
- **Recommendations list.** `is_recommendations = true` lists have no slug and are not shareable at `/g/[slug]`. Any request matching that slug 404s.
- **Empty group.** Public page renders the empty-state copy ("// Group is empty") and still shows the recommend form.
- **Focus param for non-existent slug.** Client ignores it, strips the param, falls back to unfocused view.

## Verification

- **Collapse:** load `/goblinday` on a desktop browser → queue starts collapsed → click header → expands → refresh → still expanded (or collapsed, whichever was last state).
- **Focus mode:** click group chip → queue section disappears → URL has `?g=` → "← All groups" is visible → clicking it returns to the full view with no URL param.
- **Share copy:** click `[SHARE]` on a group → paste buffer contains the full public URL → open the URL in an incognito tab → see the group's poster grid.
- **Public recommend:** on the public group page, search a movie, submit with a name → owner sees it in Recommendations on `/goblinday`.
- **`[SEEN]` on a queue card:** card disappears optimistically → refresh → still gone → no log entry created for that movie (verify via `goblin_movie_log` SELECT).
- **`[SEEN]` on a group card:** same as above.
- **Mobile (375px):** collapse toggle is tappable; chip row scrolls horizontally; group focus mode fits.
- **TypeScript:** `npx tsc --noEmit` clean in `web/`.

## Out of scope (future, if asked)

- Reordering groups from focus mode.
- Custom group slugs (user-chosen).
- Owner-visible "pending recommendations scoped to a group" filter in the Recommendations inbox (today's inbox is flat).
- Reactions / comments on public group pages.
- Analytics on which groups get the most external views.
