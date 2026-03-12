-- ============================================
-- MIGRATION 445: Deactivate Expo Center Nationwide Duplicates
-- ============================================
-- Once the dedicated Atlanta Home and Remodeling Show organizer source is
-- active, Atlanta Expo Centers should no longer own the shell rows.

UPDATE events
SET is_active = false
WHERE source_id = 1464
  AND title = 'Nationwide Expo Home Show';
