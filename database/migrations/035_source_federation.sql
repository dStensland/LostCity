-- ============================================
-- MIGRATION 035: Source Federation System
-- ============================================
-- Enables sources to be owned by portals and shared across the platform
-- with category-level granularity for subscriptions.

-- ============================================
-- STEP 1: Add Source Ownership
-- ============================================

-- Add owner_portal_id to sources table
ALTER TABLE sources
ADD COLUMN IF NOT EXISTS owner_portal_id UUID REFERENCES portals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sources_owner_portal ON sources(owner_portal_id);

COMMENT ON COLUMN sources.owner_portal_id IS 'Portal that owns this source. NULL = global source (appears in all portals).';

-- ============================================
-- STEP 2: Source Sharing Rules Table
-- ============================================
-- Defines how a source owner shares events with other portals

CREATE TABLE IF NOT EXISTS source_sharing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    owner_portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,

    -- 'all' = share all categories, 'selected' = only listed, 'none' = private
    share_scope VARCHAR(20) NOT NULL DEFAULT 'none'
        CHECK (share_scope IN ('all', 'selected', 'none')),

    -- Categories allowed to share (NULL when scope = 'all')
    allowed_categories TEXT[] DEFAULT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(source_id)
);

CREATE INDEX IF NOT EXISTS idx_sharing_rules_owner ON source_sharing_rules(owner_portal_id);
CREATE INDEX IF NOT EXISTS idx_sharing_rules_scope ON source_sharing_rules(share_scope) WHERE share_scope != 'none';

COMMENT ON TABLE source_sharing_rules IS 'Defines how source owners share their sources with other portals.';

-- ============================================
-- STEP 3: Source Subscriptions Table
-- ============================================
-- Defines which portals subscribe to which shared sources

