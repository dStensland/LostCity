# Social Coordination Consolidation — Design Spec

**Date:** 2026-04-18
**Status:** Design locked, pending implementation plan
**Owner:** coach (Daniel Stensland)

---

## Problem

LostCity's codebase has accrued four overlapping systems for the same underlying concept (plan / commit to / show up at a place or event):

| System | Table(s) | State | Shipped? |
|---|---|---|---|
| **Hangs** | `hangs` (migration 294) + expansion migrations | Built; `HangButton` + `PlaceHangStripLive` orphaned (never wired) | No — `ENABLE_HANGS_V1=false` in prod |
| **Itineraries** | `itineraries`, `itinerary_participants`, `itinerary_participant_stops`, `itinerary_items` | Built; migration 361 declared it the successor to dormant `plans` table but consolidation never finished | Partial — some UI exists |
| **Plans (dormant)** | `plans`, `plan_notifications` (migrations 367, 489) | Built; migration 361 comment: *"separate `plans` tables remain untouched (dormant, zero UI references)"* | No |
| **Event RSVPs** | `event_rsvps` | Built and actively used — the real commitment primitive today | Yes |

A new `/plans` agenda surface is actively being built in `docs/superpowers/plans/2026-04-15-my-plans.md` (Task 1 of 16 complete) that references none of the above three social systems. Without consolidation, this creates a fifth parallel system.

**Root cause:** Each new "social coordination" feature got its own table, API, UI, and naming scheme. No unifying model was ever imposed. The result is five hooks (`useHangs`, `useItinerary`, `useItineraryCrew`, `useFriendPlans`, `usePlans`), 21 API routes referencing `event_rsvps`, and three noun-level identity crises (plan vs hang vs itinerary).

## Strategic framing

The consolidation is justified by a product thesis established during brainstorming:

> **A coherent coordination layer is the "substance that earns the friend invite."**

Hangs-as-its-own-feature fails because presence ("where are my friends now") is a commoditized 2026 primitive (Find My, Snap Map, Life360). The defensible wedge is *"I am committing to a piece of Atlanta-discovery content and inviting friends."* That ties the social layer tightly to LostCity's data infrastructure — the thing nobody else has.

Four fragments pretending to be features is not substance. One coherent object is.

## Scope

**In scope** (Approach 1, Option B per brainstorming):

- Unify `hangs`, `itineraries`, dormant `plans`, and `event_rsvps` into a single `plans` table + `plan_invitees` table
- Replace all five legacy hooks with a single `useUserPlans.ts` module
- **Delete and rewrite the 7 existing `/api/plans/*` route files** (they query soon-to-be-dropped tables) — see Phase 1 deliverable list
- **Delete the entire `web/app/api/hangs/` directory** (5 route files depending on dropped `hangs` table)
- **Rewrite `web/app/plans/page.tsx` and `web/app/plans/[id]/page.tsx`** atomically with migration 617 — they currently query old tables
- Retarget the in-flight `/plans` agenda surface onto the new data model (my-plans spec Task 1 data migration kept; all code that queries old tables rewritten)
- Wire the previously orphaned `PlaceHangStripLive` and `HangButton` (rebranded) onto place detail and event detail
- Build the "invite via shared link" activation loop (`/plans/shared/:token`)

**Out of scope** (flagged for follow-up):

- Multi-stop plans (`plan_stops` table — SQL draft committed, not applied)
- Plan voting / suggestion flow
- Chat on plan detail
- `saved_items.venue_id → place_id` rename (pre-existing data-debt)
- Goblin separation from LostCity tree
- `RegularHangsSection` name-collision rename

## Decisions locked during brainstorming

| # | Decision | Choice | Rationale |
|---|---|---|---|
| Q1 | Consolidation scope | B — refactor + finish the social coordination product | Half-measure (A-only) leaves fragmentation; narrow-only (C) is planning-as-progress |
| Q2 | Unit of a "plan" | A — every plan anchors to LostCity content (event/place/series); no free-form day-one | Free-form plans compete with iMessage; anchored plans tie the social layer to the discovery wedge |
| Q3 | Is a solo RSVP a plan? | A — yes, every `going` RSVP IS a plan | Unifies three concepts into one object; RSVPs, Hangs, and Plans become states of the same thing |
| Q4a | Migration posture re. live data | No meaningful live data in hangs/itineraries/dormant-plans; event_rsvps has real data but beta — don't preserve | Beta-stage allows clean rebuild |
| Q4b | In-flight my-plans spec | Pause + retarget onto unified model; keep Task 1 | Agenda UI is valuable regardless of data source |
| — | Architecture approach | Approach 1 — new `plans` table, clean slate | No legacy data to preserve; earned the right shape |
| A | Portal attribution pattern | Explicit from API caller, NOT NULL column, no trigger | Matches migration 604 precedent; triggers over polymorphic FKs are awkward |
| B | Status machine | Add `expired` as distinct terminal state (separate from `ended` and `cancelled`) | Preserves flake-rate analytics; can't retrofit distinctions you didn't record |
| C | `event_rsvps` table removal | Option 1 — expand-contract with read-compat view | 21 consumer files; atomic rewrite is P0-risk; compat view is temporary scaffolding with scheduled removal |
| — | `saved_items` migration | Skip — drop all event_rsvps rows including `interested` (beta) | User explicitly confirmed no data preservation |
| 1 | Post-RSVP invite flow | B — optional post-action nudge ("Going with anyone? Invite friends.") | Avoids friction for solo-going 70% case; catches intent without blocking |
| 2 | "New Plan" top-level entry | II — `+` button on `/plans` tab opens anchor picker | Supports "I want to plan with Sarah Friday" mental model while respecting anchor rule |
| — | `/api/rsvp` long-term fate | I — deprecate + remove in cleanup PR | Permanent alias preserves the mental model we're retiring |

