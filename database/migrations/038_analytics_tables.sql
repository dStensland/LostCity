-- 038_analytics_tables.sql
-- Analytics tables for dashboard metrics and external integrations

-- ============================================================================
-- DAILY PORTAL ANALYTICS
-- ============================================================================

-- Daily aggregated metrics per portal
CREATE TABLE IF NOT EXISTS analytics_daily_portal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,

    -- Engagement metrics
    event_views INT DEFAULT 0,
    event_rsvps INT DEFAULT 0,
    event_saves INT DEFAULT 0,
    event_shares INT DEFAULT 0,

    -- Growth metrics
    new_signups INT DEFAULT 0,
    active_users INT DEFAULT 0,

    -- Content metrics
    events_total INT DEFAULT 0,
    events_created INT DEFAULT 0,
    sources_active INT DEFAULT 0,
    crawl_runs INT DEFAULT 0,
    crawl_success_rate DECIMAL(5,2) DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(date, portal_id)
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_analytics_daily_portal_date
    ON analytics_daily_portal(date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_portal_portal
    ON analytics_daily_portal(portal_id);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_portal_date_portal
    ON analytics_daily_portal(date DESC, portal_id);

-- ============================================================================
-- API KEYS FOR EXTERNAL INTEGRATIONS
-- ============================================================================

-- API keys for external tools (Snowflake, GA, etc.)
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash TEXT NOT NULL UNIQUE,           -- SHA-256 hash of the actual key
    key_prefix VARCHAR(8) NOT NULL,          -- First 8 chars for identification (e.g., "lc_abc12")
    name VARCHAR(255) NOT NULL,              -- Human-readable name
    portal_id UUID REFERENCES portals(id) ON DELETE CASCADE, -- NULL = super admin scope (all portals)
    scopes TEXT[] DEFAULT ARRAY['analytics:read'],
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for API key lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_portal ON api_keys(portal_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE analytics_daily_portal ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Analytics are read-only for admins (service role for writes)
CREATE POLICY "Admins can view analytics"
    ON analytics_daily_portal FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
        OR EXISTS (
            SELECT 1 FROM portal_members
            WHERE portal_members.portal_id = analytics_daily_portal.portal_id
            AND portal_members.user_id = auth.uid()
            AND portal_members.role IN ('owner', 'admin')
        )
    );

-- API keys: portal admins can manage their portal's keys, super admins can manage all
CREATE POLICY "Portal admins can view api keys"
    ON api_keys FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
        OR (
            portal_id IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM portal_members
                WHERE portal_members.portal_id = api_keys.portal_id
                AND portal_members.user_id = auth.uid()
                AND portal_members.role IN ('owner', 'admin')
            )
        )
    );

CREATE POLICY "Super admins can insert api keys"
    ON api_keys FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

CREATE POLICY "Super admins can update api keys"
    ON api_keys FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

CREATE POLICY "Super admins can delete api keys"
    ON api_keys FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- ============================================================================
-- AGGREGATION FUNCTION
-- ============================================================================

