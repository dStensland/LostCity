-- ============================================
-- MIGRATION 451: Deactivate Cobb Critical Materials Duplicate
-- ============================================

UPDATE events
SET is_active = false
WHERE source_id = 87
  AND title = 'Critical Materials & Minerals Expo 2026 (North America)';