---

## Section 1: Data Model

### Table `plans`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` | |
| `creator_id` | uuid | NOT NULL, FK → `profiles(id)`, ON DELETE CASCADE | |
| `portal_id` | uuid | NOT NULL, FK → `portals(id)` | Passed explicitly by API caller; validated against anchor's portal_id |
| `anchor_event_id` | int | FK → `events(id)` ON DELETE SET NULL, nullable | |
| `anchor_place_id` | int | FK → `places(id)` ON DELETE SET NULL, nullable | |
| `anchor_series_id` | uuid | FK → `series(id)` ON DELETE SET NULL, nullable | |
| `anchor_type` | text | `GENERATED ALWAYS AS` derived from which anchor FK is non-null; values: `'event'`, `'place'`, `'series'` | Stored column (generated), NOT NULL |
| `status` | text | NOT NULL, CHECK IN (`'planning'`, `'active'`, `'ended'`, `'expired'`, `'cancelled'`), default `'planning'` | |
| `starts_at` | timestamptz | NOT NULL | When the plan is scheduled to happen |
| `started_at` | timestamptz | nullable | Set when status transitions to `'active'` |
| `ended_at` | timestamptz | nullable | Set when status transitions to `'ended'` |
| `cancelled_at` | timestamptz | nullable | Set when status transitions to `'cancelled'` |
| `visibility` | text | NOT NULL, CHECK IN (`'private'`, `'friends'`, `'public'`), default `'friends'` | |
| `title` | text | nullable, max 140 chars | Defaults to anchor name in UI; user can override for group plans ("Kristen's birthday") |
| `note` | text | nullable, max 280 chars | Free-text description |
| `share_token` | text | UNIQUE, NOT NULL, default `encode(gen_random_bytes(12), 'hex')` | Shareable link key |
| `updated_by` | uuid | nullable, FK → `profiles(id)` | Audit trail for status transitions |
| `created_at` | timestamptz | NOT NULL, default `now()` | |
| `updated_at` | timestamptz | NOT NULL, default `now()` | Updated via trigger on row update |

**Additional table constraints:**

- **Partial unique CHECK:** exactly one of `anchor_event_id`, `anchor_place_id`, `anchor_series_id` must be non-null.
- **Portal immutability:** trigger enforces `portal_id` cannot change after insert (P0 leakage prevention).
- **Status transition CHECK:** allowed transitions only: `planning → active | cancelled`, `active → ended | expired`, `planning → expired` (timed out without start), no transitions from terminal states. Enforced at API layer; `CHECK` constraint validates current value only.
- **Invitee lifecycle on terminal transitions:** `plan_invitees` rows are NEVER deleted on `cancelled`/`ended`/`expired` transitions. History is preserved so analytics (flake rate, "how'd it go?" nudges, user plan history) stay queryable. Only `CASCADE` delete (plan or profile physically deleted) removes invitee rows.

### Table `plan_invitees`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `plan_id` | uuid | PK (part), FK → `plans(id)` ON DELETE CASCADE | |
| `user_id` | uuid | PK (part), FK → `profiles(id)` ON DELETE CASCADE | |
| `rsvp_status` | text | NOT NULL, CHECK IN (`'invited'`, `'going'`, `'maybe'`, `'declined'`), default `'invited'` | |
| `invited_by` | uuid | nullable, FK → `profiles(id)` | NULL for creator row (self-invite) |
| `invited_at` | timestamptz | NOT NULL, default `now()` | |
| `responded_at` | timestamptz | nullable | Set when user responds (any non-`invited` status) |
| `seen_at` | timestamptz | nullable | Set when user first views the invite (tracked via explicit API call) |

**Convention: creator is a row.** When a plan is created, the API inserts both the `plans` row AND a `plan_invitees` row for the creator with `rsvp_status='going'` and `invited_by=user_id` (self). Solo plan = one invitee row. This makes attendance queries uniform (no `UNION` with creator_id or `OR creator_id = auth.uid()`).

`plans.creator_id` is kept as a denormalized field for authorization/ownership checks only.

### Indexes

**On `plans`:**
- `(creator_id, status, starts_at DESC)` — "my plans" list queries
- `(anchor_event_id) WHERE anchor_event_id IS NOT NULL` — partial, for "plans for this event" aggregates on event cards
- `(anchor_place_id) WHERE anchor_place_id IS NOT NULL` — partial, for place detail + cards
- `(anchor_series_id) WHERE anchor_series_id IS NOT NULL` — partial
- `(portal_id, status, starts_at)` — portal-scoped active-plans queries
- `(share_token)` — covered by UNIQUE constraint

**On `plan_invitees`:**
- `(user_id, rsvp_status)` — "plans I'm going to" queries
- `(plan_id)` — covered by PK

### RLS policies

**On `plans`:**

