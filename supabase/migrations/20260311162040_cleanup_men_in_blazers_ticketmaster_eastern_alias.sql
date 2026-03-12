-- ============================================================
-- MIGRATION 422: Cleanup Men In Blazers Ticketmaster Eastern Alias
-- ============================================================

UPDATE events
SET is_active = false,
    updated_at = NOW()
WHERE is_active = true
  AND source_id = (
    SELECT id
    FROM sources
    WHERE slug = 'ticketmaster'
    LIMIT 1
  )
  AND lower(title) = 'men in blazers'
  AND start_date = DATE '2026-03-27'
  AND start_time = TIME '19:30:00'
  AND venue_id IN (
    SELECT id
    FROM venues
    WHERE slug IN ('the-eastern-ga', 'the-eastern')
  );
