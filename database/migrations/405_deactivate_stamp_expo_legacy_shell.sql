-- ============================================
-- MIGRATION 405: Deactivate Stamp Expo Legacy Shell
-- ============================================
-- Retires the low-quality null-time annual shell now that deterministic daily
-- sessions exist for the current show.

UPDATE events
SET is_active = false
WHERE id = 66801;
