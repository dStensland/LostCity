-- Data Quality Healing: One-time cleanup for issues found in content audit
-- Layer D of the data quality healing loop implementation

-- 1. Swap inverted prices (price_min > price_max)
UPDATE events
SET price_min = price_max, price_max = price_min
WHERE price_min > price_max
  AND price_min IS NOT NULL
  AND price_max IS NOT NULL;

-- 2. Deactivate test events
UPDATE events
SET is_active = false
WHERE (title ILIKE '%test event%' OR title ILIKE '%do not purchase%')
  AND start_date >= CURRENT_DATE
  AND is_active = true;

-- 3. Deactivate closed-venue sources and their future events
-- Source slugs from closed_venues.py registry
UPDATE sources
SET is_active = false
WHERE slug IN (
    'orpheus-brewing',
    'torched-hop',
    'bookhouse-pub',
    'sound-table',
    'eventide-brewing',
    'nonis',
    'mother-bar',
    'watchmans',
    'the-music-room'
)
AND is_active = true;

UPDATE events
SET is_active = false
WHERE source_id IN (
    SELECT id FROM sources WHERE slug IN (
        'orpheus-brewing',
        'torched-hop',
        'bookhouse-pub',
        'sound-table',
        'eventide-brewing',
        'nonis',
        'mother-bar',
        'watchmans',
        'the-music-room'
    )
)
AND start_date >= CURRENT_DATE
AND is_active = true;
