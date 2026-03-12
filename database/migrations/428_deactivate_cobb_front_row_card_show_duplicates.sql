-- ============================================
-- MIGRATION 428: Deactivate Cobb Front Row Card Show Duplicates
-- ============================================
-- Once the official organizer source owns Front Row Card Show Atlanta, the
-- Cobb Galleria venue source should no longer keep the partial duplicate rows.

UPDATE events
SET is_active = false
WHERE source_id = 87
  AND title = 'Front Row Card Show';
