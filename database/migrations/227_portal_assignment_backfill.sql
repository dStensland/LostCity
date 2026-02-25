-- Migration 227: assign owner portals for high-leakage sources and backfill future NULL event portal_id values.
-- Context:
-- Portal leakage analysis (2026-02-17) showed 4,031 future events with portal_id IS NULL.
-- Largest contributors were Atlanta-local sources missing owner_portal_id assignments.

BEGIN;

DO $$
DECLARE
    atlanta_portal_id UUID;
    atlanta_support_portal_id UUID;
BEGIN
    SELECT id INTO atlanta_portal_id
    FROM portals
    WHERE slug = 'atlanta'
    LIMIT 1;

    SELECT id INTO atlanta_support_portal_id
    FROM portals
    WHERE slug = 'atlanta-support'
    LIMIT 1;

    IF atlanta_portal_id IS NULL THEN
        RAISE EXCEPTION 'Atlanta portal is required before running migration 227';
    END IF;

    IF atlanta_support_portal_id IS NULL THEN
        RAISE EXCEPTION 'Atlanta Support portal is required before running migration 227';
    END IF;

    -- Atlanta ownership: high-volume local sources that previously leaked as unassigned.
    UPDATE sources
    SET owner_portal_id = atlanta_portal_id
    WHERE slug IN (
        'mobilize-api',
        'painting-with-a-twist',
        'roswell365',
        'atlanta-city-meetings',
        'instagram-captions',
        'sister-louisas',
        'callanwolde-fine-arts-center',
        'aso',
        'dark-horse-tavern',
        'gwinnett-stripers',
        'atlanta-city-events',
        'wild-bills',
        'velvet-note',
        'ormsbys',
        'chastain-park-amphitheatre',
        'lifeline-animal-project',
        'ten-atlanta',
        'havana-club',
        'chattahoochee-riverkeeper',
        'pullman-yards',
        'manual-holiday-events',
        'atlanta-gladiators',
        'drepung-loseling-monastery',
        'sister-louisas-church',
        'our-bar-atl',
        'atlanta-humane-society',
        'concerts-at-first',
        'grant-park-conservancy',
        'lwv-atlanta',
        'block-and-drum',
        'civic-innovation-atl',
        'terminus-mbt',
        'peachtree-road-umc',
        'paws-atlanta',
        'ncg-cinemas-atlanta',
        'ellis-station-candle-co',
        'all-star-monster-trucks',
        'dekalb-county-meetings',
        'brick-store-pub',
        'second-helpings-atlanta',
        'fulton-county-meetings',
        'wrecking-bar',
        'monday-night-garage',
        'furkids'
    );

    -- Support ownership: keep support-group providers routed to support portal.
    UPDATE sources
    SET owner_portal_id = atlanta_support_portal_id
    WHERE slug IN (
        'na-georgia',
        'ridgeview-institute',
        'griefshare-atlanta',
        'dbsa-atlanta',
        'medshare',
        'northside-hospital-community'
    );
END $$;

-- Backfill future events from source ownership.
UPDATE events e
SET portal_id = s.owner_portal_id
FROM sources s
WHERE e.source_id = s.id
  AND e.portal_id IS NULL
  AND e.start_date >= CURRENT_DATE
  AND s.owner_portal_id IS NOT NULL;

COMMIT;