```
SELECT USING (
  creator_id = auth.uid()
  OR EXISTS (SELECT 1 FROM plan_invitees WHERE plan_id = plans.id AND user_id = auth.uid())
  OR (visibility = 'public')
  OR (visibility = 'friends' AND are_friends(auth.uid(), creator_id))
)
INSERT WITH CHECK (creator_id = auth.uid())
UPDATE USING (creator_id = auth.uid())
DELETE USING (creator_id = auth.uid())
```

Uses the canonical `are_friends(user_a, user_b)` function from migration 011, which already handles blocked-user exclusion (migration 341 comment: *"without this, are_friends() returns true for blocked users, leaking hangs"* — that fix applies here too).

**On `plan_invitees`:**

```
SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM plans WHERE id = plan_invitees.plan_id AND creator_id = auth.uid())
  OR EXISTS (SELECT 1 FROM plan_invitees pi2 WHERE pi2.plan_id = plan_invitees.plan_id AND pi2.user_id = auth.uid())
)
INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM plans WHERE id = plan_invitees.plan_id AND creator_id = auth.uid())
)
UPDATE USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM plans WHERE id = plan_invitees.plan_id AND creator_id = auth.uid())
)
DELETE USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM plans WHERE id = plan_invitees.plan_id AND creator_id = auth.uid())
)
```

API routes use `createServiceClient` which bypasses RLS; policies are belt-and-suspenders against any stray direct-client access.

### Triggers

1. **`updated_at` auto-update** — standard pattern on `plans`.
2. **`portal_id` immutability** — BEFORE UPDATE on `plans`: raise exception if `NEW.portal_id != OLD.portal_id`.

### `auto_expire_at` — NOT a column

Computed in a background sweep job (cron) as `now() > starts_at + interval '6 hours' AND status IN ('planning', 'active')` → transition to `'expired'`. Avoids stored-value drift. Sweep runs every 15 minutes.

### Migration 617

**File:** `database/migrations/617_plans_consolidation.sql` (+ paired `supabase/migrations/YYYYMMDDHHMMSS_plans_consolidation.sql` via `database/create_migration_pair.py plans_consolidation`).

**Pre-migration codebase sweep (must complete before Migration 617 runs):**

- **Enumerate `event_rsvps` consumers.** `grep -rn "event_rsvps" web/ > docs/consolidation-event-rsvps-callers.md` — commit this list as a tracking artifact. ~39 files across API routes, library modules, scripts, components, tests. The view created by the migration is semantically *not equivalent* to the old table (old enum `{going, interested, not_going}` vs new `{invited, going, maybe, declined}`). Any reader with `WHERE status = 'interested'` returns empty silently; any `status != 'going'` check matches new `'invited'` rows. Every consumer must be audited and either (a) rewritten to use the new API/table directly, or (b) verified to only compare against the intersection `'going'` (which remains valid through the view).
- **Delete 7 existing `/api/plans/*` route files** before migration runs (they query `plan_participants`, `plan_items`, `plan_suggestions` — tables migration drops):
  - `web/app/api/plans/route.ts`
  - `web/app/api/plans/[id]/route.ts`
  - `web/app/api/plans/[id]/participants/route.ts`
  - `web/app/api/plans/[id]/items/route.ts`
  - `web/app/api/plans/[id]/suggestions/route.ts`
  - `web/app/api/plans/friends/route.ts`
  - `web/app/api/plans/share/[token]/route.ts`
- **Delete `web/app/api/hangs/` directory entirely** (5 route files — dropping the `hangs` table makes them 500 regardless of `ENABLE_HANGS_V1`):
  - `web/app/api/hangs/route.ts`
  - `web/app/api/hangs/hot/route.ts`
  - `web/app/api/hangs/venue/[id]/route.ts`
  - `web/app/api/hangs/friends/route.ts`
  - `web/app/api/hangs/og/route.tsx`
- **Rewrite `web/app/plans/page.tsx` and `web/app/plans/[id]/page.tsx`** to use new API — currently they query `plan_items`/`plan_participants` directly via Supabase.
- **Enumerate and resolve activity-log triggers / notifications referencing dropped tables.** Check `database/migrations/` for any AFTER INSERT/UPDATE/DELETE triggers on `hangs`, `itineraries*`, `event_rsvps`, or dormant `plans` that fire into `activity_logs`, `notifications`, or similar. Each must be dropped explicitly before the table drops cascade.

**Migration 617 steps (in order, single transaction where feasible):**

1. **Drop legacy tables** (no data preservation):
   - `DROP TABLE IF EXISTS hangs CASCADE;`
   - `DROP TABLE IF EXISTS itinerary_participant_stops CASCADE;`
   - `DROP TABLE IF EXISTS itinerary_participants CASCADE;`
   - `DROP TABLE IF EXISTS itinerary_items CASCADE;`
   - `DROP TABLE IF EXISTS itineraries CASCADE;`
   - `DROP TABLE IF EXISTS plan_notifications CASCADE;`
   - `DROP TABLE IF EXISTS plans CASCADE;` (the dormant one)
   - `DROP TABLE IF EXISTS event_rsvps CASCADE;`
