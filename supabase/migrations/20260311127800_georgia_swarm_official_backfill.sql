-- ============================================
-- MIGRATION 320: Georgia Swarm Official Source Backfill
-- ============================================
-- Reassign future Georgia Swarm home games from Ticketmaster to the official
-- Georgia Swarm source so first-party crawls retain attribution.

WITH official_source AS (
  SELECT id
  FROM sources
  WHERE slug = 'georgia-swarm'
  LIMIT 1
),
ticketmaster_source AS (
  SELECT id
  FROM sources
  WHERE slug = 'ticketmaster'
  LIMIT 1
),
gas_south AS (
  SELECT id
  FROM venues
  WHERE slug = 'gas-south-arena'
  LIMIT 1
)
UPDATE events e
SET source_id = official_source.id
FROM official_source, ticketmaster_source, gas_south
WHERE e.source_id = ticketmaster_source.id
  AND e.venue_id = gas_south.id
  AND e.start_date >= CURRENT_DATE
  AND e.title LIKE 'Georgia Swarm vs.%';
