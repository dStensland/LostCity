-- Migration: Add Discovery Mode onboarding support
-- Adds mood tracking and onboarding interaction analytics

-- Add onboarding fields to user_preferences
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS onboarding_mood VARCHAR(20),
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Add constraint for valid mood values
ALTER TABLE user_preferences
DROP CONSTRAINT IF EXISTS valid_onboarding_mood;

ALTER TABLE user_preferences
ADD CONSTRAINT valid_onboarding_mood
CHECK (onboarding_mood IS NULL OR onboarding_mood IN ('chill', 'wild', 'social', 'culture'));

-- Create onboarding_interactions table for analytics
CREATE TABLE IF NOT EXISTS onboarding_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  step VARCHAR(30) NOT NULL,
  event_id INT REFERENCES events(id) ON DELETE SET NULL,
  action VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add constraint for valid step values
ALTER TABLE onboarding_interactions
ADD CONSTRAINT valid_onboarding_step
CHECK (step IN ('mood', 'swipe', 'neighborhood', 'producer'));

-- Add constraint for valid action values
ALTER TABLE onboarding_interactions
ADD CONSTRAINT valid_onboarding_action
CHECK (action IN ('select', 'like', 'skip', 'follow'));

-- Index for efficient querying by user
CREATE INDEX IF NOT EXISTS idx_onboarding_interactions_user_id
ON onboarding_interactions(user_id);

-- Index for analytics queries by step
CREATE INDEX IF NOT EXISTS idx_onboarding_interactions_step
ON onboarding_interactions(step, action);

-- Enable RLS
ALTER TABLE onboarding_interactions ENABLE ROW LEVEL SECURITY;

-- Users can insert their own interactions
CREATE POLICY "Users can insert own onboarding interactions"
ON onboarding_interactions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can view their own interactions
CREATE POLICY "Users can view own onboarding interactions"
ON onboarding_interactions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Comment on new columns
COMMENT ON COLUMN user_preferences.onboarding_mood IS 'Selected mood during Discovery Mode onboarding: chill, wild, social, or culture';
COMMENT ON COLUMN user_preferences.onboarding_completed_at IS 'Timestamp when user completed Discovery Mode onboarding';
COMMENT ON TABLE onboarding_interactions IS 'Analytics table tracking user interactions during Discovery Mode onboarding';