2. **Drop related functions/triggers** — enumerate during implementation (any activity-log triggers referencing dropped tables).
3. **Create new `plans` table** with all columns, constraints, generated `anchor_type`.
4. **Create `plan_invitees` table.**
5. **Create indexes** (list above).
6. **Create triggers** (updated_at, portal immutability).
7. **Enable RLS + apply policies** on both tables.
8. **Create read-compat view `event_rsvps`:**
   ```sql
   CREATE VIEW event_rsvps AS
   SELECT
     pi.user_id,
     p.anchor_event_id AS event_id,
     pi.rsvp_status AS status,
     p.portal_id,
     pi.invited_at AS created_at
   FROM plan_invitees pi
   JOIN plans p ON p.id = pi.plan_id
   WHERE p.anchor_type = 'event';
   ```
   This view is READ-ONLY. Any writer still pointing at `event_rsvps` will fail — caught by Phase 2's RSVP rewrite.

**Parity audit:** `audit_migration_parity.py --fail-on-unmatched` must pass before PR merges. Both `database/migrations/` and `supabase/migrations/` paths populated.

### Future multi-stop scaffolding

Committed as `.sql.draft` files (not applied):
- `database/migrations/_draft_plan_stops.sql.draft`
- `database/migrations/_draft_plan_stop_invitees.sql.draft`
- `database/migrations/_draft_README.md` — pointer explaining activation ("when voting / multi-stop ships, review draft + promote to numbered migration")

---

## Section 2: API Surface

### Routes (all under `/api/plans`)

**CRUD:**
- `POST /api/plans` — create plan + creator invitee row in single transaction
- `GET /api/plans/:id` — detail (plan + invitees + anchor expanded)
- `PATCH /api/plans/:id` — update title / note / visibility / starts_at / status (creator only)
- `DELETE /api/plans/:id` — soft cancel (sets `status='cancelled'`, `cancelled_at=now()`)

**Lists:**
- `GET /api/plans?scope=mine&status=upcoming|active|past` — plans where auth user is creator OR going invitee
- `GET /api/plans?scope=friends` — plans from friends that auth user can see (visibility + friendship check)
- `GET /api/plans?anchor_event_id=X` — plans for event X
- `GET /api/plans?anchor_place_id=X` — plans for place X

**Invitees:**
- `POST /api/plans/:id/invitees` — body: `{ user_ids: uuid[] }` (creator only, bulk invite)
- `PATCH /api/plans/:id/invitees/me` — body: `{ rsvp_status }` (self-respond)
- `PATCH /api/plans/:id/invitees/me/seen` — mark invite seen (sets `seen_at`)
- `DELETE /api/plans/:id/invitees/:user_id` — uninvite (creator) OR leave (self)

**Public share:**
- `GET /api/plans/shared/:token` — cold visitor view. Returns plan if (a) visibility=public, OR (b) visibility=friends AND token matches (anyone with the link), OR (c) auth user is in invitees. Otherwise 404. No auth required.

**RSVP compat (temporary, removed in cleanup PR):**
- `POST /api/rsvp` — unchanged external shape; rewritten internally to call the plans create path. Maps `{ event_id, status='going' }` → creates a plan with `anchor_type='event'`, solo.
- `GET /api/rsvp` — reads via the `event_rsvps` view.
- `DELETE /api/rsvp` — cancels the plan.

### Hook module (`web/lib/hooks/useUserPlans.ts`)

**Replaces and deletes:** `useHangs.ts`, `useItinerary.ts`, `useItineraryCrew.ts`, `useFriendPlans.ts`, existing `usePlans.ts`, `lib/types/hangs.ts`.

**Exports:**

| Hook | Returns | Purpose |
|---|---|---|
| `useMyPlans({ scope, status })` | `{ plans, isLoading }` | Agenda list |
| `usePlan(id)` | `{ plan, invitees, isLoading }` | Plan detail |
| `useEventPlans(eventId)` | `{ count, friendCount, isLoading }` | Event card / detail aggregates |
| `usePlacePlans(placeId)` | `{ activeCount, friendsHere, isLoading }` | Place card / detail aggregates |
| `useActivePlans(portalId)` | `{ plans, isLoading }` | CommunityHub active banner |
| `useCreatePlan()` | mutation | Returns plan + share_token |
| `useUpdatePlan(id)` | mutation | |
| `useCancelPlan(id)` | mutation | |
| `useInviteToPlan(id)` | mutation | Bulk invite |
| `useRespondToPlan(id)` | mutation | Self-respond |
| `useMarkPlanSeen(id)` | mutation | |

**Types:** consolidated in `web/lib/types/plans.ts` (replaces `lib/types/hangs.ts`).

### Validation (API layer)

- `portal_id` required on create; API verifies `portal_id === anchor.portal_id` before insert.
- Exactly one anchor FK must be provided at create; validated before insert.
- `starts_at`: must be future OR within anchor event's time window (for anchors like events happening now).
- Status transitions validated against enum and current state (see Section 1 transition rules).
- Visibility transitions freely (no retroactive cleanup needed — visibility is a filter, not a deletion).

### Conventions

- **Auth middleware by route shape:**
  - Flat routes (no dynamic segments) → `withAuth` from `lib/api-middleware.ts`
  - Dynamic-segment routes (`/plans/:id`, `/plans/:id/invitees/me`, `/plans/:id/invitees/:user_id`) → `withAuthAndParams<T>` — `withAuth` alone does not pass params through
  - Public share route → no wrapper; uses anon Supabase client, rate-limit-gated
