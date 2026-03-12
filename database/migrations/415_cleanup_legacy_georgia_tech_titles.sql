-- ============================================================
-- MIGRATION 415: Cleanup Legacy Georgia Tech Abbreviated Titles
-- ============================================================

UPDATE events
SET is_active = false,
    updated_at = NOW()
WHERE source_id = (
  SELECT id
  FROM sources
  WHERE slug = 'georgia-tech-athletics'
  LIMIT 1
)
  AND is_active = true
  AND start_date >= CURRENT_DATE
  AND title LIKE 'GT %';
