-- ============================================
-- MIGRATION 107: Portal Data Isolation Fix
-- ============================================
-- Fixes the portal data isolation issue where events with NULL portal_id
-- appear in all portals, causing unwanted crossover between city portals.
--
-- This migration:
-- 1. Adds constraint ensuring active sources have owner_portal_id
-- 2. Creates trigger to auto-populate events.portal_id from sources
-- 3. Backfills existing events with portal_id from their source
-- 4. Assigns Nashville sources to Nashville portal
-- 5. Assigns remaining unassigned sources to Atlanta portal
-- 6. Creates index on events.portal_id for performance

-- ============================================
-- STEP 1: Add Check Constraint to Sources
-- ============================================
-- Ensure that active sources must have an owner_portal_id
-- This prevents new sources from being created without portal assignment

ALTER TABLE sources
ADD CONSTRAINT sources_active_must_have_portal
CHECK (
    is_active = FALSE OR owner_portal_id IS NOT NULL
);

COMMENT ON CONSTRAINT sources_active_must_have_portal ON sources IS
'Active sources must have an owner_portal_id to prevent events from appearing in all portals';

-- ============================================
-- STEP 2: Create Trigger to Auto-Set Portal ID
-- ============================================
-- When events are inserted, automatically inherit portal_id from source

CREATE OR REPLACE FUNCTION set_event_portal_from_source()
RETURNS TRIGGER AS $$
BEGIN
    -- If portal_id is not explicitly set, inherit from source
    IF NEW.portal_id IS NULL AND NEW.source_id IS NOT NULL THEN
        SELECT owner_portal_id INTO NEW.portal_id
        FROM sources
        WHERE id = NEW.source_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists and recreate
DROP TRIGGER IF EXISTS trg_event_inherit_portal ON events;

CREATE TRIGGER trg_event_inherit_portal
    BEFORE INSERT ON events
    FOR EACH ROW
    EXECUTE FUNCTION set_event_portal_from_source();

COMMENT ON FUNCTION set_event_portal_from_source IS
'Automatically sets events.portal_id from sources.owner_portal_id on insert';

-- ============================================
-- STEP 3: Assign Portal Ownership to Sources
-- ============================================
-- Get portal IDs and assign sources to their appropriate portals

DO $$
DECLARE
    atlanta_portal_id UUID;
    nashville_portal_id UUID;
    sources_updated INTEGER := 0;
BEGIN
    -- Get portal IDs
    SELECT id INTO atlanta_portal_id FROM portals WHERE slug = 'atlanta' LIMIT 1;
    SELECT id INTO nashville_portal_id FROM portals WHERE slug = 'nashville' LIMIT 1;

    IF atlanta_portal_id IS NULL THEN
        RAISE EXCEPTION 'Atlanta portal not found - cannot proceed with migration';
    END IF;

    IF nashville_portal_id IS NULL THEN
        RAISE WARNING 'Nashville portal not found - skipping Nashville source assignments';
    END IF;

    -- ========================================
    -- NASHVILLE SOURCES
    -- ========================================
    -- Assign all Nashville-related sources to Nashville portal
    -- Includes venues, organizations, and Nashville-specific event sources

    IF nashville_portal_id IS NOT NULL THEN
        UPDATE sources
        SET owner_portal_id = nashville_portal_id
        WHERE owner_portal_id IS NULL
        AND (
            -- Explicit Nashville venue/organization sources
            slug LIKE '%nashville%' OR
            slug LIKE '%ryman%' OR
            slug LIKE '%opry%' OR
            slug LIKE '%bluebird%' OR
            slug LIKE '%station-inn%' OR
            slug LIKE '%schermerhorn%' OR
            slug LIKE '%tpac%' OR
            slug LIKE '%bridgestone%' OR
            slug LIKE '%brooklyn-bowl-nashville%' OR

            -- Franklin area (Williamson County)
            slug LIKE '%franklin%' OR
            slug LIKE '%factory-franklin%' OR
            slug LIKE '%downtown-franklin%' OR

            -- Murfreesboro area (Rutherford County)
            slug LIKE '%murfreesboro%' OR
            slug LIKE '%mtsu%' OR

            -- Nashville-specific platforms
            slug LIKE '%do615%' OR
            slug LIKE '%nowplayingnashville%' OR
            slug LIKE '%nashvillescene%' OR

            -- Ticketmaster/Eventbrite Nashville variations
            slug = 'ticketmaster-nashville' OR
            slug = 'eventbrite-nashville'
        );

        GET DIAGNOSTICS sources_updated = ROW_COUNT;
        RAISE NOTICE 'Assigned % Nashville sources to Nashville portal (ID: %)', sources_updated, nashville_portal_id;
    END IF;

    -- ========================================
    -- ATLANTA SOURCES (Default)
    -- ========================================
    -- Assign all remaining unassigned sources to Atlanta portal
    -- This includes Atlanta-specific sources and general sources

    UPDATE sources
    SET owner_portal_id = atlanta_portal_id
    WHERE owner_portal_id IS NULL;

    GET DIAGNOSTICS sources_updated = ROW_COUNT;
    RAISE NOTICE 'Assigned % remaining sources to Atlanta portal (ID: %)', sources_updated, atlanta_portal_id;

    -- ========================================
    -- UPDATE SHARING RULES
    -- ========================================
    -- Ensure all newly assigned sources have sharing rules

    -- Create sharing rules for Nashville sources (share all by default)
    IF nashville_portal_id IS NOT NULL THEN
        INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
        SELECT id, nashville_portal_id, 'all'
        FROM sources
        WHERE owner_portal_id = nashville_portal_id
        ON CONFLICT (source_id) DO UPDATE SET
            share_scope = 'all',
            owner_portal_id = nashville_portal_id;
    END IF;

    -- Create sharing rules for Atlanta sources (share all by default)
    INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
    SELECT id, atlanta_portal_id, 'all'
    FROM sources
    WHERE owner_portal_id = atlanta_portal_id
    ON CONFLICT (source_id) DO UPDATE SET
        share_scope = 'all',
        owner_portal_id = atlanta_portal_id;

    RAISE NOTICE 'Updated source sharing rules for all assigned sources';

