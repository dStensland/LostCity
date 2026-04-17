-- Artist claim fields — allows artists to claim their auto-generated profiles.
-- Claimed profiles can add bio, website, instagram, and get a verified badge.

ALTER TABLE artists
  ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS instagram TEXT;

-- Website column may already exist on artists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artists' AND column_name = 'website'
  ) THEN
    ALTER TABLE artists ADD COLUMN website TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_artists_claimed_by ON artists(claimed_by) WHERE claimed_by IS NOT NULL;

COMMENT ON COLUMN artists.claimed_by IS 'User ID of the artist who claimed this profile';
COMMENT ON COLUMN artists.is_verified IS 'Admin-verified after claim review';
