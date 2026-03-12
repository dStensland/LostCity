-- ==========================================================
-- MIGRATION 410: Fix Atlanta Natatorium Open Swim Class Flag
-- ==========================================================

UPDATE events
SET is_class = false
WHERE source_id = (
  SELECT id
  FROM sources
  WHERE slug = 'atlanta-natatorium-open-swim'
  LIMIT 1
)
  AND is_active = true
  AND start_date >= CURRENT_DATE;
