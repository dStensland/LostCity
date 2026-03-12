-- ============================================================
-- MIGRATION 412: Reclassify Ticketmaster Atlanta Venue Tours
-- ============================================================

UPDATE events
SET category_id = 'tours',
    updated_at = NOW()
WHERE source_id = (
  SELECT id
  FROM sources
  WHERE slug = 'ticketmaster'
  LIMIT 1
)
  AND is_active = true
  AND start_date >= CURRENT_DATE
  AND venue_id IN (
    SELECT id
    FROM venues
    WHERE city = 'Atlanta'
  )
  AND (
    lower(title) like 'tours:%'
    OR lower(title) like '%historian tour%'
    OR lower(title) like '%bats & bites tour%'
  );
