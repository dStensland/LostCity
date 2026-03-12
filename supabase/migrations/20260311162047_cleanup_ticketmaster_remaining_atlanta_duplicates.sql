-- ============================================================
-- MIGRATION 425: Cleanup Remaining Ticketmaster Atlanta Duplicates
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
  AND (
    (
      lower(title) = 'men in blazers'
      AND start_date = DATE '2026-03-27'
      AND start_time = TIME '19:30:00'
    )
    OR (
      lower(title) = 'delta sky 360 club experience - new edition'
      AND start_date = DATE '2026-03-29'
      AND start_time = TIME '19:00:00'
    )
  );
