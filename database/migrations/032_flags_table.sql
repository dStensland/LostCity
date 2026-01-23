-- Flags table for QA reporting
-- Users can flag events, venues, or producers for errors during beta

CREATE TABLE IF NOT EXISTS flags (
  id SERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('event', 'venue', 'producer')),
  entity_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_note TEXT
);

-- Index for quick lookups
CREATE INDEX idx_flags_entity ON flags(entity_type, entity_id);
CREATE INDEX idx_flags_status ON flags(status);
CREATE INDEX idx_flags_created ON flags(created_at DESC);

-- RLS policies
ALTER TABLE flags ENABLE ROW LEVEL SECURITY;

-- Anyone can create a flag
CREATE POLICY "Anyone can create flags" ON flags
  FOR INSERT WITH CHECK (true);

-- Users can see their own flags
CREATE POLICY "Users can view own flags" ON flags
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can see all flags (we'll need an admin check later)
-- For now, service role can see all