-- Function to aggregate daily analytics from source tables
-- Run via pg_cron at 2 AM daily for previous day's data
CREATE OR REPLACE FUNCTION aggregate_daily_analytics(target_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day')
RETURNS void AS $$
DECLARE
    portal_record RECORD;
    engagement_data RECORD;
    growth_data RECORD;
    content_data RECORD;
BEGIN
    -- Loop through all active portals
    FOR portal_record IN
        SELECT id FROM portals WHERE status = 'active'
    LOOP
        -- Get engagement metrics from inferred_preferences (views, saves, shares)
        SELECT
            COALESCE(SUM(CASE WHEN signal_type = 'view' THEN interaction_count ELSE 0 END), 0) as views,
            COALESCE(SUM(CASE WHEN signal_type = 'save' THEN interaction_count ELSE 0 END), 0) as saves,
            COALESCE(SUM(CASE WHEN signal_type = 'share' THEN interaction_count ELSE 0 END), 0) as shares
        INTO engagement_data
        FROM inferred_preferences
        WHERE DATE(last_interaction_at) = target_date;

        -- Get RSVP count from event_rsvps
        -- Note: We'd need portal-aware RSVP tracking, for now count all

        -- Get growth metrics
        SELECT
            COUNT(DISTINCT CASE WHEN DATE(created_at) = target_date THEN id END) as new_signups,
            COUNT(DISTINCT CASE WHEN DATE(updated_at) = target_date
                OR EXISTS (
                    SELECT 1 FROM activities
                    WHERE activities.user_id = profiles.id
                    AND DATE(activities.created_at) = target_date
                ) THEN id END) as active_users
        INTO growth_data
        FROM profiles;

        -- Get content metrics from crawl_logs
        SELECT
            COUNT(*) as crawl_runs,
            CASE
                WHEN COUNT(*) > 0
                THEN (COUNT(*) FILTER (WHERE status = 'success')::DECIMAL / COUNT(*) * 100)
                ELSE 0
            END as success_rate
        INTO content_data
        FROM crawl_logs
        WHERE DATE(started_at) = target_date;

        -- Count events total for this portal (would need portal_id on events or portal-source mapping)
        -- For now, count all events

        -- Upsert the daily record
        INSERT INTO analytics_daily_portal (
            date,
            portal_id,
            event_views,
            event_rsvps,
            event_saves,
            event_shares,
            new_signups,
            active_users,
            events_total,
            events_created,
            sources_active,
            crawl_runs,
            crawl_success_rate
        )
        VALUES (
            target_date,
            portal_record.id,
            COALESCE(engagement_data.views, 0),
            (SELECT COUNT(*) FROM event_rsvps WHERE DATE(created_at) = target_date),
            COALESCE(engagement_data.saves, 0),
            COALESCE(engagement_data.shares, 0),
            COALESCE(growth_data.new_signups, 0),
            COALESCE(growth_data.active_users, 0),
            (SELECT COUNT(*) FROM events WHERE start_date >= target_date),
            (SELECT COUNT(*) FROM events WHERE DATE(created_at) = target_date),
            (SELECT COUNT(*) FROM sources WHERE is_active = true),
            COALESCE(content_data.crawl_runs, 0),
            COALESCE(content_data.success_rate, 0)
        )
        ON CONFLICT (date, portal_id) DO UPDATE SET
            event_views = EXCLUDED.event_views,
            event_rsvps = EXCLUDED.event_rsvps,
            event_saves = EXCLUDED.event_saves,
            event_shares = EXCLUDED.event_shares,
            new_signups = EXCLUDED.new_signups,
            active_users = EXCLUDED.active_users,
            events_total = EXCLUDED.events_total,
            events_created = EXCLUDED.events_created,
            sources_active = EXCLUDED.sources_active,
            crawl_runs = EXCLUDED.crawl_runs,
            crawl_success_rate = EXCLUDED.crawl_success_rate;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE analytics_daily_portal IS 'Daily aggregated metrics per portal for analytics dashboard';
COMMENT ON COLUMN analytics_daily_portal.event_views IS 'Number of event page views';
COMMENT ON COLUMN analytics_daily_portal.event_rsvps IS 'Number of RSVPs (going/interested)';
COMMENT ON COLUMN analytics_daily_portal.event_saves IS 'Number of events saved/bookmarked';
COMMENT ON COLUMN analytics_daily_portal.event_shares IS 'Number of event shares';
COMMENT ON COLUMN analytics_daily_portal.new_signups IS 'New user registrations';
COMMENT ON COLUMN analytics_daily_portal.active_users IS 'Users with activity on this date';
COMMENT ON COLUMN analytics_daily_portal.events_total IS 'Total upcoming events';
COMMENT ON COLUMN analytics_daily_portal.events_created IS 'Events created on this date';
COMMENT ON COLUMN analytics_daily_portal.sources_active IS 'Number of active event sources';
COMMENT ON COLUMN analytics_daily_portal.crawl_runs IS 'Number of crawler runs';
COMMENT ON COLUMN analytics_daily_portal.crawl_success_rate IS 'Percentage of successful crawls';

COMMENT ON TABLE api_keys IS 'API keys for external tool integrations (Snowflake, GA, etc.)';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256 hash of the API key (actual key is never stored)';
COMMENT ON COLUMN api_keys.key_prefix IS 'First 8 characters of key for identification';
COMMENT ON COLUMN api_keys.portal_id IS 'NULL means super admin scope (access to all portals)';
COMMENT ON COLUMN api_keys.scopes IS 'Permissions: analytics:read, analytics:write, etc.';

-- Note: To set up pg_cron for daily aggregation:
-- SELECT cron.schedule('aggregate-daily-analytics', '0 2 * * *', 'SELECT aggregate_daily_analytics()');
