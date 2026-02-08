-- MIGRATION 147: Add portal_id to festivals table + data quality fixes
-- Fixes: Nashville/out-of-state festivals appearing in Atlanta feed
-- Fixes: Nashville events (Country Music Hall of Fame) with wrong portal_id
-- Fixes: Online courses appearing in main event feed

-- STEP 1: Add portal_id column to festivals table
ALTER TABLE festivals ADD COLUMN IF NOT EXISTS portal_id UUID REFERENCES portals(id);

-- STEP 2: Backfill festivals + fix events
DO $$
DECLARE
    atlanta_portal_id UUID;
    nashville_portal_id UUID;
    updated_count INT;
BEGIN
    SELECT id INTO atlanta_portal_id FROM portals WHERE slug = 'atlanta' LIMIT 1;
    SELECT id INTO nashville_portal_id FROM portals WHERE slug = 'nashville' LIMIT 1;

    IF atlanta_portal_id IS NULL THEN
        RAISE WARNING 'Atlanta portal not found - skipping backfill';
        RETURN;
    END IF;

    -- 2a: Set all festivals to Atlanta by default
    UPDATE festivals
    SET portal_id = atlanta_portal_id
    WHERE portal_id IS NULL;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Assigned % festivals to Atlanta portal', updated_count;

    -- 2b: Move Nashville-specific festivals to Nashville portal
    IF nashville_portal_id IS NOT NULL THEN
        UPDATE festivals
        SET portal_id = nashville_portal_id
        WHERE slug IN (
            'country-music-marathon',
            'cma-fest',
            'bonnaroo',
            'pilgrimage-festival',
            'americanafest',
            'nashville-pride',
            'live-on-the-green',
            'musicians-corner',
            'tomato-art-fest',
            'nashville-film-festival'
        );

        GET DIAGNOSTICS updated_count = ROW_COUNT;
        RAISE NOTICE 'Moved % festivals to Nashville portal', updated_count;
    END IF;

    -- 2c: Fix Nashville events with wrong/null portal_id
    IF nashville_portal_id IS NOT NULL THEN
        UPDATE events e
        SET portal_id = nashville_portal_id
        FROM sources s
        WHERE e.source_id = s.id
          AND s.owner_portal_id = nashville_portal_id
          AND (e.portal_id IS NULL OR e.portal_id != nashville_portal_id);

        GET DIAGNOSTICS updated_count = ROW_COUNT;
        RAISE NOTICE 'Fixed % Nashville events with wrong portal_id', updated_count;
    END IF;

    -- 2d: Flag online courses as is_class
    UPDATE events
    SET is_class = true
    WHERE title ILIKE '%online course%'
      AND (is_class IS NULL OR is_class = false);

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Flagged % online course events as is_class', updated_count;
END $$;

-- STEP 3: Create index for portal filtering
CREATE INDEX IF NOT EXISTS idx_festivals_portal_id ON festivals(portal_id);