- All writes use `createServiceClient()` + `as never` on inserts/updates.
- Rate limits: `RATE_LIMITS.write` on mutations, `RATE_LIMITS.read` on reads. **`/api/plans/shared/:token` gets its own dedicated rate-limit bucket** (tighter than `RATE_LIMITS.read`) to block enumeration probing.
- **Shared-link security:** returns constant-time 404 for both "no such token" and "token exists but viewer unauthorized" — no timing or response-shape leak. Tokens are not rotated on visibility downgrade; revoking a share requires explicit action (future: `POST /api/plans/:id/regenerate-share`, deferred).
- **`/me` path convention:** the `/api/plans/:id/invitees/me` and `/api/plans/:id/invitees/me/seen` routes use `/me` to mean "current authenticated user." This is a new convention in LostCity (only `api/users/me/lists` uses it elsewhere). Documented here as intentional RESTful choice; implementer should not replicate the legacy `/:user_id === auth.uid()` pattern used in some older routes.
- Launch flag: `ENABLE_PLANS_V1` (dual-prefix: `NEXT_PUBLIC_ENABLE_PLANS_V1` + `ENABLE_PLANS_V1`). Gate new `/api/plans` routes until ready; remove `ENABLE_HANGS_V1` gates from `RSVPButton`, `CommunityHub`, and feed manifest to cull dead code (delete the flag constant from `launch-flags.ts` once the entire `api/hangs/` directory and `useHangs.ts` are deleted — see Phase 1 deliverables).

### Aggregate fetching (avoid N+1 on feed renders)

Event cards and place cards in the feed render `friendCount` / `activeCount` signals. Per-card hooks (`useEventPlans(id)` × 20 cards = 20 queries) must NOT be used on feed surfaces.

- **Feed-level batched aggregate:** feed loaders fetch plan aggregates for the full event/place id list in a single query joined to plan_invitees, computed server-side, passed through as part of the existing feed payload. Pattern matches how `friends_going` is computed today in portal-feed-loader.
- **Per-surface hooks** (`useEventPlans`, `usePlacePlans`) are acceptable on detail pages where only one entity's aggregate is needed.
- **`scope=friends` plan list** has no supporting index (`are_friends()` is a function, not indexable). Queries filter by `visibility IN ('public','friends')` + `status IN ('planning','active')` via index, then post-filter by `are_friends()` in application code. Acceptable until friend lists grow past ~1000 per user; flagged in Section 5 watch items.

---

## Section 3: UI Surfaces

### Surface map

| Surface | What renders | Data source |
|---|---|---|
| **Event detail page** | "N going" pill + "Invite friends" CTA | `useEventPlans(eventId)` |
| **Place detail page** | Active plans strip ("N hanging now") + "Plan visit" CTA | `usePlacePlans(placeId)` — finally wires `PlacePlansStrip` |
| **Event card** (feed) | Social proof pill: "N friends going" when friendCount > 0 | `useEventPlans` aggregate |
| **Place card** (feed) | Active presence pill: "N hanging now" when activeCount > 0 | `usePlacePlans` aggregate |
| **`/{portal}/plans`** | Agenda (upcoming / active / past tabs); friends filter; `+` button for anchor picker | `useMyPlans`; my-plans spec UI |
| **Plan detail page** | Anchor info, invitees + RSVP states, "Invite more" action, share link. **New Pencil comp required.** | `usePlan(id)` |
| **Shared plan page** (`/plans/shared/:token`) | Cold visitor view — "Sarah invited you to X" + signup CTA. **New Pencil comp required.** | `/api/plans/shared/:token` (no auth) |
| **Community Hub** | Active plan banner (if user has one) | `useActivePlans(portalId)` — was `ActiveHangBanner` |
| **Post-RSVP flow** | Optional nudge toast: "Going with anyone? Invite friends" | Reframes `PostRsvpHangPrompt` → `PostRsvpInviteNudge` |
| **Main nav** | `/plans` tab (already covered in my-plans spec Task 2) | Existing |

**Explicitly NOT a surface:** dedicated "Plans" section in the feed. The Hangs mistake was creating a standalone feature that needed liquidity to be worth visiting. Plans live inside discovery.

### Component migration

**Delete:**
- `web/components/feed/sections/HangFeedSection.tsx`
- `web/components/hangs/HangShareCard.tsx` → replaced by generic `PlanShareCard` in new location
- `web/components/hangs/HangShareFlow.tsx` → replaced by `PlanShareFlow`
- Remove `hangs` entry from `web/lib/city-pulse/manifests/atlanta.tsx` (manifest line ~314)
- `web/lib/types/hangs.ts`
- All five legacy hooks listed in Section 2

**Rename and repurpose (move to `web/components/plans/`):**

| Old path | New path | Changes |
|---|---|---|
| `components/hangs/HangButton.tsx` | `components/plans/PlanCTA.tsx` | Context-aware: "Going" on event, "Plan visit" on place, "Start plan" freeform. **Finally gets wired** onto event + place detail |
| `components/hangs/PlaceHangStrip.tsx` | `components/plans/PlacePlansStrip.tsx` | **Finally gets wired** onto place detail |
| `components/hangs/PlaceHangStripLive.tsx` | `components/plans/PlacePlansStripLive.tsx` | Wrapper using new `usePlacePlans` hook |
| `components/hangs/ActiveHangBanner.tsx` | `components/plans/ActivePlanBanner.tsx` | Retargeted at `useActivePlans` |
| `components/hangs/HangSheet.tsx` | `components/plans/PlanSheet.tsx` | Extended with invite picker |
| `components/hangs/PostRsvpHangPrompt.tsx` | `components/plans/PostRsvpInviteNudge.tsx` | **Behavioral rewrite, not rename.** Current component is a positioned fixed overlay wrapping `HangSheet`; new version opens `PlanSheet` (different data flow) + re-keys the localStorage dedup key (`rsvp_hang_prompt_dismissed_${eventId}` → `rsvp_plan_invite_nudge_dismissed_${eventId}`, no migration of old keys — we accept that dismissed users see the nudge once more) + changes visibility triggers to align with "optional nudge toast" pattern |

