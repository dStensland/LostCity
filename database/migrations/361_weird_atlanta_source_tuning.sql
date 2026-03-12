-- ============================================
-- MIGRATION 361: Weird Atlanta Source Tuning
-- ============================================
-- Tunes source URLs for Atlanta niche festival crawlers after initial
-- production validation.

UPDATE sources
SET url = 'https://frolicon.com/registration/'
WHERE slug = 'frolicon';
