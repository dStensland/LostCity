-- ============================================
-- MIGRATION 162: Portal Page View Tracking
-- ============================================
-- Lightweight analytics table for tracking portal page views.
-- Supports UTM parameters for QR code attribution.
-- RLS: Anonymous INSERT allowed, SELECT restricted to portal managers.

CREATE TABLE IF NOT EXISTS portal_page_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    page_type VARCHAR(30) NOT NULL CHECK (page_type IN ('feed', 'find', 'event', 'spot', 'series', 'community')),
    entity_id INTEGER,
    referrer VARCHAR(500),
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    user_agent VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for time-series queries (dashboard: views per day)
CREATE INDEX IF NOT EXISTS idx_portal_page_views_portal_time
    ON portal_page_views (portal_id, created_at);

-- Index for type-filtered queries (views by page_type)
CREATE INDEX IF NOT EXISTS idx_portal_page_views_portal_type_time
    ON portal_page_views (portal_id, page_type, created_at);

-- Index for UTM analysis (QR code attribution)
CREATE INDEX IF NOT EXISTS idx_portal_page_views_utm
    ON portal_page_views (portal_id, utm_medium, utm_source)
    WHERE utm_medium IS NOT NULL;

-- Enable RLS
ALTER TABLE portal_page_views ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (tracking is unauthenticated)
CREATE POLICY portal_page_views_insert ON portal_page_views
    FOR INSERT
    WITH CHECK (true);

-- SELECT restricted to portal managers (checked at API level via canManagePortal)
-- Service role can always read, so the analytics API route uses createServiceClient or
-- the API checks canManagePortal before querying
CREATE POLICY portal_page_views_select ON portal_page_views
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM portal_members pm
            WHERE pm.portal_id = portal_page_views.portal_id
            AND pm.user_id = auth.uid()
            AND pm.role IN ('owner', 'admin', 'editor')
        )
    );

-- Comment
COMMENT ON TABLE portal_page_views IS 'Lightweight page view tracking for portal analytics. Supports UTM params for QR code attribution.';
