-- Fix: portal_source_access materialized view goes stale when sources are
-- activated/deactivated or created. The existing triggers only fire on
-- owner_portal_id changes and subscriptions, and use pg_notify which has
-- no listener. Replace with direct REFRESH on source activation changes.

-- Trigger function that does an actual refresh (not just pg_notify)
CREATE OR REPLACE FUNCTION trigger_refresh_portal_source_access()
RETURNS trigger AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Also fire when is_active changes on sources (new sources activated, etc.)
CREATE OR REPLACE FUNCTION trigger_source_active_change()
RETURNS trigger AS $$
BEGIN
    IF OLD.is_active IS DISTINCT FROM NEW.is_active
       OR OLD.owner_portal_id IS DISTINCT FROM NEW.owner_portal_id THEN
        REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Replace the old owner-only trigger with one that covers is_active too
DROP TRIGGER IF EXISTS trg_sources_owner_refresh_access ON sources;
DROP TRIGGER IF EXISTS trg_sources_active_refresh_access ON sources;
CREATE TRIGGER trg_sources_active_refresh_access
AFTER UPDATE ON sources
FOR EACH ROW
EXECUTE FUNCTION trigger_source_active_change();

-- Also refresh on INSERT (new source created as active)
DROP TRIGGER IF EXISTS trg_sources_insert_refresh_access ON sources;
CREATE TRIGGER trg_sources_insert_refresh_access
AFTER INSERT ON sources
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_refresh_portal_source_access();
