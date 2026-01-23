-- Inferred preferences from user behavior
-- Tracks implicit signals like RSVPs, saves, clicks, shares

CREATE TABLE inferred_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_type VARCHAR(30) NOT NULL, -- category, venue, neighborhood, time_slot, producer
  signal_value VARCHAR(100) NOT NULL,
  score NUMERIC(10,2) DEFAULT 0,
  interaction_count INT DEFAULT 0,
  last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, signal_type, signal_value)
);

-- Index for fast lookups by user and score
CREATE INDEX idx_inferred_prefs_user_score ON inferred_preferences(user_id, score DESC);

-- Index for time-based decay queries
CREATE INDEX idx_inferred_prefs_last_interaction ON inferred_preferences(last_interaction_at);

-- Enable RLS
ALTER TABLE inferred_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only see and modify their own inferred preferences
CREATE POLICY "Users can view own inferred preferences"
  ON inferred_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own inferred preferences"
  ON inferred_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own inferred preferences"
  ON inferred_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own inferred preferences"
  ON inferred_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON TABLE inferred_preferences IS 'Stores inferred user preferences based on behavioral signals like RSVPs, saves, and views';
COMMENT ON COLUMN inferred_preferences.signal_type IS 'Type of preference: category, venue, neighborhood, time_slot, producer';
COMMENT ON COLUMN inferred_preferences.signal_value IS 'The actual value (e.g., "music", "venue:123", "midtown")';
COMMENT ON COLUMN inferred_preferences.score IS 'Accumulated score based on interactions (higher = stronger preference)';
COMMENT ON COLUMN inferred_preferences.interaction_count IS 'Number of interactions contributing to this preference';
