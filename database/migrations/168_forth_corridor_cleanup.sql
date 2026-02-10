-- Migration 168: FORTH Corridor Data Cleanup
-- Deactivate permanently closed venues, fix naming errors, update FORTH portal geo_center
-- Based on corridor research (crawlers/data/forth_corridor_specials.md)

-- ============================================================================
-- 1. DEACTIVATE CLOSED VENUES
-- ============================================================================

-- Prohibition Atlanta (permanently closed Dec 2025)
UPDATE venues SET is_event_venue = false, description = COALESCE(description, '') || ' [Permanently closed Dec 2025]'
WHERE id = 1718;

-- Torched Hop Brewing (permanently closed Dec 31, 2024) — two records
UPDATE venues SET is_event_venue = false, description = COALESCE(description, '') || ' [Permanently closed Dec 2024]'
WHERE id IN (1141, 1698);

-- Orpheus Brewing (permanently closed)
UPDATE venues SET is_event_venue = false, description = COALESCE(description, '') || ' [Permanently closed]'
WHERE id = 427;

-- Bookhouse Pub (permanently closed Dec 2024)
UPDATE venues SET is_event_venue = false, description = COALESCE(description, '') || ' [Permanently closed Dec 2024]'
WHERE id = 1692;

-- 8ARM (permanently closed Oct 2022) — two records
UPDATE venues SET is_event_venue = false, description = COALESCE(description, '') || ' [Permanently closed Oct 2022]'
WHERE id IN (1149, 1150);

-- Churchill Grounds (permanently closed 2016, never reopened)
UPDATE venues SET is_event_venue = false, description = COALESCE(description, '') || ' [Permanently closed 2016]'
WHERE id = 1751;

-- O4W Pizza Atlanta location (closed, Duluth only)
UPDATE venues SET is_event_venue = false, description = COALESCE(description, '') || ' [Atlanta location closed]'
WHERE id = 1226;

-- Bar Vegan (possibly closed per Yelp Nov 2025)
UPDATE venues SET is_event_venue = false, description = COALESCE(description, '') || ' [Possibly closed Nov 2025]'
WHERE id = 1721;

-- Also deactivate any sources tied to these venues
UPDATE sources SET is_active = false
WHERE id IN (
    SELECT DISTINCT s.id FROM sources s
    JOIN events e ON e.source_id = s.id
    WHERE e.venue_id IN (1718, 1141, 1698, 427, 1692, 1149, 1150, 1751, 1226, 1721)
);

-- ============================================================================
-- 2. DATA CORRECTIONS
-- ============================================================================

-- Fix: "Top Note Rooftop" should be "High Note Rooftop Bar"
UPDATE venues SET
    name = 'High Note Rooftop Bar',
    slug = 'high-note-rooftop-bar',
    website = 'https://highnoteatl.com'
WHERE id = 1484;

-- Fix: "Woody's Atlanta" is actually Woody's CheeseSteaks (food, not bar)
UPDATE venues SET
    name = 'Woody''s CheeseSteaks',
    venue_type = 'restaurant'
WHERE id = 442;

-- ============================================================================
-- 3. UPDATE FORTH PORTAL GEO_CENTER
-- ============================================================================
-- FORTH Hotel is at 800 Rankin St NE (33.7834, -84.3731)
-- Migration 163 had incorrect coordinates [33.7580, -84.3650]

UPDATE portals SET
    filters = jsonb_set(
        filters::jsonb,
        '{geo_center}',
        '[33.7834, -84.3731]'::jsonb
    )
WHERE slug = 'forth';

-- ============================================================================
-- DOWN (manual reversal notes)
-- ============================================================================
-- To reverse: UPDATE venues SET is_event_venue = true WHERE id IN (1718, 1141, 1698, 427, 1692, 1149, 1150, 1751, 1226, 1721);
-- To reverse name fixes: UPDATE venues SET name = 'Top Note Rooftop', slug = 'top-note-rooftop' WHERE id = 1484;
-- To reverse geo_center: UPDATE portals SET filters = jsonb_set(filters::jsonb, '{geo_center}', '[33.7580, -84.3650]') WHERE slug = 'forth';
