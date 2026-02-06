-- ============================================
-- MIGRATION 124: Backfill remaining orgs to Atlanta portal
-- ============================================
-- Assigns portal_id to any organizations still missing it (Atlanta-only dataset).

DO $$
DECLARE
    atlanta_portal_id UUID;
BEGIN
    SELECT id INTO atlanta_portal_id FROM portals WHERE slug = 'atlanta' LIMIT 1;
    IF atlanta_portal_id IS NULL THEN
        RAISE EXCEPTION 'Atlanta portal not found - cannot backfill organizations.portal_id';
    END IF;

    UPDATE organizations
    SET portal_id = atlanta_portal_id
    WHERE portal_id IS NULL;
END $$;
