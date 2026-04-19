# Social Coordination Consolidation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate four overlapping social-coordination systems (hangs, itineraries, dormant plans, event_rsvps) into one unified `plans` + `plan_invitees` model with a single API surface, single hook module, and integrated UI across event/place detail, feed cards, agenda, plan detail, and the shareable-plan activation loop.

**Architecture:** New `plans` table anchored to existing LostCity content (events/places/series). Every solo "going" RSVP IS a plan with the creator as a `plan_invitees` row. Read-compat `event_rsvps` view keeps ~39 existing consumers working during expand-contract rewrite. Migration 617 drops legacy tables (no data preservation, beta posture). Orphaned `HangButton` + `PlaceHangStripLive` finally get wired onto event/place detail as `PlanCTA` + `PlacePlansStrip`. Shareable `/plans/shared/:token` page is the friend-graph activation loop.

**Tech Stack:** PostgreSQL 15 (Supabase), Next.js 16 App Router, React 19, TypeScript, TanStack Query, Zod, Tailwind CSS v4, Phosphor Icons, Vitest, Pencil design system.

**Spec:** `docs/superpowers/specs/2026-04-18-social-coordination-consolidation-design.md`

---

## File Structure

### Created

**Database:**
- `database/migrations/617_plans_consolidation.sql`
- `supabase/migrations/YYYYMMDDHHMMSS_plans_consolidation.sql` (paired via script)
- `database/migrations/_draft_plan_stops.sql.draft` (future multi-stop scaffolding; NOT applied)
- `database/migrations/_draft_plan_stop_invitees.sql.draft`
- `database/migrations/_draft_README.md`

**Tracking artifacts:**
- `docs/consolidation-event-rsvps-callers.md` (produced in Phase 0, commit as file)

**API routes (`web/app/api/plans/`):**
- `route.ts` — POST (create), GET (list with scope/status filters)
- `[id]/route.ts` — GET (detail), PATCH (update), DELETE (cancel)
- `[id]/invitees/route.ts` — POST (bulk invite)
- `[id]/invitees/me/route.ts` — PATCH (self-respond)
- `[id]/invitees/me/seen/route.ts` — PATCH (mark seen)
- `[id]/invitees/[userId]/route.ts` — DELETE (uninvite)
- `shared/[token]/route.ts` — GET (public via token)

**Hooks + types:**
- `web/lib/hooks/useUserPlans.ts`
- `web/lib/types/plans.ts`

**Components (`web/components/plans/`):**
- `PlanCTA.tsx` (renamed from `HangButton`, context-aware)
- `PlacePlansStrip.tsx` (renamed)
- `PlacePlansStripLive.tsx` (renamed)
- `ActivePlanBanner.tsx` (renamed)
- `PlanSheet.tsx` (renamed + invite picker)
- `PostRsvpInviteNudge.tsx` (behavioral rewrite of `PostRsvpHangPrompt`)
- `PlanShareCard.tsx` (new)
- `PlanShareFlow.tsx` (new)
- `PlanDetailView.tsx` (extend existing OR new, pending Phase 5 verification)
- `PlanAnchorPicker.tsx` (new, for `+` CTA)
- `EventGoingPill.tsx` (new, for event card/detail)
- `PlacePresencePill.tsx` (new, for place card)

**Pages:**
- `web/app/plans/shared/[token]/page.tsx` (public shared plan — new Pencil comp required)

### Modified

- `web/app/plans/page.tsx` — rewrite to use new API (currently queries old tables)
- `web/app/plans/[id]/page.tsx` — rewrite
- `web/app/api/rsvp/route.ts` — internally call plans service; add deprecation-log warn
- `web/lib/launch-flags.ts` — add `ENABLE_PLANS_V1`, remove `ENABLE_HANGS_V1`
- `web/components/RSVPButton.tsx` — remove `ENABLE_HANGS_V1` guard; swap `PostRsvpHangPrompt` → `PostRsvpInviteNudge`
- `web/components/community/CommunityHub.tsx` — remove `ENABLE_HANGS_V1` guard; swap `ActiveHangBanner` → `ActivePlanBanner`
- `web/lib/city-pulse/manifests/atlanta.tsx` — remove `hangs` entry from manifest
- `web/lib/portal-feed-loader.ts` — add plan aggregates to feed payload (batched)
- ~39 files referencing `event_rsvps` — rewrite per Phase 0 sweep file dispositions
- From my-plans spec: `PlansAgenda`, `AgendaEntryRow`, `FriendEntryRow`, `GapRow`, `PlanExpandableRow`, `PlansEmptyState`, `PlansHeader`, `MonthMinimap`, `MiniDayCell` — retarget at `useMyPlans`

### Deleted

- `web/app/api/plans/friends/route.ts`
- `web/app/api/plans/[id]/participants/route.ts`
- `web/app/api/plans/[id]/items/route.ts`
- `web/app/api/plans/[id]/suggestions/route.ts`
- `web/app/api/hangs/` (entire directory — 5 files)
- `web/lib/hooks/useHangs.ts`, `useItinerary.ts`, `useItineraryCrew.ts`, `useFriendPlans.ts`, old `usePlans.ts`
- `web/lib/types/hangs.ts`
- `web/components/hangs/` (entire directory — after rename to plans/)
- `web/components/feed/sections/HangFeedSection.tsx`

### Tests

- `database/migrations/tests/test_617_plans_consolidation.sql` (pgTAP or SQL assertion style per existing convention)
- `web/lib/hooks/useUserPlans.test.ts`
- `web/app/api/plans/route.test.ts` + test files per route
- `web/lib/types/plans.test-d.ts` (type-only tests)

---

## Phase 0 — Prerequisite consumer sweep

**Purpose:** Produce a canonical, committed list of every file that touches `event_rsvps`, annotated with disposition. Blocks Phase 1. Without this artifact, the `event_rsvps` compat view's semantic mismatch (old enum `{going, interested, not_going}` vs new `{invited, going, maybe, declined}`) will silently corrupt reads.

### Task 0.1: Produce consumer sweep artifact

**Files:**
- Create: `docs/consolidation-event-rsvps-callers.md`

- [ ] **Step 1: Run the sweep**

```bash
cd /Users/coach/Projects/LostCity
grep -rn "event_rsvps" web/ --include='*.ts' --include='*.tsx' > /tmp/rsvp-callers.txt
grep -rn "event_rsvps" crawlers/ 2>/dev/null | grep -v __pycache__ >> /tmp/rsvp-callers.txt
wc -l /tmp/rsvp-callers.txt
```

Expected: ~60–80 lines across ~39 files.

- [ ] **Step 2: Create the tracking document**

Write `docs/consolidation-event-rsvps-callers.md` with this structure:

```markdown
# event_rsvps Consumer Sweep

Generated: 2026-04-18. Source command:
`grep -rn "event_rsvps" web/ --include='*.ts' --include='*.tsx'`

Each consumer is categorized by disposition:
- **REWRITE** — must switch to `/api/plans` or direct `plans`/`plan_invitees` query before Phase 1 ships
- **VERIFY** — reads through compat view are safe IF the code only checks `status = 'going'` (the one enum value that survives the semantic mapping). Audit to confirm.
- **DELETE** — dead code; remove with its parent module

## API routes

- [ ] REWRITE `web/app/api/rsvp/route.ts` — primary write path; Phase 2 rewrites
- [ ] REWRITE `web/app/api/user/calendar/route.ts` — filters by status
- [ ] REWRITE `web/app/api/user/calendar/feed/route.ts`
- [ ] REWRITE `web/app/api/user/calendar/friends/route.ts`
- [ ] REWRITE `web/app/api/your-people/friend-signal-events/route.ts` — friend-RSVP signal
- [ ] REWRITE `web/app/api/your-people/crew-board/route.ts`
- [ ] REWRITE `web/app/api/feed/route.ts`
- [ ] REWRITE `web/app/api/tonight/route.ts`
- [ ] REWRITE `web/app/api/trending/route.ts`
- [ ] REWRITE `web/app/api/events/live/route.ts`
- [ ] REWRITE `web/app/api/events/friends-going/route.ts`
- [ ] REWRITE `web/app/api/dashboard/activity/route.ts`
- [ ] REWRITE `web/app/api/dashboard/crew-this-week/route.ts`
- [ ] REWRITE `web/app/api/admin/analytics/route.ts`
- [ ] REWRITE `web/app/api/admin/analytics/portal/[id]/route.ts`
- [ ] REWRITE `web/app/api/admin/analytics/export/route.ts`
- [ ] REWRITE `web/app/api/admin/analytics/webhook/route.ts`
- [ ] REWRITE `web/app/api/admin/users/route.ts`
- [ ] REWRITE `web/app/api/find-friends/suggestions/route.ts`
- [ ] REWRITE `web/app/api/preferences/profile/route.ts`
- [ ] REWRITE `web/app/api/series/[slug]/subscribe/route.ts`
- [ ] REWRITE `web/app/[portal]/api/search/unified/personalize/route.ts`

## Library modules

- [ ] REWRITE `web/lib/portal-feed-loader.ts` — feed aggregates (batched plan query)
- [ ] REWRITE `web/lib/city-pulse/counts.ts`
- [ ] REWRITE `web/lib/analytics/attributed-metrics.ts`
- [ ] VERIFY `web/lib/types.ts` — type definitions only
- [ ] REGENERATE `web/lib/supabase/database.types.ts` — auto-generated after migration runs

## Components

- [ ] REWRITE `web/components/WhosGoing.tsx` — direct Supabase client call; inspect auth flow

## Scripts / tests

- [ ] REWRITE `web/scripts/seed-elevation-data.ts`
- [ ] REWRITE `web/scripts/seed-staging.ts`
- [ ] REWRITE `web/scripts/seed-social-proof.ts`
- [ ] REWRITE `web/scripts/seed-personas.ts`
- [ ] REWRITE `web/scripts/seed-activity.ts`
- [ ] REWRITE `web/scripts/seed-rsvps.ts`
- [ ] REWRITE `web/scripts/fix-social-visibility.ts`
- [ ] REWRITE `web/scripts/debug-tonight.ts`
- [ ] REWRITE `web/lib/portal-attribution.test.ts`
- [ ] VERIFY `web/CLAUDE.md` — documentation only

## Admin pages

- [ ] REWRITE `web/app/admin/page.tsx`
```

- [ ] **Step 3: Verify the list against the grep output**

Run:
```bash
cut -d: -f1 /tmp/rsvp-callers.txt | sort -u | wc -l
```

Expected: ~39. If the list in the markdown is missing files, add them.

- [ ] **Step 4: Commit**

```bash
git add docs/consolidation-event-rsvps-callers.md
git commit -m "docs: consumer sweep for event_rsvps consolidation

Produced canonical list of files that reference event_rsvps. Each entry
tagged REWRITE / VERIFY / DELETE per Phase 1 disposition. Blocks migration
617 from landing until all REWRITE entries are resolved.
"
```

