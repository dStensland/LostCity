-- ============================================
-- MIGRATION 462: Deactivate GWCC Dedicated Trade Show Duplicates
-- ============================================
-- When dedicated organizer crawlers exist, the venue-level GWCC source should
-- no longer own these annual convention rows.

UPDATE events
SET is_active = false
WHERE source_id IN (
  SELECT id
  FROM sources
  WHERE slug = 'gwcc'
)
AND lower(title) IN (
  'modex 2026',
  'transact 2026',
  'international woodworking fair 2026'
);
