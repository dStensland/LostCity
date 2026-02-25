-- Session-aware engagement model
-- Makes festival session intent explicit in RSVP data and persists calendar-save intent.

-- ============================================================================
-- 1) SESSION CONTEXT ON EVENT RSVPS
-- ============================================================================

ALTER TABLE event_rsvps
  ADD COLUMN IF NOT EXISTS engagement_target TEXT NOT NULL DEFAULT 'event',
  ADD COLUMN IF NOT EXISTS festival_id TEXT REFERENCES festivals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES series(id) ON DELETE SET NULL;

ALTER TABLE event_rsvps
  DROP CONSTRAINT IF EXISTS event_rsvps_engagement_target_check;

ALTER TABLE event_rsvps
  ADD CONSTRAINT event_rsvps_engagement_target_check
  CHECK (engagement_target IN ('event', 'festival_session'));

ALTER TABLE event_rsvps
  DROP CONSTRAINT IF EXISTS event_rsvps_session_context_check;

ALTER TABLE event_rsvps
  ADD CONSTRAINT event_rsvps_session_context_check
  CHECK (
    engagement_target <> 'festival_session'
    OR (festival_id IS NOT NULL AND program_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_event_rsvps_engagement_target
  ON event_rsvps(engagement_target);

CREATE INDEX IF NOT EXISTS idx_event_rsvps_festival_id
  ON event_rsvps(festival_id)
  WHERE festival_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_rsvps_program_id
  ON event_rsvps(program_id)
  WHERE program_id IS NOT NULL;

-- Backfill existing RSVPs with session context when the event belongs to a festival program.
UPDATE event_rsvps AS r
SET
  engagement_target = 'festival_session',
  festival_id = s.festival_id,
  program_id = s.id
FROM events AS e
JOIN series AS s ON s.id = e.series_id
WHERE r.event_id = e.id
  AND s.series_type = 'festival_program'
  AND s.festival_id IS NOT NULL;

-- Normalize all non-festival rows to the default model.
UPDATE event_rsvps AS r
SET
  engagement_target = 'event',
  festival_id = NULL,
  program_id = NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM events AS e
  JOIN series AS s ON s.id = e.series_id
  WHERE e.id = r.event_id
    AND s.series_type = 'festival_program'
    AND s.festival_id IS NOT NULL
)
  AND (
    r.engagement_target <> 'event'
    OR r.festival_id IS NOT NULL
    OR r.program_id IS NOT NULL
  );

COMMENT ON COLUMN event_rsvps.engagement_target IS 'Engagement scope: standard event or festival session';
COMMENT ON COLUMN event_rsvps.festival_id IS 'When engagement_target=festival_session, points at the parent festival';
COMMENT ON COLUMN event_rsvps.program_id IS 'When engagement_target=festival_session, points at the parent festival program (series)';

-- ============================================================================
-- 2) CALENDAR SAVE INTENT (SESSION-AWARE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_calendar_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'outlook', 'ics')),
  engagement_target TEXT NOT NULL DEFAULT 'event' CHECK (engagement_target IN ('event', 'festival_session')),
  festival_id TEXT REFERENCES festivals(id) ON DELETE SET NULL,
  program_id UUID REFERENCES series(id) ON DELETE SET NULL,
  portal_id UUID REFERENCES portals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, event_id, provider),
  CONSTRAINT event_calendar_saves_session_context_check
    CHECK (
      engagement_target <> 'festival_session'
      OR (festival_id IS NOT NULL AND program_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_event_calendar_saves_event
  ON event_calendar_saves(event_id);

CREATE INDEX IF NOT EXISTS idx_event_calendar_saves_user
  ON event_calendar_saves(user_id);

CREATE INDEX IF NOT EXISTS idx_event_calendar_saves_festival
  ON event_calendar_saves(festival_id)
  WHERE festival_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_calendar_saves_portal
  ON event_calendar_saves(portal_id)
  WHERE portal_id IS NOT NULL;

DROP TRIGGER IF EXISTS update_event_calendar_saves_updated_at ON event_calendar_saves;
CREATE TRIGGER update_event_calendar_saves_updated_at
  BEFORE UPDATE ON event_calendar_saves
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE event_calendar_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_calendar_saves_select_own ON event_calendar_saves;
CREATE POLICY event_calendar_saves_select_own
  ON event_calendar_saves
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS event_calendar_saves_insert_own ON event_calendar_saves;
CREATE POLICY event_calendar_saves_insert_own
  ON event_calendar_saves
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS event_calendar_saves_update_own ON event_calendar_saves;
CREATE POLICY event_calendar_saves_update_own
  ON event_calendar_saves
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS event_calendar_saves_delete_own ON event_calendar_saves;
CREATE POLICY event_calendar_saves_delete_own
  ON event_calendar_saves
  FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE event_calendar_saves IS 'Tracks which events users exported to calendar providers';
COMMENT ON COLUMN event_calendar_saves.engagement_target IS 'Session-aware context for calendar save intent';
COMMENT ON COLUMN event_calendar_saves.festival_id IS 'Parent festival when the saved event is a festival session';
COMMENT ON COLUMN event_calendar_saves.program_id IS 'Parent festival program (series) when the saved event is a festival session';
