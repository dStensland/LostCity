-- Mirror of database/migrations/462_deactivate_gwcc_dedicated_trade_show_duplicates.sql
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
