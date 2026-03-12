-- Create general-purpose flags table for user-reported issues on events, venues, producers
CREATE TABLE IF NOT EXISTS flags (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('event', 'venue', 'producer', 'organization')),
  entity_id BIGINT NOT NULL,
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 1000),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_flags_entity ON flags(entity_type, entity_id);
CREATE INDEX idx_flags_status ON flags(status) WHERE status = 'pending';

-- RLS: anyone can insert (anonymous flagging), only authenticated users can read their own flags
ALTER TABLE flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create flags"
  ON flags FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can read their own flags"
  ON flags FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Service role bypasses RLS for admin review
