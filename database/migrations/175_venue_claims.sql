-- Venue Claims System
-- Enables venue owners to claim their listings and gain management access

-- Venue claims table
CREATE TABLE venue_claims (
  id SERIAL PRIMARY KEY,
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  proof_url TEXT,
  rejection_reason TEXT,
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add claimed_by to venues table to track active ownership
ALTER TABLE venues
ADD COLUMN claimed_by TEXT REFERENCES auth.users(id),
ADD COLUMN claimed_at TIMESTAMPTZ,
ADD COLUMN is_verified BOOLEAN DEFAULT false;

-- Indexes
CREATE INDEX idx_venue_claims_venue ON venue_claims(venue_id);
CREATE INDEX idx_venue_claims_user ON venue_claims(user_id);
CREATE INDEX idx_venue_claims_status ON venue_claims(status);
CREATE INDEX idx_venues_claimed_by ON venues(claimed_by);

-- Only one active claim per venue
CREATE UNIQUE INDEX idx_venue_claims_active ON venue_claims(venue_id)
WHERE status = 'pending';

-- Only one approved claim per venue (enforced at app level too)
CREATE UNIQUE INDEX idx_venue_claims_approved ON venue_claims(venue_id)
WHERE status = 'approved';

-- Trigger to update updated_at
CREATE TRIGGER update_venue_claims_updated_at
  BEFORE UPDATE ON venue_claims
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS policies for venue_claims
ALTER TABLE venue_claims ENABLE ROW LEVEL SECURITY;

-- Users can view their own claims
CREATE POLICY "Users can view own claims"
  ON venue_claims FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create claims
CREATE POLICY "Users can create claims"
  ON venue_claims FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all claims
CREATE POLICY "Admins can view all claims"
  ON venue_claims FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Admins can update claims (approve/reject)
CREATE POLICY "Admins can update claims"
  ON venue_claims FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Track venue-submitted events separately
ALTER TABLE events
ADD COLUMN source_type TEXT DEFAULT 'crawler' CHECK (source_type IN ('crawler', 'venue_submission', 'user_submission'));

-- Add submitted_by to track who created the event
ALTER TABLE events
ADD COLUMN submitted_by TEXT REFERENCES auth.users(id);

CREATE INDEX idx_events_source_type ON events(source_type);
CREATE INDEX idx_events_submitted_by ON events(submitted_by);

-- Comments for documentation
COMMENT ON TABLE venue_claims IS 'Venue ownership claims by users';
COMMENT ON COLUMN venues.claimed_by IS 'User who owns this venue (if claimed and approved)';
COMMENT ON COLUMN venues.is_verified IS 'Whether the venue claim has been verified';
COMMENT ON COLUMN events.source_type IS 'How this event was created: crawler, venue_submission, or user_submission';
COMMENT ON COLUMN events.submitted_by IS 'User who submitted this event (for venue/user submissions)';
