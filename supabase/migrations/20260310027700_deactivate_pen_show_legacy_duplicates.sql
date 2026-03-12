-- ============================================
-- MIGRATION 20260310027700: Deactivate Atlanta Pen Show Legacy Duplicates
-- ============================================
-- The schedule-backed crawl now creates timed Atlanta Pen Show sessions.
-- Deactivate older same-source placeholder rows for March 27, 2026 that lack
-- times and point at outdated/root URLs.

UPDATE events
SET is_active = false
WHERE source_id = (SELECT id FROM sources WHERE slug = 'atlanta-pen-show')
  AND start_date = DATE '2026-03-27'
  AND start_time IS NULL
  AND source_url IN (
    'https://www.atlantapenshow.info',
    'https://atlpenshow.com/'
  );
