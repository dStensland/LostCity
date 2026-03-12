-- ============================================
-- MIGRATION 457: Deactivate GICC SMU Steel Summit Duplicate
-- ============================================

UPDATE events
SET is_active = false
WHERE source_id = 88
  AND title = 'SMU Steel Summit';
