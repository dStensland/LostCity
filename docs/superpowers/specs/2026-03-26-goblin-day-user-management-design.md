# Goblin Day User Management Design

**Date:** 2026-03-26
**Status:** Approved
**Scope:** Add per-user auth, personal lists, and collaborative sessions to Goblin Day

## Context

Goblin Day is a horror movie tracker at `goblinday.com` (vanity domain serving `lostcity.ai/goblinday`). Currently fully anonymous — no auth, public RLS, hardcoded `daniel_list`/`ashley_list` booleans, one global session at a time.

This spec adds user ownership so a small friend group can have their own goblin days, personal rec lists, and collaborative planning/watching sessions.

## Design Decisions

- **Small friend group, not public platform.** No abuse prevention, no privacy controls, no complex permissions. Invite links, simple roles.
- **Shared movie pool.** One global set of horror movies everyone browses. Anyone can add movies. Personal rec lists are bookmarks/flags on the shared pool, not isolated libraries.
- **Planning → Live → Ended session lifecycle.** Two-phase sessions: planning phase for proposing movies collaboratively, live phase for the actual watch session (adding to watch order, themes, timeline).
- **Invite link to join.** Host creates a goblin day, gets a link like `goblinday.com/s/abc123`. No friend list management needed.
- **Personal rec lists: bookmarks + named lists.** Default bookmark flag ("want to watch") plus user-created named lists ("Body Horror Bangers"). Named lists are organizational, not functional — proposing for a session pulls from any source.
- **Auth via existing LostCity Supabase accounts.** Same auth system, same credentials. Login required for mutations; browsing the movie pool stays public.
- **Migration:** Existing movies stay global. Daniel's `proposed`/`watched` flags migrate to his account. `daniel_list`/`ashley_list` columns migrated to respective accounts when they sign up (or Daniel's account for now). Past sessions stay as anonymous archive.

## Database Schema Changes

### New Tables

#### `goblin_user_movies`
Per-user movie state. Replaces global `proposed`/`watched` booleans and `daniel_list`/`ashley_list`.

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| user_id | uuid | FK profiles, NOT NULL | Owner |
| movie_id | integer | FK goblin_movies, NOT NULL | Movie reference |
| bookmarked | boolean | DEFAULT false | Personal "want to watch" flag |
| watched | boolean | DEFAULT false | Personal watched flag |
| created_at | timestamptz | DEFAULT now() | When first interaction |
| PRIMARY KEY | | (user_id, movie_id) | Composite key |

RLS: Users can read/write their own rows only.

#### `goblin_lists`
Named custom lists per user.

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| id | serial | PK | List identifier |
| user_id | uuid | FK profiles, NOT NULL | Owner |
| name | text | NOT NULL | List name ("Body Horror Bangers") |
| created_at | timestamptz | DEFAULT now() | Creation time |

RLS: Users can read/write their own lists. Session members can read lists of other members (for proposal context).

#### `goblin_list_movies`
Join table for named lists.

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| list_id | integer | FK goblin_lists, NOT NULL | List reference |
| movie_id | integer | FK goblin_movies, NOT NULL | Movie reference |
| added_at | timestamptz | DEFAULT now() | When added |
| PRIMARY KEY | | (list_id, movie_id) | Composite key |

RLS: Inherits from parent list.

#### `goblin_session_members`
Tracks who is in a session.

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| id | serial | PK | Member record |
| session_id | integer | FK goblin_sessions, NOT NULL | Session reference |
| user_id | uuid | FK profiles, NOT NULL | Member |
| role | text | NOT NULL, CHECK ('host', 'member') | Permission level |
| joined_at | timestamptz | DEFAULT now() | When joined |
| UNIQUE | | (session_id, user_id) | One membership per session |

RLS: Members can read their session's members. Insert allowed for joining via valid invite code.

### Modified Tables

#### `goblin_sessions` — add columns

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| created_by | uuid | FK profiles | Session creator |
| invite_code | text | UNIQUE, NOT NULL | Short code for join links |
| status | text | CHECK ('planning', 'live', 'ended'), DEFAULT 'planning' | Replaces `is_active` |

- Drop `is_active` column (replaced by `status`).
- `invite_code` generated server-side (8-char alphanumeric).

