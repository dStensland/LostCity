-- ============================================================
-- MIGRATION 419: Cleanup Men In Blazers Ticketmaster Duplicate
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
  AND start_time = TIME '19:30:00';
