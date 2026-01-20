-- ============================================
-- MIGRATION 019: Event Portal Restriction
-- ============================================
-- Adds portal_id to events to restrict which portals can show them
-- NULL = available in all portals (default behavior)
-- Set to a portal UUID = only available in that specific portal

-- Add portal_id column to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS portal_id UUID REFERENCES portals(id) ON DELETE SET NULL;

-- Create index for efficient portal filtering
CREATE INDEX IF NOT EXISTS idx_events_portal_id ON events(portal_id);

-- Update Piedmont Healthcare events to be portal-restricted
UPDATE events
SET portal_id = (SELECT id FROM portals WHERE slug = 'piedmont')
WHERE source_id = (SELECT id FROM sources WHERE slug = 'piedmont-healthcare');

-- Add comment explaining the column
COMMENT ON COLUMN events.portal_id IS 'If set, event is only visible in this portal. NULL means visible in all portals.';