#### `goblin_session_movies` — add column

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| proposed_by | uuid | FK profiles | Who proposed this movie |

#### `goblin_movies` — drop columns

Remove after migration:
- `proposed` (moved to `goblin_user_movies.bookmarked`)
- `watched` (moved to `goblin_user_movies.watched`)
- `daniel_list` (moved to `goblin_user_movies.bookmarked` for Daniel's account)
- `ashley_list` (moved to `goblin_user_movies.bookmarked` for Ashley's account)

#### `goblin_timeline` — add column

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| user_id | uuid | FK profiles | Who triggered the event |

### Data Migration

1. Create new tables and add new columns to existing tables.
2. Find or create Daniel's user account. Insert `goblin_user_movies` rows for all movies where `proposed=true` or `watched=true` or `daniel_list=true`.
3. Leave `ashley_list` data as a separate migration step (run when Ashley creates an account, or migrate to Daniel's for now).
4. Backfill `goblin_sessions.status`: `is_active=true` → `'live'`, `is_active=false` → `'ended'`.
5. Generate `invite_code` for existing sessions (they're ended, so codes won't be used, but column is NOT NULL).
6. Drop old columns from `goblin_movies` and `goblin_sessions`.

## API Design

### New Routes

#### `GET /api/goblinday/me`
Returns current user's goblin profile: bookmarked/watched movie IDs, lists.
- Auth: required
- Response: `{ bookmarks: number[], watched: number[], lists: [{ id, name, movie_ids }] }`

#### `POST /api/goblinday/me/bookmarks`
Toggle bookmark or watched status on a movie.
- Auth: required
- Body: `{ movie_id: number, field: "bookmarked" | "watched", value: boolean }`
- Upserts into `goblin_user_movies`.

#### `GET /api/goblinday/me/lists`
List user's named lists with movie IDs.
- Auth: required

#### `POST /api/goblinday/me/lists`
Create a named list.
- Auth: required
- Body: `{ name: string, movie_ids?: number[] }`

#### `PATCH /api/goblinday/me/lists/[id]`
Rename a list or update its movies.
- Auth: required
- Body: `{ name?: string, movie_ids?: number[] }`

#### `DELETE /api/goblinday/me/lists/[id]`
Delete a named list.
- Auth: required

#### `GET /api/goblinday/sessions/join/[code]`
Resolve invite code to session info.
- Auth: not required (shows session name/date/member count for join page)
- Response: `{ session_id, name, date, status, member_count, is_member: boolean }`

#### `POST /api/goblinday/sessions/join/[code]`
Join a session via invite code.
- Auth: required
- Inserts into `goblin_session_members` with role='member'.
- Only works for planning or live sessions.

#### `POST /api/goblinday/sessions/[id]/propose`
Propose a movie for a planning-phase session.
- Auth: required, must be session member
- Body: `{ movie_id: number }`
- Inserts into `goblin_session_movies` with `proposed_by`.
- Only works when session status='planning'.
- Records timeline event `movie_proposed`.

### Modified Routes

#### `POST /api/goblinday/sessions`
- Auth: required
- Body: `{ name?: string, date?: string }`
- Creates session with `status='planning'`, generates `invite_code`, sets `created_by`.
- Auto-inserts creator into `goblin_session_members` with role='host'.
- Multiple planning/live sessions allowed now (remove single-active constraint).

#### `PATCH /api/goblinday/sessions/[id]`
- Auth: required, must be host
- Body: `{ status?: "live" | "ended", name?: string }`
- Status transitions: planning→live, live→ended. No backwards transitions.

#### `POST /api/goblinday/sessions/[id]/movies`
- Auth: required, must be session member
- Only works when session status='live'.
- Records `proposed_by` on the join record.
- Adds timeline event with `user_id`.

#### `POST /api/goblinday/sessions/[id]/themes`
- Auth: required, must be session member
- Only works when session status='live'.
- Adds timeline event with `user_id`.

#### `GET /api/goblinday/sessions`
- Auth: required
- Scoped to sessions where user is a member.
- Returns member list with each session.

#### `GET /api/goblinday/sessions/[id]`
- Auth: required, must be session member
- Includes `members` array with user display names/avatars.
- Includes `proposed_by` user info on each session movie.

#### `GET /api/goblinday`
- Auth: optional
- Movie pool stays public.
- When authenticated: joins `goblin_user_movies` to include `bookmarked`/`watched` state per movie.

#### `DELETE /api/goblinday/sessions/[id]`
- Auth: required, must be host.

### Dropped Functionality

- `PATCH /api/goblinday/[id]` — the `proposed`/`watched` toggle on movies. Replaced by `/api/goblinday/me/bookmarks`.
- Global `proposed`/`watched` fields on movies. All per-user now.

## Middleware Changes

The vanity domain middleware currently rewrites ALL paths under `goblinday.com` to `/goblinday/*`. This breaks API routes and auth pages.

**Fix:** Exclude these path prefixes from the vanity rewrite:
- `/api/*` — API routes must resolve to their real paths
- `/auth/*` — auth callback pages
- `/_next/*` — Next.js internals (already excluded by matcher, but defensive)

```typescript
if (vanityPath) {
  const url = request.nextUrl.clone();
  // Don't rewrite API, auth, or Next.js internal paths
  if (url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/auth/") ||
      url.pathname.startsWith("/_next/")) {
    return NextResponse.next();
  }
  // Rewrite everything else under the vanity path
  // ...
}
```

## Auth Integration

- Add `goblinday.com` and `www.goblinday.com` to Supabase Auth → URL Configuration → Redirect URLs.
- Users log in on `goblinday.com` — Supabase sets cookies for that domain. Separate session from `lostcity.ai` (same credentials, different cookies).
- Profile auto-creation works via existing database trigger + API fallback.

## UI Changes

### Login Bar
Minimal auth strip at top of page, matching the horror aesthetic:
- **Logged out:** "SIGN IN" button → opens login modal or redirects to `/auth/login`
- **Logged in:** User avatar/name + "SIGN OUT" button
- Positioned in the header area, doesn't disrupt the matrix rain / marquee.

### "My List" Tab
New tab replacing the implicit daniel/ashley list concept:
- **Bookmarks section:** Grid of bookmarked movies (your "want to watch" pile)
- **Named lists:** Collapsible sections, each showing its movies. "Create List" button.
- **Watched section:** All movies you've marked watched.
- Empty state for new users: "Bookmark movies from the Contenders tab to build your list."

### Planning View
New session state between "no active session" and "live session":
- **Header:** Session name, date, member count, invite link with "Copy" button.
- **Proposals grid:** All proposed movies with "Proposed by [name]" attribution. Members can propose from the shared pool or their lists.
- **"Propose Movie" action** on movie cards (replaces "PROPOSE" toggle in session context).
- **Member strip:** Avatars of joined members.
- **"Start Goblin Day" button** (host only) → transitions to live.

### Join Page (`goblinday.com/s/[code]`)
- Shows session name, date, host name, member count.
- "Join Goblin Day" button → login prompt if needed → auto-join → redirect to session.
- If already a member, redirect straight to the session.

### Attribution
- Timeline events show who did what: "DANIEL started watching The Thing"
- Proposed movies show "Proposed by [name]"
- Session history shows member list.

### Movie Card Changes
- Replace global "PROPOSE" / "WATCHED" toggles with per-user actions.
- "PROPOSE" only appears in planning-phase session context.
- Bookmark icon (persistent, outside session context) for adding to personal list.
- "WATCHED" toggle becomes per-user.

## Pages & Routing

| Path | Purpose |
|------|---------|
| `goblinday.com/` | Main page (movie pool, tabs, sessions) |
| `goblinday.com/s/[code]` | Join page for invite links |
| `goblinday.com/auth/login` | Login page (passthrough to existing auth) |
| `goblinday.com/auth/callback` | OAuth callback |

The `/s/[code]` route needs a new Next.js page at `web/app/goblinday/s/[code]/page.tsx`. The middleware rewrites `goblinday.com/s/abc123` → `/goblinday/s/abc123`.

## Out of Scope

- Cross-domain SSO between `lostcity.ai` and `goblinday.com` (users log in separately, same credentials)
- Voting/ranking on proposals (all proposals are equal)
- Real-time updates via Supabase subscriptions (polling or manual refresh is fine for a small group)
- Movie recommendations / algorithmic suggestions
- Chat or messaging within sessions
- Notifications (email, push) for session invites
