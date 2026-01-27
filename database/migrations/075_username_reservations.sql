-- ============================================
-- MIGRATION 075: Username Reservations Table
-- ============================================
-- Prevents username race conditions during signup
-- by temporarily reserving usernames before profile creation
-- ============================================

-- Username reservation table for race condition prevention
CREATE TABLE IF NOT EXISTS username_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient cleanup of expired reservations
CREATE INDEX IF NOT EXISTS idx_username_reservations_expires
  ON username_reservations(expires_at);

-- Index for username lookups
CREATE INDEX IF NOT EXISTS idx_username_reservations_username
  ON username_reservations(username);

-- Enable RLS
ALTER TABLE username_reservations ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read reservations (needed for checking availability)
CREATE POLICY "username_reservations_select"
  ON username_reservations
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Allow authenticated users to insert reservations
CREATE POLICY "username_reservations_insert"
  ON username_reservations
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Allow deletion of expired reservations (for cleanup)
CREATE POLICY "username_reservations_delete"
  ON username_reservations
  FOR DELETE
  TO authenticated, anon
  USING (expires_at < NOW());

-- Function to check and reserve a username atomically
CREATE OR REPLACE FUNCTION check_and_reserve_username(
  p_username TEXT,
  p_reservation_ttl INTERVAL DEFAULT '5 minutes'::INTERVAL
)
RETURNS TABLE(available BOOLEAN, reservation_id UUID) AS $$
DECLARE
  v_reservation_id UUID;
BEGIN
  -- Clean expired reservations first
  DELETE FROM username_reservations WHERE expires_at < NOW();

  -- Check if username exists in profiles
  IF EXISTS (SELECT 1 FROM profiles WHERE username = p_username) THEN
    RETURN QUERY SELECT false, NULL::UUID;
    RETURN;
  END IF;

  -- Check if username is already reserved
  IF EXISTS (
    SELECT 1 FROM username_reservations
    WHERE username = p_username AND expires_at > NOW()
  ) THEN
    RETURN QUERY SELECT false, NULL::UUID;
    RETURN;
  END IF;

  -- Reserve the username
  INSERT INTO username_reservations (username, expires_at)
  VALUES (p_username, NOW() + p_reservation_ttl)
  RETURNING id INTO v_reservation_id;

  RETURN QUERY SELECT true, v_reservation_id;

EXCEPTION
  WHEN unique_violation THEN
    -- Username was just taken/reserved by another request
    RETURN QUERY SELECT false, NULL::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to release a reservation
CREATE OR REPLACE FUNCTION release_username_reservation(p_reservation_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  DELETE FROM username_reservations WHERE id = p_reservation_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-cleanup function via trigger (runs on each insert)
CREATE OR REPLACE FUNCTION cleanup_expired_reservations()
RETURNS TRIGGER AS $$
BEGIN
  -- Clean up reservations older than 1 hour on each insert
  -- This prevents table bloat while keeping recent reservations
  DELETE FROM username_reservations
  WHERE expires_at < NOW() - INTERVAL '1 hour';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to cleanup on new inserts
DROP TRIGGER IF EXISTS tr_cleanup_reservations ON username_reservations;
CREATE TRIGGER tr_cleanup_reservations
  AFTER INSERT ON username_reservations
  EXECUTE FUNCTION cleanup_expired_reservations();
