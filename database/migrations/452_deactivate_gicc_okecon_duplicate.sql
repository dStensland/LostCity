-- ============================================
-- MIGRATION 452: Deactivate GICC OkeCon Duplicate
-- ============================================

UPDATE events
SET is_active = false
WHERE source_id = 88
  AND title = 'Okecon Tcg';
