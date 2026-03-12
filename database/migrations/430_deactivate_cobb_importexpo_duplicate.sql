-- ============================================
-- MIGRATION 430: Deactivate Cobb IMPORTEXPO Duplicate
-- ============================================
-- Once the official organizer source owns IMPORTEXPO Atlanta, the Cobb
-- calendar row should no longer stay active.

UPDATE events
SET is_active = false
WHERE source_id = 87
  AND title = 'IMPORTEXPO CAR SHOW';