CREATE TABLE IF NOT EXISTS source_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,

    -- 'all' = receive all shared categories, 'selected' = only listed
    subscription_scope VARCHAR(20) NOT NULL DEFAULT 'all'
        CHECK (subscription_scope IN ('all', 'selected')),

    -- Categories to receive (NULL when scope = 'all')
    subscribed_categories TEXT[] DEFAULT NULL,

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(subscriber_portal_id, source_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber ON source_subscriptions(subscriber_portal_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_subscriptions_source ON source_subscriptions(source_id) WHERE is_active = true;

COMMENT ON TABLE source_subscriptions IS 'Tracks which portals subscribe to which shared sources.';

-- ============================================
-- STEP 4: Materialized View for Query Performance
-- ============================================
-- Pre-computed table of portal-source access for fast event queries

CREATE MATERIALIZED VIEW IF NOT EXISTS portal_source_access AS
SELECT DISTINCT
    p.id AS portal_id,
    s.id AS source_id,
    s.name AS source_name,
    CASE
        -- Portal owns this source: full access (NULL = all categories)
        WHEN s.owner_portal_id = p.id THEN NULL
        -- Global source: full access
        WHEN s.owner_portal_id IS NULL THEN NULL
        -- Subscribed with 'all' scope: use allowed_categories from sharing rules
        WHEN sub.subscription_scope = 'all' THEN
            CASE WHEN rule.share_scope = 'all' THEN NULL ELSE rule.allowed_categories END
        -- Subscribed with 'selected' scope: intersection of allowed and subscribed
        ELSE sub.subscribed_categories
    END AS accessible_categories,
    CASE
        WHEN s.owner_portal_id = p.id THEN 'owner'
        WHEN s.owner_portal_id IS NULL THEN 'global'
        ELSE 'subscription'
    END AS access_type
FROM portals p
CROSS JOIN sources s
LEFT JOIN source_subscriptions sub
    ON sub.subscriber_portal_id = p.id
    AND sub.source_id = s.id
    AND sub.is_active = true
LEFT JOIN source_sharing_rules rule
    ON rule.source_id = s.id
WHERE
    s.is_active = true
    AND (
        -- Portal owns this source
        s.owner_portal_id = p.id
        -- Source is global (no owner)
        OR s.owner_portal_id IS NULL
        -- Portal has an active subscription and source is shared
        OR (sub.id IS NOT NULL AND rule.share_scope != 'none')
    );

CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_source_access_pk ON portal_source_access(portal_id, source_id);
CREATE INDEX IF NOT EXISTS idx_portal_source_access_portal ON portal_source_access(portal_id);
CREATE INDEX IF NOT EXISTS idx_portal_source_access_source ON portal_source_access(source_id);

COMMENT ON MATERIALIZED VIEW portal_source_access IS 'Pre-computed portal-to-source access for fast event filtering.';

-- ============================================
-- STEP 5: Function to Refresh Materialized View
-- ============================================

CREATE OR REPLACE FUNCTION refresh_portal_source_access()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 6: Triggers to Auto-Refresh View
-- ============================================

-- Trigger function for refreshing the view
CREATE OR REPLACE FUNCTION trigger_refresh_portal_source_access()
RETURNS trigger AS $$
BEGIN
    -- Use pg_notify for async refresh to avoid blocking writes
    PERFORM pg_notify('refresh_portal_source_access', '');
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger on source_subscriptions changes
DROP TRIGGER IF EXISTS trg_subscriptions_refresh_access ON source_subscriptions;
CREATE TRIGGER trg_subscriptions_refresh_access
AFTER INSERT OR UPDATE OR DELETE ON source_subscriptions
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_refresh_portal_source_access();

-- Trigger on source_sharing_rules changes
DROP TRIGGER IF EXISTS trg_sharing_rules_refresh_access ON source_sharing_rules;
CREATE TRIGGER trg_sharing_rules_refresh_access
AFTER INSERT OR UPDATE OR DELETE ON source_sharing_rules
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_refresh_portal_source_access();

-- Trigger on sources.owner_portal_id changes
CREATE OR REPLACE FUNCTION trigger_source_owner_change()
RETURNS trigger AS $$
BEGIN
    IF OLD.owner_portal_id IS DISTINCT FROM NEW.owner_portal_id THEN
        PERFORM pg_notify('refresh_portal_source_access', '');
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sources_owner_refresh_access ON sources;
CREATE TRIGGER trg_sources_owner_refresh_access
AFTER UPDATE ON sources
FOR EACH ROW
EXECUTE FUNCTION trigger_source_owner_change();

-- ============================================
-- STEP 7: RLS Policies for New Tables
-- ============================================

ALTER TABLE source_sharing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_subscriptions ENABLE ROW LEVEL SECURITY;

-- Read access for sharing rules (needed for federation queries)
CREATE POLICY "Sharing rules are readable by authenticated users"
ON source_sharing_rules FOR SELECT
USING (true);

-- Read access for subscriptions
CREATE POLICY "Subscriptions are readable by authenticated users"
ON source_subscriptions FOR SELECT
USING (true);

-- Write access for sharing rules (only by admins, handled by service role)
CREATE POLICY "Only admins can modify sharing rules"
ON source_sharing_rules FOR ALL
USING (auth.jwt() ->> 'role' = 'admin')
WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Write access for subscriptions (only by admins, handled by service role)
CREATE POLICY "Only admins can modify subscriptions"
ON source_subscriptions FOR ALL
USING (auth.jwt() ->> 'role' = 'admin')
WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- STEP 8: Initial Data Migration
-- ============================================

-- Get Atlanta's portal ID
DO $$
DECLARE
    atlanta_id UUID;
BEGIN
    -- Get the Atlanta portal ID
    SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta' LIMIT 1;

    IF atlanta_id IS NOT NULL THEN
        -- Assign all existing sources to Atlanta as owner
        UPDATE sources
        SET owner_portal_id = atlanta_id
        WHERE owner_portal_id IS NULL;

        -- Create sharing rules for all Atlanta sources (share everything)
        INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
        SELECT id, atlanta_id, 'all'
        FROM sources
        WHERE owner_portal_id = atlanta_id
        ON CONFLICT (source_id) DO NOTHING;

        RAISE NOTICE 'Assigned all sources to Atlanta portal (ID: %) and created sharing rules', atlanta_id;
    ELSE
        RAISE NOTICE 'Atlanta portal not found - skipping initial data migration';
    END IF;
END $$;

-- Refresh the materialized view with initial data
REFRESH MATERIALIZED VIEW portal_source_access;

-- ============================================
-- STEP 9: Helper Functions
-- ============================================

-- Function to get accessible source IDs for a portal
CREATE OR REPLACE FUNCTION get_portal_source_ids(p_portal_id UUID)
RETURNS TABLE(source_id INTEGER, accessible_categories TEXT[]) AS $$
BEGIN
    RETURN QUERY
    SELECT psa.source_id, psa.accessible_categories
    FROM portal_source_access psa
    WHERE psa.portal_id = p_portal_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if a portal can access an event
CREATE OR REPLACE FUNCTION portal_can_access_event(
    p_portal_id UUID,
    p_source_id INTEGER,
    p_category_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_accessible_categories TEXT[];
BEGIN
    SELECT accessible_categories INTO v_accessible_categories
    FROM portal_source_access
    WHERE portal_id = p_portal_id AND source_id = p_source_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- NULL means all categories are accessible
    IF v_accessible_categories IS NULL THEN
        RETURN TRUE;
    END IF;

    -- Check if category is in the accessible list
    RETURN p_category_id = ANY(v_accessible_categories);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_portal_source_ids IS 'Returns source IDs and category constraints for a portal.';
COMMENT ON FUNCTION portal_can_access_event IS 'Checks if a portal can access an event based on federation rules.';
