-- Hidden events for personalization
-- Allows users to hide events they're not interested in

CREATE TABLE hidden_events (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  reason VARCHAR(30), -- not_interested, seen_enough, wrong_category, null for quick hide
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, event_id)
);

-- Index for fast lookups when filtering feeds
CREATE INDEX idx_hidden_events_user ON hidden_events(user_id);

-- Enable RLS
ALTER TABLE hidden_events ENABLE ROW LEVEL SECURITY;

-- Users can only see and modify their own hidden events
CREATE POLICY "Users can view own hidden events"
  ON hidden_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own hidden events"
  ON hidden_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own hidden events"
  ON hidden_events FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON TABLE hidden_events IS 'Stores events that users have hidden from their feeds';
COMMENT ON COLUMN hidden_events.reason IS 'Why the user hid this event: not_interested, seen_enough, wrong_category, or null';
