-- Portal Attribution Hardening (Phase N)
-- Add portal_id columns to user activity tables that are missing attribution,
-- enabling per-portal analytics, isolation, and audit.

-- 1. hidden_events: Track which portal context a user hid an event from
ALTER TABLE hidden_events ADD COLUMN IF NOT EXISTS portal_id UUID REFERENCES portals(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_hidden_events_portal ON hidden_events(portal_id) WHERE portal_id IS NOT NULL;

-- 2. activity_reactions: Track portal context for emoji reactions on friend activity
ALTER TABLE activity_reactions ADD COLUMN IF NOT EXISTS portal_id UUID REFERENCES portals(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_activity_reactions_portal ON activity_reactions(portal_id) WHERE portal_id IS NOT NULL;

-- 3. activities: Ensure portal_id column exists for feedback/analytics writes
-- (Table may already have portal_id from previous migrations; safe to re-add with IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activities' AND column_name = 'portal_id'
  ) THEN
    ALTER TABLE activities ADD COLUMN portal_id UUID REFERENCES portals(id) ON DELETE SET NULL;
    CREATE INDEX idx_activities_portal ON activities(portal_id) WHERE portal_id IS NOT NULL;
  END IF;
END
$$;

-- 4. Attribution audit view: Daily check for missing portal context
-- Returns counts of unattributed rows per table for the last 7 days.
CREATE OR REPLACE VIEW portal_attribution_audit AS
SELECT 'inferred_preferences' AS table_name,
       COUNT(*) FILTER (WHERE portal_id IS NULL) AS missing_portal,
       COUNT(*) AS total,
       ROUND(100.0 * COUNT(*) FILTER (WHERE portal_id IS NULL) / GREATEST(COUNT(*), 1), 1) AS pct_missing
FROM inferred_preferences
WHERE created_at > NOW() - INTERVAL '7 days'

UNION ALL

SELECT 'event_rsvps',
       COUNT(*) FILTER (WHERE portal_id IS NULL),
       COUNT(*),
       ROUND(100.0 * COUNT(*) FILTER (WHERE portal_id IS NULL) / GREATEST(COUNT(*), 1), 1)
FROM event_rsvps
WHERE created_at > NOW() - INTERVAL '7 days'

UNION ALL

SELECT 'saved_items',
       COUNT(*) FILTER (WHERE portal_id IS NULL),
       COUNT(*),
       ROUND(100.0 * COUNT(*) FILTER (WHERE portal_id IS NULL) / GREATEST(COUNT(*), 1), 1)
FROM saved_items
WHERE created_at > NOW() - INTERVAL '7 days'

UNION ALL

SELECT 'follows',
       COUNT(*) FILTER (WHERE portal_id IS NULL),
       COUNT(*),
       ROUND(100.0 * COUNT(*) FILTER (WHERE portal_id IS NULL) / GREATEST(COUNT(*), 1), 1)
FROM follows
WHERE created_at > NOW() - INTERVAL '7 days'

UNION ALL

SELECT 'hidden_events',
       COUNT(*) FILTER (WHERE portal_id IS NULL),
       COUNT(*),
       ROUND(100.0 * COUNT(*) FILTER (WHERE portal_id IS NULL) / GREATEST(COUNT(*), 1), 1)
FROM hidden_events
WHERE created_at > NOW() - INTERVAL '7 days';
