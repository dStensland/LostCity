-- ============================================================================
-- Migration 617: Social coordination consolidation
-- ============================================================================
-- Drops hangs, itineraries*, dormant plans*, plan_notifications, event_rsvps.
-- Creates plans + plan_invitees as unified coordination object.
-- No data preservation (beta posture per spec
-- docs/superpowers/specs/2026-04-18-social-coordination-consolidation-design.md).
-- ============================================================================

BEGIN;

-- Ensure pgcrypto is available for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Drop triggers + functions referencing legacy tables
-- ----------------------------------------------------------------------------

-- Triggers on hangs
DROP TRIGGER IF EXISTS update_hangs_updated_at ON hangs;
DROP TRIGGER IF EXISTS trg_update_portal_activity ON hangs;
-- update_user_portal_activity() is only used by trg_update_portal_activity on hangs
DROP FUNCTION IF EXISTS update_user_portal_activity() CASCADE;

-- Triggers on event_rsvps
-- (event_rsvps_updated_at calls update_updated_at() which is shared — drop trigger only)
DROP TRIGGER IF EXISTS event_rsvps_updated_at ON event_rsvps;
-- (event_rsvps_activity calls create_rsvp_activity() — drop trigger explicitly before CASCADE)
DROP TRIGGER IF EXISTS event_rsvps_activity ON event_rsvps;

-- Functions dedicated to legacy tables (safe to drop after triggers are gone)
-- get_friends_active_hangs, get_venue_hang_counts, get_hot_venues, end_and_start_hang
-- all reference the hangs table and will break; drop them.
DROP FUNCTION IF EXISTS get_friends_active_hangs(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_venue_hang_counts(int[], uuid) CASCADE;
DROP FUNCTION IF EXISTS get_hot_venues(uuid, int) CASCADE;
DROP FUNCTION IF EXISTS end_and_start_hang(uuid, int, int, uuid, text, text, timestamptz) CASCADE;

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

-- ----------------------------------------------------------------------------
-- 3. Create plans table
-- ----------------------------------------------------------------------------
CREATE TABLE plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  portal_id       uuid NOT NULL REFERENCES portals(id),

  anchor_event_id   integer REFERENCES events(id) ON DELETE SET NULL,
  anchor_place_id   integer REFERENCES places(id) ON DELETE SET NULL,
  anchor_series_id  uuid    REFERENCES series(id) ON DELETE SET NULL,

  -- Generated discriminator — cannot be hand-set; derived from which anchor FK is non-null
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
    DEFAULT encode(extensions.gen_random_bytes(12), 'hex'),

  updated_by  uuid REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- Exactly one anchor FK must be non-null
  CONSTRAINT plans_exactly_one_anchor CHECK (
    (CASE WHEN anchor_event_id  IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN anchor_place_id  IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN anchor_series_id IS NOT NULL THEN 1 ELSE 0 END)
  = 1
  )
);

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

-- ----------------------------------------------------------------------------
-- 6. Triggers
-- ----------------------------------------------------------------------------

-- Auto-update updated_at on any UPDATE
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

-- Portal immutability — P0 leakage prevention
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

-- plan_invitees SELECT: self, creator of plan, or fellow invitee (must see roster for plan detail)
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

-- ----------------------------------------------------------------------------
-- 8. event_rsvps read-compat view (TEMPORARY — removed in Phase 7)
-- ----------------------------------------------------------------------------
-- IMPORTANT: enum semantics differ. Old event_rsvps.status:
--   {going, interested, not_going}
-- New plan_invitees.rsvp_status:
--   {invited, going, maybe, declined}
-- Only 'going' maps across. Readers depending on other values must be
-- rewritten BEFORE this migration runs; tracked in
-- docs/consolidation-event-rsvps-callers.md.

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

-- ----------------------------------------------------------------------------
-- 9. Sweep function — transition stale plans to 'expired'
-- ----------------------------------------------------------------------------
-- Called by /api/cron/plans-expire route (15-minute schedule).
-- Avoids storing auto_expire_at; computes expiration at sweep time.
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

COMMIT;
