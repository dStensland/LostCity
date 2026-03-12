-- ============================================
-- MIGRATION 348: Indivisible ATL ticket_url cleanup
-- ============================================
-- The Indivisible ATL crawler previously stored event detail pages as
-- ticket_url values. The crawler now leaves ticket_url null for these civic
-- action events, so clear the stale future rows to match source truth.

UPDATE events
SET ticket_url = NULL
WHERE source_id = (SELECT id FROM sources WHERE slug = 'indivisible-atl')
  AND start_date >= CURRENT_DATE
  AND ticket_url = source_url;
