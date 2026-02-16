-- Phase N: Portal Attribution Hardening — add portal_id to user-action tables

-- Add portal_id columns to user-action tables
ALTER TABLE event_rsvps
  ADD COLUMN IF NOT EXISTS portal_id UUID REFERENCES portals(id) ON DELETE SET NULL;

ALTER TABLE saved_items
  ADD COLUMN IF NOT EXISTS portal_id UUID REFERENCES portals(id) ON DELETE SET NULL;

ALTER TABLE follows
  ADD COLUMN IF NOT EXISTS portal_id UUID REFERENCES portals(id) ON DELETE SET NULL;

ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS portal_id UUID REFERENCES portals(id) ON DELETE SET NULL;

-- Add indexes for portal-scoped queries
CREATE INDEX IF NOT EXISTS idx_event_rsvps_portal_id
  ON event_rsvps(portal_id)
  WHERE portal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_saved_items_portal_id
  ON saved_items(portal_id)
  WHERE portal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_follows_portal_id
  ON follows(portal_id)
  WHERE portal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activities_portal_id
  ON activities(portal_id)
  WHERE portal_id IS NOT NULL;

-- Add comments explaining the portal attribution
COMMENT ON COLUMN event_rsvps.portal_id IS 'Portal context where RSVP was created, for attribution and filtering';
COMMENT ON COLUMN saved_items.portal_id IS 'Portal context where item was saved, for attribution and filtering';
COMMENT ON COLUMN follows.portal_id IS 'Portal context where follow was created, for attribution and filtering';
COMMENT ON COLUMN activities.portal_id IS 'Portal context where activity was logged, for attribution and filtering';