---

## Phase 1 — Foundation (atomic PR)

**Purpose:** Drop old tables, create new model, rewrite every breaking consumer. Single atomic PR — partial deploy causes widespread 500s.

**Entry criteria:** Phase 0 complete and committed.

### Task 1.1: Create worktree for the consolidation branch

- [ ] **Step 1: Create isolated worktree**

```bash
cd /Users/coach/Projects/LostCity
git worktree add .worktrees/plans-consolidation -b feat/plans-consolidation main
cd .worktrees/plans-consolidation
```

- [ ] **Step 2: Verify**

```bash
git branch --show-current
```

Expected: `feat/plans-consolidation`

### Task 1.2: Scaffold migration 617 file pair

**Files:**
- Create: `database/migrations/617_plans_consolidation.sql`
- Create: `supabase/migrations/YYYYMMDDHHMMSS_plans_consolidation.sql`

- [ ] **Step 1: Run the scaffolding script**

```bash
python3 database/create_migration_pair.py plans_consolidation
```

Expected output: two files created, `617_plans_consolidation.sql` and a matching supabase-timestamped file.

- [ ] **Step 2: Verify parity**

```bash
ls database/migrations/617_plans_consolidation.sql
ls supabase/migrations/ | grep plans_consolidation
```

### Task 1.3: Write migration — drop legacy tables + triggers

**Files:**
- Modify: `database/migrations/617_plans_consolidation.sql`
- Modify: `supabase/migrations/YYYYMMDDHHMMSS_plans_consolidation.sql` (identical content)

- [ ] **Step 1: Enumerate activity-log / notification triggers referencing dropped tables**

```bash
grep -rn "TRIGGER.*hangs\|TRIGGER.*itineraries\|TRIGGER.*event_rsvps" database/migrations/ | grep -v test_
```

For each hit, note the trigger name + the function it calls. These go in the drop block below.

- [ ] **Step 2: Write the drop section**

Prepend to `617_plans_consolidation.sql` (replace in both files — keep identical):

```sql
-- ============================================================================
-- Migration 617: Social coordination consolidation
-- ============================================================================
-- Drops hangs, itineraries*, dormant plans*, plan_notifications, event_rsvps.
-- Creates plans + plan_invitees as unified coordination object.
-- No data preservation (beta posture per spec 2026-04-18-social-coordination-consolidation-design.md).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Drop triggers referencing legacy tables (enumerated from grep)
-- ----------------------------------------------------------------------------
-- Replace with actual trigger names from Step 1 grep. Example pattern:
-- DROP TRIGGER IF EXISTS hang_activity_log ON hangs;
-- DROP FUNCTION IF EXISTS hang_activity_log_fn();

-- [TODO: insert discovered triggers here, one per line]

-- ----------------------------------------------------------------------------
-- 2. Drop legacy tables (CASCADE handles FK-dependent children)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS hangs CASCADE;
DROP TABLE IF EXISTS itinerary_participant_stops CASCADE;
DROP TABLE IF EXISTS itinerary_participants CASCADE;
DROP TABLE IF EXISTS itinerary_items CASCADE;
DROP TABLE IF EXISTS itineraries CASCADE;
DROP TABLE IF EXISTS plan_notifications CASCADE;
DROP TABLE IF EXISTS plan_suggestions CASCADE;
DROP TABLE IF EXISTS plan_participants CASCADE;
DROP TABLE IF EXISTS plan_items CASCADE;
DROP TABLE IF EXISTS plans CASCADE;
DROP TABLE IF EXISTS event_rsvps CASCADE;
```

- [ ] **Step 3: Commit**

```bash
git add database/migrations/617_plans_consolidation.sql supabase/migrations/*_plans_consolidation.sql
git commit -m "migration(617): drop legacy social-coordination tables

Drops hangs, itineraries*, dormant plans*, plan_notifications, event_rsvps.
Triggers enumerated and dropped inline. Next commits add the new schema.
"
```

### Task 1.4: Write migration — create `plans` table

**Files:**
- Modify: `database/migrations/617_plans_consolidation.sql` (+ paired file)

- [ ] **Step 1: Append the plans table definition**

```sql
-- ----------------------------------------------------------------------------
-- 3. Create plans table
-- ----------------------------------------------------------------------------
CREATE TABLE plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  portal_id       uuid NOT NULL REFERENCES portals(id),

  -- Anchor (exactly one non-null)
  anchor_event_id   integer REFERENCES events(id) ON DELETE SET NULL,
  anchor_place_id   integer REFERENCES places(id) ON DELETE SET NULL,
  anchor_series_id  uuid    REFERENCES series(id) ON DELETE SET NULL,

  -- Generated discriminator (not hand-settable)
  anchor_type text GENERATED ALWAYS AS (
    CASE
      WHEN anchor_event_id  IS NOT NULL THEN 'event'
      WHEN anchor_place_id  IS NOT NULL THEN 'place'
      WHEN anchor_series_id IS NOT NULL THEN 'series'
    END
  ) STORED,

  status text NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning','active','ended','expired','cancelled')),

  starts_at     timestamptz NOT NULL,
  started_at    timestamptz,
  ended_at      timestamptz,
  cancelled_at  timestamptz,

  visibility text NOT NULL DEFAULT 'friends'
    CHECK (visibility IN ('private','friends','public')),

  title text CHECK (length(title) <= 140),
  note  text CHECK (length(note)  <= 280),

  share_token text UNIQUE NOT NULL
    DEFAULT encode(gen_random_bytes(12), 'hex'),

  updated_by  uuid REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- Exactly-one-anchor
  CONSTRAINT plans_exactly_one_anchor CHECK (
    (CASE WHEN anchor_event_id  IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN anchor_place_id  IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN anchor_series_id IS NOT NULL THEN 1 ELSE 0 END)
  = 1
  )
);
```

- [ ] **Step 2: Commit**

```bash
git add database/migrations/617_plans_consolidation.sql supabase/migrations/*_plans_consolidation.sql
git commit -m "migration(617): create plans table"
```

### Task 1.5: Write migration — create `plan_invitees` table

- [ ] **Step 1: Append `plan_invitees` table**

```sql
-- ----------------------------------------------------------------------------
-- 4. Create plan_invitees table
-- ----------------------------------------------------------------------------
CREATE TABLE plan_invitees (
  plan_id       uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  rsvp_status   text NOT NULL DEFAULT 'invited'
    CHECK (rsvp_status IN ('invited','going','maybe','declined')),

  invited_by    uuid REFERENCES profiles(id),
  invited_at    timestamptz NOT NULL DEFAULT now(),
  responded_at  timestamptz,
  seen_at       timestamptz,

  PRIMARY KEY (plan_id, user_id)
);
```

- [ ] **Step 2: Commit**

```bash
git add database/migrations/617_plans_consolidation.sql supabase/migrations/*_plans_consolidation.sql
git commit -m "migration(617): create plan_invitees table"
```

### Task 1.6: Write migration — indexes

- [ ] **Step 1: Append index creation**

```sql
-- ----------------------------------------------------------------------------
-- 5. Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX idx_plans_creator_status_starts
  ON plans (creator_id, status, starts_at DESC);

CREATE INDEX idx_plans_anchor_event
  ON plans (anchor_event_id) WHERE anchor_event_id IS NOT NULL;

CREATE INDEX idx_plans_anchor_place
  ON plans (anchor_place_id) WHERE anchor_place_id IS NOT NULL;

CREATE INDEX idx_plans_anchor_series
  ON plans (anchor_series_id) WHERE anchor_series_id IS NOT NULL;

CREATE INDEX idx_plans_portal_status_starts
  ON plans (portal_id, status, starts_at);

CREATE INDEX idx_plan_invitees_user_status
  ON plan_invitees (user_id, rsvp_status);
```

- [ ] **Step 2: Commit**

```bash
git add database/migrations/617_plans_consolidation.sql supabase/migrations/*_plans_consolidation.sql
git commit -m "migration(617): indexes for plans + plan_invitees"
```

### Task 1.7: Write migration — triggers

- [ ] **Step 1: Append triggers**

```sql
-- ----------------------------------------------------------------------------
-- 6. Triggers
-- ----------------------------------------------------------------------------

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION plans_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER plans_updated_at_trigger
  BEFORE UPDATE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION plans_touch_updated_at();

-- Portal_id immutability (P0 leakage prevention)
CREATE OR REPLACE FUNCTION plans_portal_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.portal_id != OLD.portal_id THEN
    RAISE EXCEPTION 'plans.portal_id is immutable after creation (attempted % -> %)',
      OLD.portal_id, NEW.portal_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER plans_portal_immutable_trigger
  BEFORE UPDATE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION plans_portal_immutable();
```

- [ ] **Step 2: Commit**

```bash
git add database/migrations/617_plans_consolidation.sql supabase/migrations/*_plans_consolidation.sql
git commit -m "migration(617): triggers for updated_at + portal immutability"
```

### Task 1.8: Write migration — RLS policies

- [ ] **Step 1: Append RLS**

```sql
-- ----------------------------------------------------------------------------
-- 7. Row Level Security
-- ----------------------------------------------------------------------------

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_invitees ENABLE ROW LEVEL SECURITY;

-- plans SELECT: creator, invitee, public visibility, or friend of creator
CREATE POLICY plans_select ON plans FOR SELECT USING (
  creator_id = auth.uid()
  OR EXISTS (SELECT 1 FROM plan_invitees
             WHERE plan_id = plans.id AND user_id = auth.uid())
  OR visibility = 'public'
  OR (visibility = 'friends' AND are_friends(auth.uid(), creator_id))
);

CREATE POLICY plans_insert ON plans FOR INSERT
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY plans_update ON plans FOR UPDATE
  USING (creator_id = auth.uid());

CREATE POLICY plans_delete ON plans FOR DELETE
  USING (creator_id = auth.uid());

-- plan_invitees SELECT: self, creator of plan, or fellow invitee
CREATE POLICY plan_invitees_select ON plan_invitees FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM plans
             WHERE id = plan_invitees.plan_id AND creator_id = auth.uid())
  OR EXISTS (SELECT 1 FROM plan_invitees pi2
             WHERE pi2.plan_id = plan_invitees.plan_id AND pi2.user_id = auth.uid())
);

CREATE POLICY plan_invitees_insert ON plan_invitees FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM plans
          WHERE id = plan_invitees.plan_id AND creator_id = auth.uid())
);

CREATE POLICY plan_invitees_update ON plan_invitees FOR UPDATE USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM plans
             WHERE id = plan_invitees.plan_id AND creator_id = auth.uid())
);

CREATE POLICY plan_invitees_delete ON plan_invitees FOR DELETE USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM plans
             WHERE id = plan_invitees.plan_id AND creator_id = auth.uid())
);
```

- [ ] **Step 2: Commit**

```bash
git add database/migrations/617_plans_consolidation.sql supabase/migrations/*_plans_consolidation.sql
git commit -m "migration(617): RLS policies for plans + plan_invitees"
```

