-- ============================================
-- MIGRATION 458: Deactivate GICC GaETC Duplicate
-- ============================================

UPDATE events
SET is_active = false
WHERE source_id = 88
  AND title = 'The Georgia Educational Technology Conference';