**Keep (not hangs-collision):**
- `components/feed/sections/RegularHangsSection.tsx` — this is the Regulars feature (recurring venue events), not the social Hangs feature. Rename flagged as follow-up item.

**From my-plans spec (retargeted):**
- `PlansAgenda`, `AgendaEntryRow`, `FriendEntryRow`, `GapRow`, `PlanExpandableRow`, `PlansEmptyState`, `PlansHeader`, `MonthMinimap`, `MiniDayCell` — all stay; reshaped to consume `useMyPlans` instead of RSVPs + series subscriptions. Task 1 (migration) kept as-is; Tasks 2–16 refocus.

**Existing `components/plans/` files (16 files from my-plans Task 1) that need conflict check:**
- No filename collision with migrating hang components (those become `PlanCTA`, `PlacePlansStrip`, `ActivePlanBanner`, `PlanSheet`, `PostRsvpInviteNudge` — none of which already exist in `components/plans/`)
- **Verification required before Phase 5b:** `PlanDetailView.tsx` already exists from my-plans Task 1. Confirm whether it is the same surface as Phase 5b's "Plan detail page," or a separate component. If same, Phase 5b extends it rather than creating anew. If different, resolve naming collision.

### Design-handoff posture

Per `CLAUDE.md` hard rule — no UI implementation without Pencil comp + spec + motion spec. Surfaces needing comp work before implementation:

| Surface | Comp status | Action |
|---|---|---|
| Plan detail page | None | **Design-block:** new Pencil comp before Phase 5b build |
| Shared plan page (cold visitor) | None | **Design-block:** new Pencil comp before Phase 6 build. Activation-loop-critical; design weight warranted |
| Invite picker modal | None | **Design-block:** Pencil comp before invite UI lands |
| Place plans strip | Existing hang comp may cover | Verify via `/design-handoff verify` |
| Event card "N going" pill | Likely covered in existing EventCard comp | Verify via `/design-handoff verify` |
| `/plans` agenda | Already design-gated in my-plans spec | Unchanged — gate stays |

Per `feedback_composite_with_siblings.md`: screenshot new comps next to their siblings at deploy scale before implementation.

---

## Section 4: Migration Order

### Phase 1 — Foundation (blocks all)

Phase 1 is NOT just the migration — it is an atomic "drop old + stand up new" replacement. Every file that queries a dropped table must be deleted or rewritten in the same PR as migration 617, or the deploy will 500.

**Prerequisite deliverable** (must complete before migration runs):
- Produce `docs/consolidation-event-rsvps-callers.md` — the canonical list of ~39 consumer files, with each marked as: rewrite-to-new-API, verify-via-compat-view, or delete. Commit before any other Phase 1 work.