END $$;

-- ============================================
-- STEP 4: Backfill Events with Portal ID
-- ============================================
-- Update all existing events to inherit portal_id from their source

DO $$
DECLARE
    events_updated INTEGER := 0;
BEGIN
    UPDATE events e
    SET portal_id = s.owner_portal_id
    FROM sources s
    WHERE e.source_id = s.id
    AND e.portal_id IS NULL
    AND s.owner_portal_id IS NOT NULL;

    GET DIAGNOSTICS events_updated = ROW_COUNT;
    RAISE NOTICE 'Backfilled portal_id for % events', events_updated;
END $$;

-- ============================================
-- STEP 5: Create Performance Index
-- ============================================
-- Add index on events.portal_id for fast portal filtering

CREATE INDEX IF NOT EXISTS idx_events_portal_id_not_null
ON events(portal_id)
WHERE portal_id IS NOT NULL;

-- Update existing index to be more useful
DROP INDEX IF EXISTS idx_events_portal_id;
CREATE INDEX idx_events_portal_id ON events(portal_id, start_date DESC);

COMMENT ON INDEX idx_events_portal_id IS
'Composite index for efficient portal filtering and date sorting';

-- ============================================
-- STEP 6: Refresh Materialized Views
-- ============================================
-- Refresh the portal_source_access view to reflect new assignments

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;

-- ============================================
-- STEP 7: Verification Queries
-- ============================================
-- These queries can be run to verify the migration succeeded

DO $$
DECLARE
    total_sources INTEGER;
    sources_with_portal INTEGER;
    sources_without_portal INTEGER;
    active_sources_without_portal INTEGER;
    total_events INTEGER;
    events_with_portal INTEGER;
    events_without_portal INTEGER;
BEGIN
    -- Count sources
    SELECT COUNT(*) INTO total_sources FROM sources;
    SELECT COUNT(*) INTO sources_with_portal FROM sources WHERE owner_portal_id IS NOT NULL;
    SELECT COUNT(*) INTO sources_without_portal FROM sources WHERE owner_portal_id IS NULL;
    SELECT COUNT(*) INTO active_sources_without_portal FROM sources WHERE owner_portal_id IS NULL AND is_active = TRUE;

    -- Count events
    SELECT COUNT(*) INTO total_events FROM events;
    SELECT COUNT(*) INTO events_with_portal FROM events WHERE portal_id IS NOT NULL;
    SELECT COUNT(*) INTO events_without_portal FROM events WHERE portal_id IS NULL;

    -- Report results
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRATION 107 VERIFICATION';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Sources: % total, % with portal, % without portal',
        total_sources, sources_with_portal, sources_without_portal;
    RAISE NOTICE 'Active sources without portal: % (should be 0)',
        active_sources_without_portal;
    RAISE NOTICE 'Events: % total, % with portal, % without portal',
        total_events, events_with_portal, events_without_portal;
    RAISE NOTICE '========================================';

    -- Warn if active sources don't have portals
    IF active_sources_without_portal > 0 THEN
        RAISE WARNING 'Found % active sources without owner_portal_id - these should be manually assigned',
            active_sources_without_portal;
    END IF;
END $$;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

COMMENT ON TABLE events IS
'Events inherit portal_id from their source via trigger. Migration 107 added automatic portal inheritance to prevent cross-portal contamination.';

COMMENT ON TABLE sources IS
'Active sources must have owner_portal_id (constraint added in migration 107). This ensures proper portal data isolation.';
