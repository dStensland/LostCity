-- Migration: Screening Runs Portal Trigger
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

-- Auto-set screening_runs.portal_id from the run's source on insert.
--
-- Mirrors the events trigger from migration 107: events inherit portal_id
-- from sources.owner_portal_id via a BEFORE INSERT trigger. Without the same
-- trigger on screening_runs, crawler code would need to thread portal_id
-- through the bundle builder in crawlers/db/screenings.py and through every
-- source; with it, any source that has owner_portal_id set gets portal
-- scoping for free, matching the events pattern.
--
-- Migration 615 added portal_id as NOT NULL on screening_runs. This trigger
-- is what keeps existing crawler INSERT paths from 500'ing once 615 is live.

CREATE OR REPLACE FUNCTION set_screening_run_portal_from_source()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.portal_id IS NULL AND NEW.source_id IS NOT NULL THEN
        SELECT owner_portal_id INTO NEW.portal_id
        FROM sources
        WHERE id = NEW.source_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_screening_run_inherit_portal ON screening_runs;

CREATE TRIGGER trg_screening_run_inherit_portal
    BEFORE INSERT ON screening_runs
    FOR EACH ROW
    EXECUTE FUNCTION set_screening_run_portal_from_source();

COMMENT ON FUNCTION set_screening_run_portal_from_source IS
'Automatically sets screening_runs.portal_id from sources.owner_portal_id on insert. Mirrors the events trigger from migration 107.';
