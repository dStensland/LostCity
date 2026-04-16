-- Migration 604: Series subscriptions table, source column, auto-RSVP trigger
-- Part of the My Plans feature (PRD-037).
--
-- Changes:
--   1. Add `source` column to event_rsvps (distinguishes manual vs subscription-generated RSVPs)
--   2. Add `portal_id` column to event_rsvps (needed for subscription-generated RSVPs)
--   3. Create user_series_subscriptions table with RLS
--   4. Before-insert trigger that validates series type supports subscriptions
--   5. After-insert trigger on events that auto-creates RSVPs for subscribers
--   6. Guard existing create_rsvp_activity() trigger to skip subscription-sourced RSVPs
--
-- Order matters: source column must exist before the trigger guard references it.
-- portal_id on event_rsvps must exist before the auto-RSVP trigger inserts into it.

-- ─── 1. source column on event_rsvps ────────────────────────────────────────

ALTER TABLE event_rsvps
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'
  CHECK (source IN ('manual', 'subscription'));

-- ─── 2. portal_id column on event_rsvps ─────────────────────────────────────
-- Required so auto-generated subscription RSVPs carry portal attribution.
-- NULL-able for backward compat with existing manual RSVPs.

ALTER TABLE event_rsvps
  ADD COLUMN IF NOT EXISTS portal_id TEXT;

-- ─── 3. user_series_subscriptions table ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_series_subscriptions (
  user_id    UUID REFERENCES auth.users NOT NULL,
  series_id  UUID REFERENCES series(id) NOT NULL,
  portal_id  TEXT NOT NULL,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, series_id)
);

ALTER TABLE user_series_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY subs_select_own ON user_series_subscriptions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY subs_insert_own ON user_series_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY subs_delete_own ON user_series_subscriptions
  FOR DELETE USING (user_id = auth.uid());

-- ─── 4. Before-insert trigger: validate series type ─────────────────────────
-- Only recurring_show and class_series support subscriptions.

CREATE OR REPLACE FUNCTION validate_series_subscription()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM series
    WHERE id = NEW.series_id
      AND series_type IN ('recurring_show', 'class_series')
  ) THEN
    RAISE EXCEPTION 'Series type does not support subscriptions';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_series_type_before_subscribe
  BEFORE INSERT ON user_series_subscriptions
  FOR EACH ROW EXECUTE FUNCTION validate_series_subscription();

-- ─── 5. After-insert trigger on events: auto-create RSVPs for subscribers ───
-- When a new event is inserted and it belongs to a subscribed series,
-- automatically create 'going' RSVPs for all active subscribers.
-- ON CONFLICT DO NOTHING guards against duplicate RSVPs.

CREATE OR REPLACE FUNCTION auto_rsvp_for_subscribers()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.series_id IS NOT NULL AND NEW.start_date >= CURRENT_DATE THEN
    INSERT INTO event_rsvps (user_id, event_id, status, source, portal_id)
    SELECT
      s.user_id,
      NEW.id,
      'going',
      'subscription',
      s.portal_id
    FROM user_series_subscriptions s
    WHERE s.series_id = NEW.series_id
    ON CONFLICT (user_id, event_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_rsvp_on_event_insert
  AFTER INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION auto_rsvp_for_subscribers();

-- ─── 6. Guard create_rsvp_activity() trigger to skip subscription RSVPs ─────
-- Subscription-generated RSVPs are silent: they must not emit activity feed
-- entries. The WHEN clause short-circuits for source = 'subscription'.
-- We drop and recreate the trigger (the function body is unchanged).

DROP TRIGGER IF EXISTS event_rsvps_activity ON event_rsvps;

CREATE TRIGGER event_rsvps_activity
  AFTER INSERT ON event_rsvps
  FOR EACH ROW
  WHEN (NEW.source IS DISTINCT FROM 'subscription')
  EXECUTE FUNCTION create_rsvp_activity();

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_user_series_subs_user
  ON user_series_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_series_subs_series
  ON user_series_subscriptions(series_id);

CREATE INDEX IF NOT EXISTS idx_event_rsvps_source
  ON event_rsvps(source) WHERE source = 'subscription';

-- ─── Comments ────────────────────────────────────────────────────────────────

COMMENT ON TABLE user_series_subscriptions IS
  'Users subscribed to a recurring_show or class_series. New events in the series auto-create RSVPs.';

COMMENT ON COLUMN event_rsvps.source IS
  'Origin of the RSVP: manual (user action) or subscription (auto-generated from series subscription).';

COMMENT ON COLUMN event_rsvps.portal_id IS
  'Portal context for this RSVP; populated for subscription-generated RSVPs, nullable for legacy manual RSVPs.';
