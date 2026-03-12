-- ============================================
-- MIGRATION 450: Deactivate Cobb Atlanta Home Show Duplicate
-- ============================================

UPDATE events
SET is_active = false
WHERE source_id = 87
  AND title = 'Atlanta Home Show';
