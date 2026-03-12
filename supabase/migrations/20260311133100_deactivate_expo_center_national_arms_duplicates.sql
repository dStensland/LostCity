-- ============================================
-- MIGRATION 20260311133100: Deactivate Expo Center National Arms Duplicates
-- ============================================
-- Once the dedicated R.K. Atlanta Gun Show organizer source is active,
-- Atlanta Expo Centers should no longer own the shell rows.

UPDATE events
SET is_active = false
WHERE source_id = 1464
  AND title = 'National Arms Show';
