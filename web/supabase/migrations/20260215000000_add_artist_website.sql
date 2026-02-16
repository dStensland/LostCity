-- Add website column to artists for outbound artist profile links.
ALTER TABLE artists
ADD COLUMN IF NOT EXISTS website TEXT;