### Task 1.9: Write migration — `event_rsvps` compat view

- [ ] **Step 1: Append read-compat view + COMMIT**

```sql
-- ----------------------------------------------------------------------------
-- 8. event_rsvps read-compat view
-- ----------------------------------------------------------------------------
-- TEMPORARY: gated for removal in Phase 7 once all consumers migrate.
-- IMPORTANT: enum semantics differ from legacy event_rsvps. Old values
-- {going, interested, not_going}; new via plan_invitees {invited, going, maybe, declined}.
-- Only 'going' maps across; readers relying on other status values must be
-- rewritten BEFORE this migration runs (tracked in docs/consolidation-event-rsvps-callers.md).

CREATE VIEW event_rsvps AS
SELECT
  pi.user_id,
  p.anchor_event_id   AS event_id,
  pi.rsvp_status      AS status,
  p.portal_id,
  pi.invited_at       AS created_at
FROM plan_invitees pi
JOIN plans p ON p.id = pi.plan_id
WHERE p.anchor_type = 'event';

COMMENT ON VIEW event_rsvps IS
  'TEMPORARY compat view over plans + plan_invitees. Removed in Phase 7 cleanup. Do not write to; writers should use /api/plans.';

COMMIT;
```

- [ ] **Step 2: Commit**

```bash
git add database/migrations/617_plans_consolidation.sql supabase/migrations/*_plans_consolidation.sql
git commit -m "migration(617): event_rsvps read-compat view

Temporary scaffolding for Phase 1–7 expand-contract. Consumer readers
pointing at 'going' status only will work through the view. Other status
values return empty (new enum doesn't contain 'interested' or 'not_going').
"
```

### Task 1.10: Apply migration locally + verify

- [ ] **Step 1: Apply the migration**

```bash
cd /Users/coach/Projects/LostCity/.worktrees/plans-consolidation
npx supabase db reset   # or per local convention
```

Expected: clean apply with no errors.

- [ ] **Step 2: Run parity audit**

```bash
python3 database/audit_migration_parity.py --fail-on-unmatched
```

Expected: exit 0, all migrations paired.

- [ ] **Step 3: Verify tables exist + constraints work**

```bash
psql "$DATABASE_URL" <<'SQL'
-- Should exist
\d plans
\d plan_invitees

-- Should FAIL (multiple anchors)
INSERT INTO plans (id, creator_id, portal_id, anchor_event_id, anchor_place_id, starts_at)
VALUES (gen_random_uuid(),
  (SELECT id FROM profiles LIMIT 1),
  (SELECT id FROM portals LIMIT 1),
  1, 1, now() + interval '1 day');

-- Should FAIL (no anchor)
INSERT INTO plans (id, creator_id, portal_id, starts_at)
VALUES (gen_random_uuid(),
  (SELECT id FROM profiles LIMIT 1),
  (SELECT id FROM portals LIMIT 1),
  now() + interval '1 day');

-- Should SUCCEED
INSERT INTO plans (creator_id, portal_id, anchor_event_id, starts_at)
VALUES (
  (SELECT id FROM profiles LIMIT 1),
  (SELECT id FROM portals LIMIT 1),
  (SELECT id FROM events LIMIT 1),
  now() + interval '1 day'
);
SELECT anchor_type FROM plans ORDER BY created_at DESC LIMIT 1;  -- should say 'event'

-- Rollback cleanup
ROLLBACK;
SQL
```

Expected: two failures (constraint violations), one success with `anchor_type='event'`.

- [ ] **Step 4: Regenerate Supabase types**

```bash
npx supabase gen types typescript --local > web/lib/supabase/database.types.ts
```

- [ ] **Step 5: Commit**

```bash
git add web/lib/supabase/database.types.ts
git commit -m "chore(types): regenerate Supabase types after migration 617"
```

### Task 1.11: Create `web/lib/types/plans.ts`

**Files:**
- Create: `web/lib/types/plans.ts`
- Delete: `web/lib/types/hangs.ts`

- [ ] **Step 1: Write the types module**

```typescript
/**
 * Client-safe types for the Plans feature.
 * No server imports — safe to import from "use client" components.
 */

export type PlanStatus = "planning" | "active" | "ended" | "expired" | "cancelled";
export type PlanVisibility = "private" | "friends" | "public";
export type PlanAnchorType = "event" | "place" | "series";
export type RsvpStatus = "invited" | "going" | "maybe" | "declined";

export interface Plan {
  id: string;
  creator_id: string;
  portal_id: string;

  anchor_type: PlanAnchorType;
  anchor_event_id: number | null;
  anchor_place_id: number | null;
  anchor_series_id: string | null;

  status: PlanStatus;
  starts_at: string;
  started_at: string | null;
  ended_at: string | null;
  cancelled_at: string | null;

  visibility: PlanVisibility;
  title: string | null;
  note: string | null;
  share_token: string;

  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanInvitee {
  plan_id: string;
  user_id: string;
  rsvp_status: RsvpStatus;
  invited_by: string | null;
  invited_at: string;
  responded_at: string | null;
  seen_at: string | null;
}

export interface PlanAnchor {
  event?: { id: number; title: string; start_date: string | null; image_url: string | null } | null;
  place?: { id: number; name: string; slug: string | null; image_url: string | null; neighborhood: string | null } | null;
  series?: { id: string; title: string; slug: string | null } | null;
}

export interface InviteeWithProfile extends PlanInvitee {
  profile: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface PlanWithDetail extends Plan {
  anchor: PlanAnchor;
  invitees: InviteeWithProfile[];
}

export interface CreatePlanRequest {
  anchor_type: PlanAnchorType;
  anchor_id: number | string;              // int for event/place, uuid for series
  portal_id: string;
  starts_at: string;                        // ISO
  visibility?: PlanVisibility;
  title?: string;
  note?: string;
  invite_user_ids?: string[];
}

export interface UpdatePlanRequest {
  title?: string | null;
  note?: string | null;
  visibility?: PlanVisibility;
  starts_at?: string;
  status?: Extract<PlanStatus, "active" | "ended" | "cancelled">;
}

export interface EventPlansAggregate {
  going_count: number;
  friend_going_count: number;
}

export interface PlacePlansAggregate {
  active_count: number;
  friends_here: Array<{ user_id: string; display_name: string | null; avatar_url: string | null }>;
}

export const PLAN_DURATION_HOURS_DEFAULT = 6;
export const MAX_PLAN_TITLE_LENGTH = 140;
export const MAX_PLAN_NOTE_LENGTH = 280;
```

- [ ] **Step 2: Delete the old types module**

```bash
rm web/lib/types/hangs.ts
```

- [ ] **Step 3: Verify TypeScript still compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: errors only in files that import from `@/lib/types/hangs` — those are the targets of the upcoming component rename.

- [ ] **Step 4: Commit**

```bash
git add web/lib/types/plans.ts web/lib/types/hangs.ts
git commit -m "types(plans): add plans types module; delete hangs types"
```

### Task 1.12: Delete existing `/api/plans/*` route files + `/api/hangs/` directory

**Files (delete):**
- `web/app/api/plans/route.ts`
- `web/app/api/plans/[id]/route.ts`
- `web/app/api/plans/[id]/participants/route.ts`
- `web/app/api/plans/[id]/items/route.ts`
- `web/app/api/plans/[id]/suggestions/route.ts`
- `web/app/api/plans/friends/route.ts`
- `web/app/api/plans/share/[token]/route.ts`
- `web/app/api/hangs/` (entire directory)

- [ ] **Step 1: Delete**

```bash
rm -rf web/app/api/plans/friends
rm -rf web/app/api/plans/share
rm -rf web/app/api/plans/[id]/participants
rm -rf web/app/api/plans/[id]/items
rm -rf web/app/api/plans/[id]/suggestions
rm web/app/api/plans/[id]/route.ts
rm web/app/api/plans/route.ts

rm -rf web/app/api/hangs
```

- [ ] **Step 2: Verify no stray imports**

```bash
grep -rn "from.*api/plans\|from.*api/hangs" web/ 2>/dev/null
```

Expected: no hits outside of the files we're about to create.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "delete: old /api/plans and /api/hangs route files

Both directories queried tables dropped in migration 617. New /api/plans
routes replace these in subsequent tasks; /api/hangs is retired (feature
folded into /api/plans with anchor_type='place' and status='active').
"
```

### Task 1.13: Create `/api/plans` route — POST (create) + GET (list)

**Files:**
- Create: `web/app/api/plans/route.ts`
- Create: `web/app/api/plans/route.test.ts`

- [ ] **Step 1: Write the failing test**

`web/app/api/plans/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET } from "./route";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "user-123" } },
        error: null,
      })),
    },
  })),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({ data: { id: "evt-1", portal_id: "portal-a" }, error: null })),
      insert: vi.fn(async () => ({ data: [{ id: "plan-1" }], error: null })),
    })),
  })),
}));

