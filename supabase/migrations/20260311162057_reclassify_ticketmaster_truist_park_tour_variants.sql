-- ============================================================
-- MIGRATION 413: Reclassify Ticketmaster Truist Park Tour Variants
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
  AND lower(title) like '%truist park tour%';