**Atomic PR contents:**
- **Delete existing `/api/plans/*` route files** (7 files — listed in Section 1's pre-migration sweep)
- **Delete `web/app/api/hangs/` entire directory** (5 route files)
- **Rewrite `web/app/plans/page.tsx` and `web/app/plans/[id]/page.tsx`** to use new API (currently query old tables directly)
- **Run migration 617** (drop legacy tables + create plans + plan_invitees + indexes + RLS + triggers + `event_rsvps` read-compat view)
- **Create new `/api/plans/*` routes** — CRUD + invitees + shared, using `withAuth` / `withAuthAndParams` per route shape, `createServiceClient`
- **Create `useUserPlans.ts`** hook module
- **Launch flag:** add `ENABLE_PLANS_V1`; remove `ENABLE_HANGS_V1` references from `launch-flags.ts`, `RSVPButton.tsx`, `CommunityHub.tsx`, `manifests/atlanta.tsx`, `useHangs.ts`, and all 5 `api/hangs/*` routes (the latter five files get deleted outright; the flag constant itself deleted after grep confirms zero remaining references)
- **Rewrite `event_rsvps` readers** — for every file in `docs/consolidation-event-rsvps-callers.md` marked "rewrite," migrate to either new `/api/plans` API calls or direct plans-table queries. "Verify-via-compat-view" files must be audited to confirm they only check against `status = 'going'` (the one enum value that survives the view's semantic mapping).

**Estimated weight:** ~2 days (agentic) — revised upward from initial ~1 day once the full consumer surface was mapped.

### Phase 2 — RSVP compat rewrite (after Phase 1)

- `/api/rsvp` rewritten internally to create plans (same external request shape for GET/POST/DELETE)
- **Add deprecation-log instrumentation:** every call to `/api/rsvp` logs `logger.warn({ route: '/api/rsvp', caller: <referer/user-agent>, method, timestamp }, 'deprecated route')` — this feeds Phase 7's verification gate
- Delete all 5 legacy hooks: `useHangs`, `useItinerary`, `useItineraryCrew`, `useFriendPlans`, old `usePlans`
- Delete `lib/types/hangs.ts`

**Estimated weight:** ~½ day.

### Phase 3 — UI quick wins (Track A first, then B/C/D parallel)

Tracks A and D share the feed-manifest file; B and C import from the directory A renames. Track A must land before the others.

- **Track A (first, sequential):** Rename + move `components/hangs/` → `components/plans/`; repurpose each component to the new hooks. Update all imports across the codebase (grep-driven). Remove the `hangs` entry from `web/lib/city-pulse/manifests/atlanta.tsx` in the same commit (this was formerly Track D, absorbed here to avoid the file-conflict).
- **Track B (after A):** Wire `ActivePlanBanner` into CommunityHub
- **Track C (after A):** Wire `PlacePlansStripLive` onto place detail page — **unburies the feature** (this single wiring fixes the orphan problem that kicked off this entire conversation)

**Estimated weight:** ~1 day (Track A: half-day sequential; B/C: half-day parallel after).

### Phase 4 — Discovery integration (parallel after Phase 3)

- **Track A:** Event detail — "N going" pill + "Invite friends" CTA
- **Track B:** Event cards in feed — social proof pill via aggregate
- **Track C:** Place cards in feed — active presence pill
- **Track D:** Post-RSVP invite nudge (decision 1b)

**Estimated weight:** ~1–2 days.

### Phase 5 — Agenda + plan detail (parallel after Phase 2)

- **Track A:** my-plans spec retargeted — Tasks 2–16 reshape around plans data model
- **Track B:** Plan detail page — new Pencil comp required before build
- **Track C:** `+` anchor picker on `/plans` tab (decision 2ii)

**Estimated weight:** ~2–3 days (my-plans retarget is bulk; plan detail gated on comp).

### Phase 6 — Activation loop (parallel with Phase 5)

- Shared plan page (`/plans/shared/:token`) — new Pencil comp required, design-block
- Activation-loop instrumentation (signup attribution when a cold visitor lands via share token)

**Estimated weight:** ~1 day build after comp lands.

### Phase 7 — Cleanup (after all callers migrated off `/api/rsvp`)

**Verification gate (all three must pass before cleanup PR opens):**

1. `grep -rn "event_rsvps\|/api/rsvp" web/` returns zero hits outside the `/api/rsvp/route.ts` file itself and the compat view definition.
2. Production deprecation-log reports zero hits on `/api/rsvp` for 7 consecutive days. Instrumentation added in Phase 2: every call to `/api/rsvp` logs `{ route: '/api/rsvp', caller: <referer/user-agent>, timestamp }` at WARN level to Logflare for tracking.
3. `docs/consolidation-event-rsvps-callers.md` (produced in Phase 1 prerequisite) has every entry marked resolved.

**Cleanup PR contents (only after gate passes):**

- Remove `web/app/api/rsvp/route.ts`
- Drop `event_rsvps` compat view (new migration, numbered at the time of cleanup)
- Delete deprecation-log instrumentation
- Remove any remaining orphaned hang-named legacy code (grep `Hang` case-insensitive, verify)
- Default `ENABLE_PLANS_V1=true` in prod (env flip — not a code change)
- Schedule flag constant removal 2–3 weeks after default-on (another cleanup PR)

**Estimated weight:** ~½ day after gate passes. Gate may take 1–2 weeks wall time after Phase 2 ships to accumulate deprecation-log silence.

### Critical path

Phase 1 → 2 → 3c (place detail wiring) is the shortest path to **materially fixing the original complaint** (orphan Hangs components + buried feature). Everything after that is the fuller product build.

**Total build weight:** ~7–9 days agentic, gated by Pencil comp turnaround for plan detail + shared plan page.

---

## Section 5: Out-of-Scope + Watch Items

### Deferred to follow-up specs

1. **`saved_items.venue_id → place_id` rename** — pre-existing data-debt missed by the places rename migration. Not blocking (spec drops 'interested' RSVP migration). File separate migration.
2. **Goblin separation from LostCity tree** — user-flagged earlier. Warrants its own spec: move `components/goblin/`, `/g/` route, goblin migrations, goblin API routes into a sibling package or flagged subdirectory.
3. **`RegularHangsSection` → `RegularsSection` rename** — trivial cleanup to remove naming collision. Next time the component is touched, rename it.

### Deferred for future product decisions

4. **Multi-stop plans** (`plan_stops` + voting) — SQL drafts committed as `.sql.draft` with README. Activation trigger: Q2 future-B ("let's all vote on where").
5. **Plan suggestions / collaborative editing** — existing `usePlans.ts` hook had `PlanSuggestion` type. Defers with multi-stop.
6. **Chat on plan detail** — obvious future addition (where are we meeting? running late?). Not v1. Separate table + API when needed.
7. **Plan templates** — "Night out in East Atlanta" as a shareable recipe. Future growth hook.

### Strategic watch items

8. **Friend-graph liquidity test.** This spec builds the coordination layer; it does not create friend connections. If after Phase 6 lands, the shared-plan activation loop (`/plans/shared/:token`) doesn't materially grow the friend graph over 30 days, the "substance earns the invite" thesis is failing and the product weight on Plans-as-primary-social should be revisited.
9. **Launch flag timing.** Default `ENABLE_PLANS_V1=true` in prod after 1 week of stable observation. Schedule flag removal (dead-code pass) for 2–3 weeks after default-on.

---

## Reviewer findings (applied)

Two review passes, both independent. All critical and high findings applied inline; watch-items tracked in Section 5.

### Pass 1 — Data model review (Section 1 only)

**From `architect-review` (schema soundness):**
- ✅ Anchor discriminator as `GENERATED ALWAYS AS` — not hand-settable
- ✅ Creator lives in `plan_invitees` (clean uniform queries; denormalized `creator_id` for authz only)
- ✅ Added `expired` as distinct terminal state (separate from `ended`, `cancelled`)
- ✅ Kept `rsvp_status='maybe'` (load-bearing for response rates)
- ✅ `auto_expire_at` computed in sweep, not stored
- ✅ Added `title` (nullable), `cancelled_at`, `plan_invitees.seen_at`, `updated_by`
- ✅ Full index list baked in
- ✅ Portal immutability trigger (belt-and-suspenders vs P0 leakage)

**From `full-stack-dev` (pattern fit):**
- ✅ `places.id` confirmed `SERIAL` (int); anchor FK types correct
- ✅ Portal attribution via explicit API arg (not trigger from anchor) — matches migration 604 precedent
- ✅ `event_rsvps` blast radius noted: 21 consumer API files (~39 total including scripts/tests/lib) — read-compat view chosen over atomic rewrite
- ✅ Skipped `saved_items` 'interested' migration (per user: beta, don't preserve)
- ✅ RLS pattern standard on `plans`; complex multi-role on `plan_invitees` — explicit policies spelled out
- ✅ `withAuth` + `createServiceClient` + `as never` confirmed current pattern
- ✅ Legacy hooks enumerated for deletion (5 hooks + types file)
- ✅ Launch flag convention dual-prefix; `ENABLE_HANGS_V1` guards culled in Phase 1
- ✅ Migration number 617 confirmed; `database/create_migration_pair.py plans_consolidation` scaffolding; parity audit mandatory
- ✅ Inline self-review: RLS policy corrected to use canonical `are_friends()` function (migration 011) instead of phantom `friendships` table

### Pass 2 — Full-spec review (Sections 2–5)

**From `architect-review` (coherence across sections):**
- ✅ **RLS gap on `plan_invitees` SELECT** — invitees couldn't see each other, breaking plan-detail roster view. Fixed: added "if you're on the invite list, you see the list" clause.
- ✅ **Phase 7 verification mechanism** — added explicit gate: grep clean + 7-day deprecation-log silence + tracked callers file resolved. Deprecation-log instrumentation added to Phase 2.
- ✅ **`event_rsvps` compat view semantic mismatch** — old enum `{going, interested, not_going}` ≠ new `{invited, going, maybe, declined}`. Spec now requires pre-Phase-1 consumer sweep + per-file disposition (rewrite vs verify-compat-view) documented in `docs/consolidation-event-rsvps-callers.md`.
- ✅ **Status machine invitee lifecycle** — explicit rule added: terminal-state transitions never delete `plan_invitees` rows. History preserved for flake-rate analytics (the justification behind the `expired` distinction).
- ✅ **Shared-link auth hardening** — dedicated rate-limit bucket, constant-time 404, token-rotation policy (deferred action, documented).
- ✅ **Phase 3 track-parallelism fix** — Track A (rename directory) must run before B/C/D. Former Track D (manifest removal) absorbed into Track A since it's in the same file domain.
- ✅ **N+1 risk on feed aggregates** — spec now mandates feed-level batched aggregate fetch (not per-card hooks). `scope=friends` post-filter limitation documented.
- ⚠️ **Scope decomposition** — architect recommended split into Spec 1 (Phases 1-3) + Spec 2 (Phases 4-7). User chose single spec; accepted with acknowledgement that comp-turnaround on Phases 5b/6 is on the critical path.

**From `full-stack-dev` (pattern fit, 2nd pass):**
- ✅ **Existing `/api/plans/*` route conflict** — 7 live route files found that would 500 on migration run. All added to Phase 1 deletion list.
- ✅ **Existing `/plans` page conflict** — `web/app/plans/page.tsx` and `/plans/[id]/page.tsx` query old tables directly. Spec now requires atomic rewrite in Phase 1 PR.
- ✅ **`ENABLE_HANGS_V1` missed 5 files** — entire `web/app/api/hangs/` directory + `useHangs.ts` still reference dropped table. All explicitly scheduled for Phase 1 deletion (not just flag-guard removal).
- ✅ **`withAuth` vs `withAuthAndParams`** — spec now specifies wrapper by route shape.
- ✅ **`/me` convention is new to LostCity** — documented as intentional RESTful choice.
- ✅ **`components/plans/` collision check** — no filename collisions; `PlanDetailView.tsx` flagged for Phase 5b verification (same surface or different?).
- ✅ **`PostRsvpHangPrompt` is a behavioral rewrite, not rename** — spec now explicit: new localStorage key, different sheet open, different visibility triggers.
- ✅ **Feed manifest coverage** — only `atlanta.tsx` needs the hangs-entry removal. Confirmed.
- ✅ **Migration scaffolding** — `database/create_migration_pair.py` exists and works. FK cascades on dropped tables are clean (no external FK references pointing in).
- ✅ **Activity-log triggers / notifications referencing dropped tables** — pre-migration sweep now enumerates and explicitly drops them.

---

## Acceptance

Design locked. Ready for implementation-plan authoring (via `superpowers:writing-plans` skill).

**Next step:** user reviews this spec; once approved, invoke `writing-plans` to produce the task-by-task implementation plan.
