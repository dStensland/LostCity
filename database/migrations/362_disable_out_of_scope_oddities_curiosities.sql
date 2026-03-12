-- ============================================
-- MIGRATION 362: Disable Out-of-Scope Oddities Source
-- ============================================
-- The official Oddities & Curiosities Expo schedule page is currently listing
-- non-Atlanta stops, so keep the source registered but inactive for the
-- Atlanta portal until an Atlanta-specific stop returns.

UPDATE sources
SET is_active = false
WHERE slug = 'oddities-curiosities-expo';
