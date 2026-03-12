-- ============================================================
-- MIGRATION 411: Cleanup Ticketmaster Atlanta Sports Noise
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
    lower(title) ~ 'childcare pass'
    OR lower(title) ~ 'molly b''s pass'
    OR lower(title) ~ 'rental event'
    OR lower(title) ~ 'fevo'
    OR lower(title) ~ 'suite pass'
    OR lower(title) ~ 'premium seating'
  );