describe("POST /api/plans", () => {
  it("creates a plan with creator as first invitee when valid", async () => {
    const req = new NextRequest("http://localhost/api/plans", {
      method: "POST",
      body: JSON.stringify({
        anchor_type: "event",
        anchor_id: 123,
        portal_id: "portal-a",
        starts_at: new Date(Date.now() + 3600_000).toISOString(),
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.plan.id).toBe("plan-1");
  });

  it("rejects when portal_id mismatches anchor portal", async () => {
    const req = new NextRequest("http://localhost/api/plans", {
      method: "POST",
      body: JSON.stringify({
        anchor_type: "event",
        anchor_id: 123,
        portal_id: "portal-wrong",
        starts_at: new Date(Date.now() + 3600_000).toISOString(),
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/plans?scope=mine", () => {
  it("returns plans where user is creator or going invitee", async () => {
    const req = new NextRequest("http://localhost/api/plans?scope=mine&status=upcoming");
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run the test (expect fail)**

```bash
cd web && npx vitest run app/api/plans/route.test.ts
```

Expected: fail — `POST` / `GET` not exported (file doesn't exist yet).

- [ ] **Step 3: Implement the route**

`web/app/api/plans/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import type { PlanAnchorType } from "@/lib/types/plans";

export const runtime = "nodejs";

const CreatePlanSchema = z.object({
  anchor_type: z.enum(["event", "place", "series"]),
  anchor_id: z.union([z.number().int().positive(), z.string().uuid()]),
  portal_id: z.string().uuid(),
  starts_at: z.string().datetime(),
  visibility: z.enum(["private", "friends", "public"]).optional(),
  title: z.string().max(140).optional(),
  note: z.string().max(280).optional(),
  invite_user_ids: z.array(z.string().uuid()).max(50).optional(),
});

async function anchorPortalId(
  service: ReturnType<typeof import("@/lib/supabase/service").createServiceClient>,
  anchor_type: PlanAnchorType,
  anchor_id: number | string
): Promise<string | null> {
  const table =
    anchor_type === "event" ? "events" :
    anchor_type === "place" ? "places" : "series";
  const { data, error } = await service.from(table)
    .select("portal_id")
    .eq("id", anchor_id as never)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { portal_id: string }).portal_id;
}

export const POST = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  const rl = applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rl) return rl;

  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = CreatePlanSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;

  // Validate portal matches anchor
  const anchorPortal = await anchorPortalId(serviceClient, input.anchor_type, input.anchor_id);
  if (!anchorPortal) return NextResponse.json({ error: "Anchor not found" }, { status: 404 });
  if (anchorPortal !== input.portal_id) {
    return NextResponse.json({ error: "portal_id does not match anchor's portal" }, { status: 400 });
  }

  // Insert plan
  const anchorCol =
    input.anchor_type === "event" ? "anchor_event_id" :
    input.anchor_type === "place" ? "anchor_place_id" : "anchor_series_id";

  const { data: planInsert, error: planErr } = await serviceClient
    .from("plans")
    .insert({
      creator_id: user.id,
      portal_id: input.portal_id,
      [anchorCol]: input.anchor_id,
      starts_at: input.starts_at,
      visibility: input.visibility ?? "friends",
      title: input.title ?? null,
      note: input.note ?? null,
      updated_by: user.id,
    } as never)
    .select("id, share_token")
    .single();

  if (planErr || !planInsert) {
    return NextResponse.json({ error: planErr?.message ?? "Insert failed" }, { status: 500 });
  }

  const plan = planInsert as { id: string; share_token: string };

  // Creator is always a plan_invitees row with rsvp_status='going'
  const { error: creatorInviteErr } = await serviceClient
    .from("plan_invitees")
    .insert({
      plan_id: plan.id,
      user_id: user.id,
      rsvp_status: "going",
      invited_by: user.id,
      responded_at: new Date().toISOString(),
    } as never);

  if (creatorInviteErr) {
    // Cleanup — delete the plan so we don't orphan it
    await serviceClient.from("plans").delete().eq("id", plan.id as never);
    return NextResponse.json({ error: creatorInviteErr.message }, { status: 500 });
  }

  // Bulk-invite if requested
  if (input.invite_user_ids && input.invite_user_ids.length > 0) {
    const rows = input.invite_user_ids
      .filter((uid) => uid !== user.id)   // skip self; creator already inserted
      .map((uid) => ({
        plan_id: plan.id,
        user_id: uid,
        rsvp_status: "invited" as const,
        invited_by: user.id,
      }));
    if (rows.length) {
      await serviceClient.from("plan_invitees").insert(rows as never);
    }
  }

  return NextResponse.json({ plan: { id: plan.id, share_token: plan.share_token } }, { status: 201 });
});

const ListQuerySchema = z.object({
  scope: z.enum(["mine", "friends"]).optional().default("mine"),
  status: z.enum(["upcoming", "active", "past"]).optional().default("upcoming"),
  anchor_event_id: z.coerce.number().int().positive().optional(),
  anchor_place_id: z.coerce.number().int().positive().optional(),
});

export const GET = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  const rl = applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rl) return rl;

  const { searchParams } = new URL(request.url);
  const parsed = ListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const { scope, status, anchor_event_id, anchor_place_id } = parsed.data;

  let query = serviceClient
    .from("plans")
    .select(`
      id, creator_id, portal_id, anchor_type, anchor_event_id, anchor_place_id, anchor_series_id,
      status, starts_at, started_at, ended_at, visibility, title, note, share_token, created_at
    `)
    .order("starts_at", { ascending: status === "upcoming" });

  // Status filter
  const now = new Date().toISOString();
  if (status === "upcoming") query = query.in("status", ["planning"] as never).gte("starts_at", now);
  else if (status === "active") query = query.eq("status", "active" as never);
  else if (status === "past") query = query.in("status", ["ended", "expired", "cancelled"] as never);

  // Anchor filter
  if (anchor_event_id) query = query.eq("anchor_event_id", anchor_event_id as never);
  if (anchor_place_id) query = query.eq("anchor_place_id", anchor_place_id as never);

  // Scope filter — mine = creator OR going-invitee; friends = visibility + friendship
  if (scope === "mine") {
    // Plans I created OR plans I'm going to (as invitee)
    const { data: invitedIn } = await serviceClient
      .from("plan_invitees")
      .select("plan_id")
      .eq("user_id", user.id as never)
      .eq("rsvp_status", "going" as never);
    const invitedIds = (invitedIn as { plan_id: string }[] | null ?? []).map((r) => r.plan_id);
    query = invitedIds.length > 0
      ? query.or(`creator_id.eq.${user.id},id.in.(${invitedIds.join(",")})`)
      : query.eq("creator_id", user.id as never);
  }
  // For scope=friends, RLS does the heavy lifting + app-side friend check.

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ plans: data ?? [] });
});
```

- [ ] **Step 4: Run the test — expect pass**

```bash
cd web && npx vitest run app/api/plans/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/app/api/plans/route.ts web/app/api/plans/route.test.ts
git commit -m "feat(api/plans): POST (create) + GET (list) routes

POST validates anchor portal match, creates plan + creator invitee row atomically,
bulk-invites optional guests. GET filters by scope (mine/friends) + status
(upcoming/active/past) + optional anchor filter. RLS does friend-graph lift.
"
```

### Task 1.14: Create `/api/plans/[id]/route.ts` — GET / PATCH / DELETE

**Files:**
- Create: `web/app/api/plans/[id]/route.ts`
- Create: `web/app/api/plans/[id]/route.test.ts`

- [ ] **Step 1: Write failing tests** (follow pattern from Task 1.13; test GET returns plan+invitees+anchor, PATCH updates, DELETE soft-cancels)

- [ ] **Step 2: Run tests — expect fail**

- [ ] **Step 3: Implement the route**

`web/app/api/plans/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuthAndParams } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const runtime = "nodejs";

const PatchSchema = z.object({
  title: z.string().max(140).nullable().optional(),
  note: z.string().max(280).nullable().optional(),
  visibility: z.enum(["private", "friends", "public"]).optional(),
  starts_at: z.string().datetime().optional(),
  status: z.enum(["active", "ended", "cancelled"]).optional(),
});

const ParamsSchema = z.object({ id: z.string().uuid() });

export const GET = withAuthAndParams(
  { params: ParamsSchema },
  async (request, { serviceClient, validated: { params } }) => {
    const rl = applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
    if (rl) return rl;

    // Fetch plan
    const { data: plan, error: pErr } = await serviceClient
      .from("plans")
      .select("*")
      .eq("id", params.id as never)
      .maybeSingle();
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const p = plan as {
      id: string;
      anchor_type: "event" | "place" | "series";
      anchor_event_id: number | null;
      anchor_place_id: number | null;
      anchor_series_id: string | null;
    };

    // Expand anchor
    const anchor: Record<string, unknown> = {};
    if (p.anchor_type === "event" && p.anchor_event_id) {
      const { data } = await serviceClient.from("events")
        .select("id, title, start_date, image_url")
        .eq("id", p.anchor_event_id as never).maybeSingle();
      anchor.event = data;
    } else if (p.anchor_type === "place" && p.anchor_place_id) {
      const { data } = await serviceClient.from("places")
        .select("id, name, slug, image_url, neighborhood")
        .eq("id", p.anchor_place_id as never).maybeSingle();
      anchor.place = data;
    } else if (p.anchor_type === "series" && p.anchor_series_id) {
      const { data } = await serviceClient.from("series")
        .select("id, title, slug")
        .eq("id", p.anchor_series_id as never).maybeSingle();
      anchor.series = data;
    }

    // Fetch invitees + profiles
    const { data: invRaw } = await serviceClient
      .from("plan_invitees")
      .select("plan_id, user_id, rsvp_status, invited_by, invited_at, responded_at, seen_at")
      .eq("plan_id", params.id as never);
    const inv = (invRaw as Array<{ user_id: string }> | null) ?? [];
    const userIds = inv.map((i) => i.user_id);
    const { data: profRaw } = await serviceClient
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", userIds as never);
    const profiles = (profRaw as Array<{ id: string }> | null) ?? [];
    const pMap = new Map(profiles.map((p) => [p.id, p]));
    const invitees = inv.map((i) => ({ ...i, profile: pMap.get(i.user_id) ?? null }));

    return NextResponse.json({ plan, anchor, invitees });
  }
);

export const PATCH = withAuthAndParams(
  { params: ParamsSchema, body: PatchSchema },
  async (request, { user, serviceClient, validated }) => {
    const rl = applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
    if (rl) return rl;

    const { params, body } = validated;

    // Only creator can update
    const { data: existing } = await serviceClient
      .from("plans").select("creator_id, status").eq("id", params.id as never).maybeSingle();
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const e = existing as { creator_id: string; status: string };
    if (e.creator_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Status-transition validation
    const updates: Record<string, unknown> = { updated_by: user.id };
    if (body.title !== undefined) updates.title = body.title;
    if (body.note !== undefined) updates.note = body.note;
    if (body.visibility) updates.visibility = body.visibility;
    if (body.starts_at) updates.starts_at = body.starts_at;

    if (body.status) {
      const valid: Record<string, string[]> = {
        planning: ["active", "cancelled"],
        active: ["ended", "cancelled"],
      };
      if (!valid[e.status]?.includes(body.status)) {
        return NextResponse.json(
          { error: `Invalid transition ${e.status} -> ${body.status}` },
          { status: 400 }
        );
      }
      updates.status = body.status;
      if (body.status === "active") updates.started_at = new Date().toISOString();
      if (body.status === "ended") updates.ended_at = new Date().toISOString();
      if (body.status === "cancelled") updates.cancelled_at = new Date().toISOString();
    }

    const { error: uErr } = await serviceClient
      .from("plans").update(updates as never).eq("id", params.id as never);
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
);

export const DELETE = withAuthAndParams(
  { params: ParamsSchema },
  async (request, { user, serviceClient, validated: { params } }) => {
    const rl = applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
    if (rl) return rl;

    const { data: existing } = await serviceClient
      .from("plans").select("creator_id").eq("id", params.id as never).maybeSingle();
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if ((existing as { creator_id: string }).creator_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Soft cancel
    const { error: cErr } = await serviceClient
      .from("plans")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        updated_by: user.id,
      } as never)
      .eq("id", params.id as never);
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
);
```

- [ ] **Step 4: Run tests — expect pass**

- [ ] **Step 5: Commit**

```bash
git add web/app/api/plans/[id]/
git commit -m "feat(api/plans): [id] route — GET (detail) / PATCH (update) / DELETE (cancel)"
```

### Task 1.15: Create invitee routes

**Files:**
- Create: `web/app/api/plans/[id]/invitees/route.ts` (POST bulk invite)
- Create: `web/app/api/plans/[id]/invitees/me/route.ts` (PATCH self-respond)
- Create: `web/app/api/plans/[id]/invitees/me/seen/route.ts` (PATCH mark seen)
- Create: `web/app/api/plans/[id]/invitees/[userId]/route.ts` (DELETE uninvite or leave)
- Create test files for each.

- [ ] **Step 1: Write failing tests for each route**

(Test the happy paths + authz failures. Pattern matches Tasks 1.13–1.14.)

- [ ] **Step 2: Run tests — expect fail**

- [ ] **Step 3: Implement `invitees/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuthAndParams } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

const BodySchema = z.object({ user_ids: z.array(z.string().uuid()).min(1).max(50) });
const ParamsSchema = z.object({ id: z.string().uuid() });

export const POST = withAuthAndParams(
  { params: ParamsSchema, body: BodySchema },
  async (request, { user, serviceClient, validated }) => {
    const rl = applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
    if (rl) return rl;

    // Creator gate
    const { data: plan } = await serviceClient
      .from("plans").select("creator_id").eq("id", validated.params.id as never).maybeSingle();
    if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if ((plan as { creator_id: string }).creator_id !== user.id)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const rows = validated.body.user_ids
      .filter((uid) => uid !== user.id)
      .map((uid) => ({
        plan_id: validated.params.id,
        user_id: uid,
        rsvp_status: "invited" as const,
        invited_by: user.id,
      }));
    if (!rows.length) return NextResponse.json({ ok: true, inserted: 0 });

    const { error } = await serviceClient
      .from("plan_invitees").insert(rows as never);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, inserted: rows.length });
  }
);
```

- [ ] **Step 4: Implement `invitees/me/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuthAndParams } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

const BodySchema = z.object({
  rsvp_status: z.enum(["going", "maybe", "declined"]),
});
const ParamsSchema = z.object({ id: z.string().uuid() });

export const PATCH = withAuthAndParams(
  { params: ParamsSchema, body: BodySchema },
  async (request, { user, serviceClient, validated }) => {
    const rl = applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
    if (rl) return rl;

    const { error } = await serviceClient
      .from("plan_invitees")
      .update({
        rsvp_status: validated.body.rsvp_status,
        responded_at: new Date().toISOString(),
      } as never)
      .eq("plan_id", validated.params.id as never)
      .eq("user_id", user.id as never);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
);
```

- [ ] **Step 5: Implement `invitees/me/seen/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuthAndParams } from "@/lib/api-middleware";

const ParamsSchema = z.object({ id: z.string().uuid() });

export const PATCH = withAuthAndParams(
  { params: ParamsSchema },
  async (_request, { user, serviceClient, validated }) => {
    const { error } = await serviceClient
      .from("plan_invitees")
      .update({ seen_at: new Date().toISOString() } as never)
      .eq("plan_id", validated.params.id as never)
      .eq("user_id", user.id as never)
      .is("seen_at", null as never);  // idempotent — only set if still null
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
);
```

- [ ] **Step 6: Implement `invitees/[userId]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuthAndParams } from "@/lib/api-middleware";

const ParamsSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
});

export const DELETE = withAuthAndParams(
  { params: ParamsSchema },
  async (_request, { user, serviceClient, validated }) => {
    const { params } = validated;

    // Authz: creator can remove anyone; user can remove themselves
    if (params.userId !== user.id) {
      const { data } = await serviceClient
        .from("plans").select("creator_id").eq("id", params.id as never).maybeSingle();
      if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if ((data as { creator_id: string }).creator_id !== user.id)
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Creator cannot be removed via this route (delete the plan instead)
    const { data: plan } = await serviceClient
      .from("plans").select("creator_id").eq("id", params.id as never).maybeSingle();
    if (plan && (plan as { creator_id: string }).creator_id === params.userId) {
      return NextResponse.json({ error: "Cannot remove creator; cancel the plan instead" }, { status: 400 });
    }

    const { error } = await serviceClient
      .from("plan_invitees")
      .delete()
      .eq("plan_id", params.id as never)
      .eq("user_id", params.userId as never);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
);
```

- [ ] **Step 7: Run all invitee tests — expect pass**

- [ ] **Step 8: Commit**

```bash
git add web/app/api/plans/[id]/invitees/
git commit -m "feat(api/plans): invitee routes — invite / respond / seen / uninvite"
```

### Task 1.16: Create `/api/plans/shared/[token]` route (public)

**Files:**
- Create: `web/app/api/plans/shared/[token]/route.ts`

- [ ] **Step 1: Implement with dedicated rate-limit bucket + constant-time 404**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const runtime = "nodejs";

const ParamsSchema = z.object({ token: z.string().length(24) });  // 12-byte hex = 24 chars

// Dedicated tight bucket — token enumeration should not use the generic read budget.
const SHARE_BUCKET = { requests: 20, windowMs: 60_000 };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const rl = applyRateLimit(request, SHARE_BUCKET, `plan-share:${getClientIdentifier(request)}`);
  if (rl) return rl;

  const resolved = await params;
  const parsed = ParamsSchema.safeParse(resolved);
  if (!parsed.success) {
    // Constant-time 404 on malformed token — don't leak validity signal
    await new Promise((r) => setTimeout(r, 30));
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const service = createServiceClient();
  const { data: plan } = await service
    .from("plans")
    .select("*")
    .eq("share_token", parsed.data.token as never)
    .maybeSingle();

  if (!plan) {
    await new Promise((r) => setTimeout(r, 30));
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const p = plan as { id: string; visibility: string; creator_id: string };

  // Auth check: public OR friends-with-link OR invited
  let allowed = p.visibility === "public" || p.visibility === "friends";
  if (!allowed) {
    // Private — token alone not enough; check if requester is invited
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: invite } = await service
        .from("plan_invitees")
        .select("user_id")
        .eq("plan_id", p.id as never)
        .eq("user_id", user.id as never)
        .maybeSingle();
      allowed = !!invite;
    }
  }

  if (!allowed) {
    await new Promise((r) => setTimeout(r, 30));
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Return plan (anchor expansion done client-side or repeated server-side — use same pattern as /api/plans/[id])
  return NextResponse.json({ plan });
}
```

- [ ] **Step 2: Test**

```bash
cd web && npx vitest run app/api/plans/shared/
```

- [ ] **Step 3: Commit**

```bash
git add web/app/api/plans/shared/
git commit -m "feat(api/plans): public shared-link route with enumeration hardening"
```

### Task 1.17: Create `useUserPlans.ts` hook module

**Files:**
- Create: `web/lib/hooks/useUserPlans.ts`
- Create: `web/lib/hooks/useUserPlans.test.ts`

- [ ] **Step 1: Write failing tests** (happy paths for each exported hook)

- [ ] **Step 2: Run tests — expect fail**

- [ ] **Step 3: Implement the hook module**

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import type {
  Plan, PlanWithDetail, CreatePlanRequest, UpdatePlanRequest, RsvpStatus,
  EventPlansAggregate, PlacePlansAggregate,
} from "@/lib/types/plans";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

type MyPlansArgs = { scope?: "mine" | "friends"; status?: "upcoming" | "active" | "past" };

export function useMyPlans(args: MyPlansArgs = {}) {
  const { user } = useAuth();
  const scope = args.scope ?? "mine";
  const status = args.status ?? "upcoming";
  return useQuery<{ plans: Plan[] }>({
    queryKey: ["plans", "list", scope, status, user?.id ?? null],
    enabled: !!user,
    queryFn: async () => {
      const res = await fetch(`/api/plans?scope=${scope}&status=${status}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`Plans list failed (${res.status})`);
      return res.json();
    },
  });
}

export function usePlan(id: string | null) {
  return useQuery<{ plan: Plan; anchor: unknown; invitees: unknown[] }>({
    queryKey: ["plans", "detail", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`/api/plans/${id}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`Plan detail failed (${res.status})`);
      return res.json();
    },
  });
}

export function useEventPlans(eventId: number | null) {
  return useQuery<EventPlansAggregate>({
    queryKey: ["plans", "event-aggregate", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const res = await fetch(`/api/plans?anchor_event_id=${eventId}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`Event plans aggregate failed (${res.status})`);
      const body = (await res.json()) as { plans: Plan[] };
      // TODO: compute going_count + friend_going_count via server aggregate endpoint (Phase 4)
      return { going_count: body.plans.length, friend_going_count: 0 };
    },
  });
}

export function usePlacePlans(placeId: number | null) {
  return useQuery<PlacePlansAggregate>({
    queryKey: ["plans", "place-aggregate", placeId],
    enabled: !!placeId,
    queryFn: async () => {
      const res = await fetch(`/api/plans?anchor_place_id=${placeId}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`Place plans aggregate failed (${res.status})`);
      const body = (await res.json()) as { plans: Plan[] };
      const active = body.plans.filter((p) => p.status === "active");
      return { active_count: active.length, friends_here: [] };
    },
  });
}

export function useActivePlans(portalId: string | null) {
  const { user } = useAuth();
  return useQuery<{ plans: Plan[] }>({
    queryKey: ["plans", "active", portalId, user?.id ?? null],
    enabled: !!user && !!portalId,
    queryFn: async () => {
      const res = await fetch(`/api/plans?scope=mine&status=active`, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`Active plans failed (${res.status})`);
      return res.json();
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation<{ plan: { id: string; share_token: string } }, Error, CreatePlanRequest>({
    mutationFn: async (input) => {
      const res = await fetch("/api/plans", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
    },
  });
}

export function useUpdatePlan(id: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, UpdatePlanRequest>({
    mutationFn: async (input) => {
      const res = await fetch(`/api/plans/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
    },
  });
}

export function useCancelPlan(id: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const res = await fetch(`/api/plans/${id}`, { method: "DELETE", credentials: "same-origin" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plans"] }),
  });
}

export function useInviteToPlan(id: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, { user_ids: string[] }>({
    mutationFn: async (input) => {
      const res = await fetch(`/api/plans/${id}/invitees`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plans", "detail", id] }),
  });
}

export function useRespondToPlan(id: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, { rsvp_status: Exclude<RsvpStatus, "invited"> }>({
    mutationFn: async (input) => {
      const res = await fetch(`/api/plans/${id}/invitees/me`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plans"] }),
  });
}

export function useMarkPlanSeen(id: string) {
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await fetch(`/api/plans/${id}/invitees/me/seen`, { method: "PATCH", credentials: "same-origin" });
    },
  });
}
```

- [ ] **Step 4: Run tests — expect pass**

- [ ] **Step 5: Commit**

```bash
git add web/lib/hooks/useUserPlans.ts web/lib/hooks/useUserPlans.test.ts
git commit -m "feat(hooks): useUserPlans — unified plans hook module

Replaces useHangs, useItinerary, useItineraryCrew, useFriendPlans, old usePlans.
Exports: useMyPlans, usePlan, useEventPlans, usePlacePlans, useActivePlans,
useCreatePlan, useUpdatePlan, useCancelPlan, useInviteToPlan, useRespondToPlan,
useMarkPlanSeen.
"
```

### Task 1.18: Add `ENABLE_PLANS_V1` flag + remove `ENABLE_HANGS_V1`

**Files:**
- Modify: `web/lib/launch-flags.ts`
- Modify: `web/components/RSVPButton.tsx` (remove guard)
- Modify: `web/components/community/CommunityHub.tsx` (remove guard)
- Modify: `web/lib/city-pulse/manifests/atlanta.tsx` (remove `hangs` entry + flag use)
- Modify: `.env.example`

- [ ] **Step 1: Update `launch-flags.ts`**

```typescript
// Replace the ENABLE_HANGS_V1 block with:
// NEXT_PUBLIC_ prefix required: checked in client components (plans feature).
export const ENABLE_PLANS_V1 =
  process.env.NEXT_PUBLIC_ENABLE_PLANS_V1 === "true" ||
  process.env.ENABLE_PLANS_V1 === "true";
```

Remove the `ENABLE_HANGS_V1` export entirely.

- [ ] **Step 2: Grep + remove all `ENABLE_HANGS_V1` references**

```bash
grep -rn "ENABLE_HANGS_V1" web/ --include='*.ts' --include='*.tsx'
```

Remove each occurrence. Most are `if (ENABLE_HANGS_V1)` guards — strip the guard, keep the content (or delete content if it's hangs-specific). In the feed manifest, remove the entire `hangs` section entry.

- [ ] **Step 3: Update `.env.example`**

```diff
- ENABLE_HANGS_V1=false
- NEXT_PUBLIC_ENABLE_HANGS_V1=false
+ ENABLE_PLANS_V1=false
+ NEXT_PUBLIC_ENABLE_PLANS_V1=false
```

- [ ] **Step 4: Verify TypeScript + tests**

```bash
cd web && npx tsc --noEmit && npx vitest run
```

Expected: all pass (tests for plans API routes already use the flag via process env).

- [ ] **Step 5: Commit**

```bash
git add web/lib/launch-flags.ts web/components/RSVPButton.tsx web/components/community/CommunityHub.tsx web/lib/city-pulse/manifests/atlanta.tsx .env.example
git commit -m "feat(flags): replace ENABLE_HANGS_V1 with ENABLE_PLANS_V1

Flag rotation + dead-code cull in same commit. Removes hangs entry from
atlanta feed manifest. HangFeedSection deleted in Phase 3 component rename.
"
```

### Task 1.18b: Create future multi-stop `.sql.draft` scaffolding

**Files:**
- Create: `database/migrations/_draft_plan_stops.sql.draft`
- Create: `database/migrations/_draft_plan_stop_invitees.sql.draft`
- Create: `database/migrations/_draft_README.md`

- [ ] **Step 1: Write `_draft_README.md`**

```markdown
# Draft migrations (not applied)

These `.sql.draft` files are future scaffolding committed for visibility,
not applied by the migration runner.

## Activation

When the product decides to ship multi-stop plans / voting-on-location
(per spec Section 5 item 4), review the draft SQL, promote to numbered
migrations via `python3 database/create_migration_pair.py plan_stops`,
and apply.

## Files

- `_draft_plan_stops.sql.draft` — stops-within-a-plan table
- `_draft_plan_stop_invitees.sql.draft` — per-stop invitee RSVP
```

- [ ] **Step 2: Write `_draft_plan_stops.sql.draft`**

```sql
-- DRAFT — not applied. See _draft_README.md for activation instructions.
-- Purpose: multi-stop plans (bar crawls, day trips). Each plan can have 1..N stops.

CREATE TABLE plan_stops (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id       uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  sort_order    integer NOT NULL,
  anchor_event_id  integer REFERENCES events(id) ON DELETE SET NULL,
  anchor_place_id  integer REFERENCES places(id) ON DELETE SET NULL,
  starts_at     timestamptz,
  title         text CHECK (length(title) <= 140),
  note          text CHECK (length(note) <= 280),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, sort_order)
);

CREATE INDEX idx_plan_stops_plan ON plan_stops (plan_id, sort_order);
```

- [ ] **Step 3: Write `_draft_plan_stop_invitees.sql.draft`**

```sql
-- DRAFT — not applied. See _draft_README.md for activation instructions.
-- Purpose: per-stop RSVP (invitee can go to stops 1+2 but skip stop 3).

CREATE TABLE plan_stop_invitees (
  stop_id       uuid NOT NULL REFERENCES plan_stops(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rsvp_status   text NOT NULL DEFAULT 'invited'
    CHECK (rsvp_status IN ('invited','going','maybe','declined')),
  responded_at  timestamptz,
  PRIMARY KEY (stop_id, user_id)
);
```

- [ ] **Step 4: Commit**

```bash
git add database/migrations/_draft_*
git commit -m "scaffold(plans): draft SQL for future multi-stop / voting feature

Not applied. Committed as visibility artifact — activating multi-stop is a
two-hour promote-and-number job per spec Section 5 item 4.
"
```

### Task 1.18c: Add `auto_expire` sweep job

**Files:**
- Create: `web/app/api/cron/plans-expire/route.ts`

Per spec Section 1: plans that pass `starts_at + 6h` without being started should transition to `status = 'expired'`. Computed in a background sweep (avoids stored-value drift).

- [ ] **Step 1: Implement the cron route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // Auth: expect CRON_SECRET header (matches existing LostCity cron pattern — verify via grep)
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();

  // Transition planning/active → expired where starts_at + 6h < now and status not already terminal
  const { data, error } = await service.rpc("expire_stale_plans" as never);
  if (error) {
    logger.error({ error: error.message }, "plans-expire sweep failed");
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const count = (data as { expired_count: number } | null)?.expired_count ?? 0;
  logger.info({ count }, "plans-expire sweep complete");
  return NextResponse.json({ expired: count });
}
```

- [ ] **Step 2: Add the RPC function to migration 617** (append before COMMIT):

```sql
-- ----------------------------------------------------------------------------
-- 9. Sweep function — transition stale plans to 'expired'
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION expire_stale_plans()
RETURNS TABLE (expired_count integer) AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE plans
     SET status = 'expired',
         updated_at = now()
   WHERE status IN ('planning', 'active')
     AND starts_at + interval '6 hours' < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

- [ ] **Step 3: Schedule the cron**

Check existing LostCity cron configuration (`vercel.json`, `.github/workflows/`, or Supabase cron). Add a 15-minute schedule for `POST /api/cron/plans-expire` with `x-cron-secret: ${CRON_SECRET}`.

- [ ] **Step 4: Test**

```bash
cd web && npx vitest run app/api/cron/plans-expire/
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(cron): plans-expire sweep job

Transitions planning/active plans older than starts_at+6h to 'expired'.
Runs every 15 minutes. Replaces the stored auto_expire_at column (spec
decision: computed not stored).
"
```

### Task 1.19: Rewrite `event_rsvps` consumers

**Files:** per `docs/consolidation-event-rsvps-callers.md`.

For each file marked `REWRITE`, execute tasks 1.19.a–z (one per file) in parallel subagents using the subagent-driven-development pattern. Each sub-task:

- [ ] **Per-file template:**
  - Read the file
  - Identify every `event_rsvps` reference
  - Rewrite to use either:
    - `/api/plans?anchor_event_id=X` for event-card aggregates
    - Direct `plan_invitees` + `plans` join for admin/analytics reads
    - `useUserPlans.ts` hook for component reads
  - Run `npx tsc --noEmit`; fix type errors
  - Commit with message: `refactor(rsvps): migrate <file> to plans model`

For each file marked `VERIFY`, read it, confirm it only checks `status = 'going'` (the one enum value that survives the view), add a comment flagging the compat-view dependency, commit.

Expect ~30+ commits here; the subagent-driven-development skill is the right choice to parallelize.

- [ ] **Step 1: Dispatch subagents (one per REWRITE file)**
- [ ] **Step 2: Wait for all to complete; review each**
- [ ] **Step 3: Update `docs/consolidation-event-rsvps-callers.md`** — check off completed entries
- [ ] **Step 4: Run full test suite + typecheck**

```bash
cd web && npx tsc --noEmit && npx vitest run
```

- [ ] **Step 5: Commit tracking update**

### Task 1.20: Rewrite `web/app/plans/page.tsx` + `[id]/page.tsx`

**Files:**
- Modify: `web/app/plans/page.tsx`
- Modify: `web/app/plans/[id]/page.tsx`

These pages currently query `plan_items` / `plan_participants` directly. After migration 617 drops those tables, these pages 500. Rewrite to use `useMyPlans` + `usePlan`.

- [ ] **Step 1: Read each current page; identify queries**

```bash
cat web/app/plans/page.tsx
cat web/app/plans/[id]/page.tsx
```

- [ ] **Step 2: Rewrite `page.tsx` as a thin client component calling `useMyPlans`**

(See existing `my-plans` spec components — `PlansHeader`, `PlansAgenda` — these already exist from Task 1 of that spec. Wire them to `useMyPlans` from `useUserPlans.ts`.)

- [ ] **Step 3: Rewrite `[id]/page.tsx` calling `usePlan(params.id)`**

- [ ] **Step 4: Browser-test dev server**

```bash
cd web && npm run dev
# In another terminal: curl localhost:3000/plans, /plans/<id>
```

Expected: both load without 500, show data (or clean empty states).

- [ ] **Step 5: Commit**

```bash
git add web/app/plans/
git commit -m "refactor(plans-pages): rewrite /plans and /plans/[id] for unified model"
```

### Task 1.21: Phase 1 checkpoint — full CI + merge to main

- [ ] **Step 1: Run full quality suite**

```bash
cd web && npm run lint && npx tsc --noEmit && npx vitest run
cd ../database && python3 audit_migration_parity.py --fail-on-unmatched
```

Expected: all green.

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat(plans): consolidate social coordination — Phase 1 foundation" --body "$(cat <<'EOF'
## Summary
Phase 1 of the social-coordination consolidation (spec: docs/superpowers/specs/2026-04-18-social-coordination-consolidation-design.md).

- Migration 617: drops hangs/itineraries/dormant-plans/event_rsvps, creates plans + plan_invitees
- New /api/plans routes (CRUD + invitees + shared)
- New useUserPlans hook module
- event_rsvps read-compat view keeps existing consumers live during expand-contract
- ENABLE_HANGS_V1 rotated to ENABLE_PLANS_V1
- All 39 event_rsvps consumer files rewritten or verified per docs/consolidation-event-rsvps-callers.md

## Test plan
- [x] Unit tests green
- [x] tsc clean
- [x] Migration parity audit passes
- [ ] Smoke test: create plan via POST /api/plans, verify creator is going invitee, verify event_rsvps view shows 'going' row
- [ ] Smoke test: load /plans page (empty state), /plans/[id] not-found
- [ ] Smoke test: RSVP to an event, verify plan exists
EOF
)"
```

- [ ] **Step 3: Land PR (user gate)**

Phase 1 is the foundation. Do not proceed to Phase 2 until this PR is merged to main and prod deploy is healthy for 24h.

---

## Phase 2 — RSVP compat rewrite + legacy hook deletion

**Entry criteria:** Phase 1 merged + prod stable.

### Task 2.1: Rewrite `/api/rsvp/route.ts` to proxy to plans

**Files:**
- Modify: `web/app/api/rsvp/route.ts`

- [ ] **Step 1: Read current file**

```bash
cat web/app/api/rsvp/route.ts
```

- [ ] **Step 2: Rewrite POST/GET/DELETE to call plans service**

Replace the body of each handler to:
- **POST** — read `{event_id, status}`; if `status==='going'`, call `/api/plans` create logic (same request shape, synthetic input) with `anchor_type='event'`, `anchor_id=event_id`, solo. Otherwise (interested/not_going), reject with 400 + `Deprecated: use /api/plans` message (no bookmark replacement in this spec).
- **GET** — read plans via `event_rsvps` view (same as before — view is compat).
- **DELETE** — find plan for user+event, soft-cancel.
- **Every handler logs a deprecation warning:**
  ```typescript
  logger.warn({
    route: "/api/rsvp",
    method: request.method,
    caller: request.headers.get("referer"),
    ua: request.headers.get("user-agent"),
  }, "deprecated route: /api/rsvp");
  ```

- [ ] **Step 3: Update tests to verify deprecation-log instrumentation**

- [ ] **Step 4: Run tests**

- [ ] **Step 5: Commit**

```bash
git commit -am "refactor(rsvp): proxy /api/rsvp to plans service + add deprecation log

/api/rsvp retained as compat shim. Internally delegates to plans create/read/cancel
paths. Every call logs WARN with caller identity for Phase 7 verification gate.
"
```

### Task 2.2: Delete legacy hooks

**Files (delete):**
- `web/lib/hooks/useHangs.ts`
- `web/lib/hooks/useItinerary.ts`
- `web/lib/hooks/useItineraryCrew.ts`
- `web/lib/hooks/useFriendPlans.ts`
- `web/lib/hooks/usePlans.ts` (old — already replaced by useUserPlans.ts)

- [ ] **Step 1: Grep for remaining imports**

```bash
grep -rn "from.*@/lib/hooks/useHangs\|@/lib/hooks/useItinerary\|@/lib/hooks/useFriendPlans\|@/lib/hooks/usePlans'" web/
```

Expected: some hits in components that haven't been rewritten yet. Rewrite them or flag them for Phase 3 rename.

- [ ] **Step 2: Delete files**

```bash
rm web/lib/hooks/useHangs.ts web/lib/hooks/useItinerary.ts web/lib/hooks/useItineraryCrew.ts web/lib/hooks/useFriendPlans.ts web/lib/hooks/usePlans.ts
```

- [ ] **Step 3: Verify no orphaned imports**

```bash
cd web && npx tsc --noEmit
```

Expected: pass OR errors only in files that Phase 3 will rename (acceptable; fix in Phase 3).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(hooks): delete legacy social-coordination hooks

All five replaced by web/lib/hooks/useUserPlans.ts.
"
```

### Task 2.3: Phase 2 checkpoint

- [ ] PR, review, land. Prod stable for 24h before Phase 3.

---

## Phase 3 — UI quick wins (rename + unbury)

**Entry criteria:** Phase 2 merged + prod stable.

### Task 3.1: Track A — Rename `components/hangs/` → `components/plans/`

**Purpose:** Merge hang components into the `components/plans/` directory that already exists from my-plans Task 1. Remove the feed-manifest entry for hangs in the same commit (absorbed-former-Track-D).

- [ ] **Step 1: Create target directory if not already present**

```bash
ls web/components/plans/ || mkdir -p web/components/plans/
```

- [ ] **Step 2: Verify no filename collisions**

```bash
ls web/components/hangs/
ls web/components/plans/
```

Existing plans/ files (from my-plans Task 1): `PlanCard.tsx`, `PlanCreator.tsx`, `PlanDetailView.tsx`, `PlanInviteSheet.tsx`, `PlansAgenda.tsx`, `PlansHeader.tsx`, etc. Incoming hangs/ renames: `PlanCTA`, `PlacePlansStrip`, `PlacePlansStripLive`, `ActivePlanBanner`, `PlanSheet`, `PostRsvpInviteNudge`. **No collisions** confirmed by spec.

- [ ] **Step 3: Rename + edit each component**

For each hang component, perform:
- Move file
- Rename exports
- Replace `useHangs`/`useItinerary`/etc. imports with `useUserPlans` equivalents
- Replace `Hang*` types with `Plan*` types from `@/lib/types/plans`

Example for `HangButton.tsx` → `PlanCTA.tsx`:

```bash
git mv web/components/hangs/HangButton.tsx web/components/plans/PlanCTA.tsx
```

Then edit:
- Rename `HangButton` → `PlanCTA`, `HangButtonProps` → `PlanCTAProps`
- Import `useCreatePlan` instead of the hang-creation hook
- Update all prop types to `Plan*` equivalents

Repeat for each:
- `HangButton.tsx` → `PlanCTA.tsx`
- `PlaceHangStrip.tsx` → `PlacePlansStrip.tsx`
- `PlaceHangStripLive.tsx` → `PlacePlansStripLive.tsx`
- `ActiveHangBanner.tsx` → `ActivePlanBanner.tsx`
- `HangSheet.tsx` → `PlanSheet.tsx`
- `PostRsvpHangPrompt.tsx` → `PostRsvpInviteNudge.tsx` **(behavioral rewrite — see Task 3.1.f)**

- [ ] **Step 3.f: `PostRsvpHangPrompt` → `PostRsvpInviteNudge` behavioral rewrite**

Not just a rename. Changes:
- Replace `HangSheet` child with new `PlanSheet` with `showInvitePicker=true`
- localStorage dedup key: `rsvp_hang_prompt_dismissed_${eventId}` → `rsvp_plan_invite_nudge_dismissed_${eventId}` (no migration of old keys — previously-dismissed users see the nudge once more, acceptable)
- Simplify to "optional nudge toast" pattern (see Pencil comp reference once designed; for now use existing toast styling until verified)
- Trigger: appears 500ms after RSVP succeeds, auto-dismisses after 8s if untouched

Accepted: `PostRsvpInviteNudge.test.tsx` should assert localStorage key format + dismissal persists.

- [ ] **Step 4: Delete `components/hangs/` directory + legacy files**

```bash
rm web/components/hangs/HangShareCard.tsx  # renamed to PlanShareCard or merged into PlanShareFlow
rm web/components/hangs/HangShareFlow.tsx
rmdir web/components/hangs/ || true
rm web/components/feed/sections/HangFeedSection.tsx
```

- [ ] **Step 5: Remove `hangs` entry from feed manifest (absorbed Track D)**

`web/lib/city-pulse/manifests/atlanta.tsx`: delete the section object with `id: "hangs"` + the `HangFeedSection` dynamic import at the top.

- [ ] **Step 6: Fix all importers**

```bash
grep -rn "@/components/hangs\|HangButton\|PlaceHangStrip\|ActiveHangBanner\|HangSheet\|PostRsvpHangPrompt\|HangFeedSection" web/ --include='*.ts' --include='*.tsx'
```

For each hit, update the import to the new `@/components/plans/` path + new symbol name.

- [ ] **Step 7: Typecheck + test**

```bash
cd web && npx tsc --noEmit && npx vitest run
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(plans): rename components/hangs/ → components/plans/

- HangButton → PlanCTA
- PlaceHangStrip[Live] → PlacePlansStrip[Live]
- ActiveHangBanner → ActivePlanBanner
- HangSheet → PlanSheet
- PostRsvpHangPrompt → PostRsvpInviteNudge (behavioral rewrite)
- Hang share components deleted
- HangFeedSection deleted; hangs entry removed from atlanta manifest
"
```

### Task 3.2: Track B — Wire `ActivePlanBanner` into CommunityHub

**Files:**
- Modify: `web/components/community/CommunityHub.tsx`

- [ ] **Step 1: Read current CommunityHub usage of `ActiveHangBanner`**
- [ ] **Step 2: Replace with `ActivePlanBanner` + `useActivePlans` hook**
- [ ] **Step 3: Verify via dev server**

```bash
cd web && npm run dev
# Navigate to /community — banner should render for users with an active plan
```

- [ ] **Step 4: Commit**

### Task 3.3: Track C — Wire `PlacePlansStripLive` onto place detail page

**Purpose:** This single wiring is the core of "unbury the feature." `PlaceHangStripLive` was built, never imported anywhere. This task finally ships it.

**Files:**
- Modify: `web/app/[portal]/spots/[id]/page.tsx` (or current place detail route — verify path)

- [ ] **Step 1: Find the place detail page**

```bash
find web/app -name "page.tsx" -path "*/spots/*" -o -path "*/places/*" 2>/dev/null | head -5
```

- [ ] **Step 2: Add `<PlacePlansStripLive placeId={place.id} />` to the page**

Location: after the hero, before the exhibitions/events sections. Check spec Section 3 surface map.

- [ ] **Step 3: Verify in browser**

```bash
cd web && npm run dev
# Navigate to a /spots/[id] page — the strip should render (empty state if no active plans, "2 hanging now" if there are)
```

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(place-detail): wire PlacePlansStripLive — unburies the feature

PlaceHangStripLive was built in the hangs infrastructure but never imported
anywhere. Renamed (Phase 3.1) and finally wired onto place detail. The orphan
is home.
"
```

### Task 3.4: Phase 3 checkpoint

- [ ] PR, review, land.

---

## Phase 4 — Discovery integration (parallel tracks)

**Entry criteria:** Phase 3 merged + prod stable.

**Design-handoff gate:** Event "N going" pill + place "N hanging now" pill need comp verification. Run `/design-handoff extract` for EventCard and PlaceCard comps before implementation. Defer this phase until that's done.

### Task 4.1: Event detail — "N going" pill + "Invite friends" CTA

**Files:**
- Modify: `web/app/[portal]/events/[id]/page.tsx` (or current event detail route)
- Create: `web/components/plans/EventGoingPill.tsx`

- [ ] **Step 1: Design gate — comp reference**

Verify Pencil comp for event detail page shows the pill. If not, design it first. Spec via `/design-handoff extract`.

- [ ] **Step 2: Implement `EventGoingPill.tsx`**

Props: `{ eventId: number }`. Uses `useEventPlans(eventId)`. Renders nothing if `going_count === 0`. Renders `"N going"` pill when > 0, coral accent.

- [ ] **Step 3: Add "Invite friends" CTA button**

On event detail page, if user has a plan for this event (creator or going invitee), show "Invite friends" button → opens invite sheet (`PlanSheet` with `eventId` anchor + invite picker).

- [ ] **Step 4: Browser-test**

- [ ] **Step 5: Commit**

### Task 4.2: Feed-level batched event aggregates

**Files:**
- Modify: `web/lib/portal-feed-loader.ts`

- [ ] **Step 1: Read current feed loader, find where event list is assembled**

- [ ] **Step 2: Add single batched query joining plan_invitees to plans for all event IDs in the feed payload**

Pseudocode:
```sql
SELECT
  p.anchor_event_id AS event_id,
  COUNT(DISTINCT pi.user_id) FILTER (WHERE pi.rsvp_status = 'going') AS going_count,
  COUNT(DISTINCT pi.user_id) FILTER (WHERE pi.rsvp_status = 'going' AND are_friends($1, pi.user_id)) AS friend_going_count
FROM plan_invitees pi
JOIN plans p ON p.id = pi.plan_id
WHERE p.anchor_event_id = ANY($2::int[])
  AND p.status IN ('planning', 'active')
GROUP BY p.anchor_event_id;
```

- [ ] **Step 3: Merge aggregate data into feed events before returning**

- [ ] **Step 4: Event cards consume from feed payload directly (no per-card hook)**

Update `EventCard.tsx` to read `going_count` / `friend_going_count` from its props (set by the feed loader), not from a hook.

- [ ] **Step 5: Commit**

### Task 4.3: Place card — "N hanging now" pill

Similar pattern to 4.1 but for places, `active` status only.

- [ ] **Step 1: Comp verification**
- [ ] **Step 2: Implement `PlacePresencePill.tsx`**
- [ ] **Step 3: Wire into feed place cards (via batched aggregate)**
- [ ] **Step 4: Commit**

### Task 4.4: Post-RSVP invite nudge

(Completes the `PostRsvpInviteNudge` component from Task 3.1.f by wiring the final trigger points.)

**Files:**
- Modify: `web/components/RSVPButton.tsx`

- [ ] **Step 1: In RSVPButton, after successful POST /api/rsvp returns**
- [ ] **Step 2: Trigger `PostRsvpInviteNudge` toast after 500ms delay**
- [ ] **Step 3: Verify nudge opens `PlanSheet` with invite picker on tap**
- [ ] **Step 4: Browser-test: RSVP to event → nudge appears → tap → invite sheet**
- [ ] **Step 5: Commit**

### Task 4.5: Phase 4 checkpoint

- [ ] PR, review, land.

---

## Phase 5 — Agenda retarget + Plan detail + Anchor picker

**Entry criteria:** Phase 4 merged + prod stable.

**Design-handoff gate:** Plan detail page + Anchor picker modal need Pencil comps before build. Do not start Task 5.2 or 5.3 until comps exist.

### Task 5.1: Retarget my-plans agenda onto `useMyPlans`

**Files (modify):**
- `web/components/plans/PlansAgenda.tsx`
- `web/components/plans/AgendaEntryRow.tsx`
- `web/components/plans/FriendEntryRow.tsx`
- `web/components/plans/GapRow.tsx`
- `web/components/plans/PlanExpandableRow.tsx`
- `web/components/plans/PlansEmptyState.tsx`
- `web/components/plans/PlansHeader.tsx`
- `web/components/plans/MonthMinimap.tsx`
- `web/components/plans/MiniDayCell.tsx`

- [ ] **Step 1: Replace RSVP+series-subscription queries with `useMyPlans`**
- [ ] **Step 2: Adapt row renderers to `Plan` shape instead of RSVP shape**
- [ ] **Step 3: Preserve the agenda UX (tabs, filters, minimap)**
- [ ] **Step 4: Browser-test**
- [ ] **Step 5: Commit**

### Task 5.2: Plan detail page

**Files:**
- Modify OR create: `web/components/plans/PlanDetailView.tsx` (verify existing file from my-plans Task 1 — extend or replace)
- Modify: `web/app/plans/[id]/page.tsx` (already rewritten in Task 1.20 — this is the render target)

- [ ] **Step 1: Verify existing `PlanDetailView.tsx` — is it the same surface as this task?** If yes, extend; if no, rename existing to `PlanDetailViewLegacy` and create new.
- [ ] **Step 2: Design-handoff extract on the new Pencil comp** (node ID TBD — captured during comp design)
- [ ] **Step 3: Build the view per extracted spec**
- [ ] **Step 4: Motion spec pass via `/motion design`**
- [ ] **Step 5: `/design-handoff verify` against comp**
- [ ] **Step 6: Commit**

### Task 5.3: Anchor picker for "+" new-plan flow

**Files:**
- Create: `web/components/plans/PlanAnchorPicker.tsx`
- Modify: `web/components/plans/PlansHeader.tsx` (add `+` button)

- [ ] **Step 1: Pencil comp + spec extract**
- [ ] **Step 2: Build picker — bottom sheet with event/place search, date picker, optional invitees**
- [ ] **Step 3: Wire `+` button in PlansHeader**
- [ ] **Step 4: Motion + verify**
- [ ] **Step 5: Commit**

### Task 5.4: Phase 5 checkpoint

- [ ] PR, review, land.

---

## Phase 6 — Activation loop (shared plan page)

**Entry criteria:** Phase 5 merged + prod stable.

**Design-handoff gate:** Shared-plan page needs Pencil comp. Activation-loop critical — give this design weight per the "substance earns the invite" thesis from the spec.

### Task 6.1: Build `/plans/shared/[token]/page.tsx`

**Files:**
- Create: `web/app/plans/shared/[token]/page.tsx`

- [ ] **Step 1: Pencil comp + spec extract** (node ID TBD)
- [ ] **Step 2: Build — cold-visitor view with signup CTA, plan preview, "Sarah invited you to X"**
- [ ] **Step 3: Motion pass**
- [ ] **Step 4: Verify**
- [ ] **Step 5: Commit**

### Task 6.2: Activation instrumentation

**Files:**
- Modify: `web/app/auth/signup/page.tsx` (or equivalent)
- Modify: `web/lib/analytics/` (add share-token attribution)

- [ ] **Step 1: Capture `?via=plan-share&token=X` on the shared-plan page**
- [ ] **Step 2: Persist to session storage through signup flow**
- [ ] **Step 3: Attribute signup to the plan share on completion**
- [ ] **Step 4: Add analytics event `plan_share_signup`**
- [ ] **Step 5: Commit**

### Task 6.3: Phase 6 checkpoint

- [ ] PR, review, land.

---

## Phase 7 — Cleanup (after verification gate passes)

**Entry criteria (all three must pass):**
1. `grep -rn "event_rsvps\|/api/rsvp" web/` returns zero hits outside `/api/rsvp/route.ts` itself and the compat view SQL.
2. Production deprecation-log reports zero hits on `/api/rsvp` for 7 consecutive days.
3. `docs/consolidation-event-rsvps-callers.md` has every entry marked resolved.

### Task 7.1: Run verification gate

- [ ] **Step 1: Grep gate**

```bash
grep -rn "event_rsvps\|/api/rsvp" web/ | grep -v "^web/app/api/rsvp/route.ts\|compat"
```

Expected: no output.

- [ ] **Step 2: Check deprecation log silence**

Check Logflare / production logs for `/api/rsvp` WARN lines in the last 7 days. Expected: zero.

- [ ] **Step 3: Verify tracking doc resolved**

```bash
grep -c "^\- \[ \] REWRITE\|^\- \[ \] VERIFY" docs/consolidation-event-rsvps-callers.md
```

Expected: 0.

### Task 7.2: Remove compat shim

**Files (delete):**
- `web/app/api/rsvp/route.ts`

**Files (create — new migration):**
- `database/migrations/NNN_drop_event_rsvps_view.sql` (+ paired supabase migration)

- [ ] **Step 1: Scaffold new migration**

```bash
python3 database/create_migration_pair.py drop_event_rsvps_view
```

- [ ] **Step 2: Write SQL**

```sql
BEGIN;
DROP VIEW IF EXISTS event_rsvps;
COMMIT;
```

- [ ] **Step 3: Delete `/api/rsvp/route.ts`**

```bash
rm web/app/api/rsvp/route.ts
```

- [ ] **Step 4: Remove deprecation-log code added in Task 2.1**

- [ ] **Step 5: Regenerate database types**

- [ ] **Step 6: Typecheck + test**

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "cleanup: remove /api/rsvp compat shim + event_rsvps view

Phase 7 verification gate passed (zero deprecation-log hits for 7 days,
grep clean, all consumers migrated). Removes the last vestige of the
pre-consolidation world.
"
```

### Task 7.3: Flag default-on + follow-on flag removal

- [ ] **Step 1: Set `ENABLE_PLANS_V1=true` in prod env**

(Env change, not code change.)

- [ ] **Step 2: Wait 2–3 weeks for stability**

- [ ] **Step 3: Schedule follow-on PR removing `ENABLE_PLANS_V1` constant + all guards**

### Task 7.4: Phase 7 checkpoint

- [ ] Final PR, review, land.

---

## Self-Review Checklist

Before execution:

- [ ] Spec coverage: every section of the spec has a Phase or Task.
- [ ] Placeholder scan: no "TBD" in code blocks (comp node IDs are intentionally TBD since comps don't exist yet — design-handoff gates catch this).
- [ ] Type consistency: `Plan` shape matches between `types/plans.ts`, API routes, and hooks.
- [ ] Hook names consistent: `useMyPlans`, `usePlan`, `useEventPlans`, `usePlacePlans`, `useActivePlans`, `useCreatePlan`, `useUpdatePlan`, `useCancelPlan`, `useInviteToPlan`, `useRespondToPlan`, `useMarkPlanSeen` — same exact names in Section 2 spec and hook module.
- [ ] Phase ordering: each phase has explicit entry criteria from the previous phase.
- [ ] Checkpoint commits: every phase ends with a PR gate.
- [ ] TDD pattern: every new file has a test file in the same task.

---

## Notes for execution

**Comp-gated tasks:** Tasks 4.1, 4.3, 5.2, 5.3, 6.1 have design-handoff gates. These tasks should be dispatched only after the Pencil comp exists and `/design-handoff extract` has produced a spec. If comps are not ready when the preceding phase lands, Phase 4+ pauses — this is per the `feedback_no_comp_no_implementation.md` principle in CLAUDE.md.

**Parallelization:** Phase 1 is sequential (atomic PR). Phase 2 is small and sequential. Phase 3 Task 3.1 must land before 3.2/3.3 (file-conflict avoidance). Phase 4 tracks are parallelizable after 3 lands. Phase 5 Tasks 5.2 and 5.3 are parallelizable after 5.1. Phase 6 is sequential. Phase 7 is sequential.

**Subagent dispatch template:** per `superpowers:subagent-driven-development`. For each task, dispatch a fresh subagent with:
- Full task content (steps, code, test patterns)
- Link to spec file
- Reference to `docs/design-truth.md` + component recipes in `web/CLAUDE.md` (for UI tasks)
- Pencil node ID + extracted spec path (for UI tasks)
- Motion spec path (for motion tasks)

**Do not skip the two-stage review** between subagent tasks. Verify TypeScript + Vitest pass before dispatching the next one.
