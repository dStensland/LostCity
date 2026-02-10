-- ============================================
-- MIGRATION 173: Cross-Portal Preferences Toggle
-- ============================================
-- Add user control over cross-portal personalization.
-- Allows users to opt out of using activity from all portals for recommendations.

ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS cross_portal_recommendations BOOLEAN DEFAULT true;

COMMENT ON COLUMN user_preferences.cross_portal_recommendations
IS 'If true (default), user activity across all portals informs recommendations. If false, only current portal activity is used.';
