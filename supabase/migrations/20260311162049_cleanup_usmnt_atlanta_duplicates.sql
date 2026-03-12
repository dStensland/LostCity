-- ============================================================
-- MIGRATION 418: Cleanup Atlanta USMNT Duplicate Rows
-- ============================================================

UPDATE events
SET is_active = false,
    updated_at = NOW()
WHERE is_active = true
  AND start_date IN (DATE '2026-03-28', DATE '2026-03-31')
  AND venue_id IN (
    SELECT id
    FROM venues
    WHERE slug = 'mercedes-benz-stadium'
  )
  AND source_id IN (
    SELECT id
    FROM sources
    WHERE slug IN ('ticketmaster', 'mercedes-benz-stadium')
  )
  AND (
    lower(title) like '%usmnt%'
    OR lower(title) like '18th match - usmnt%'
  );
