-- ============================================================
-- MIGRATION 414: Cleanup Ticketmaster Atlanta Placeholder Noise
-- ============================================================

UPDATE events
SET is_active = false,
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
    lower(title) like '%training event%'
    OR lower(title) like '%aip 900 build%'
  );
