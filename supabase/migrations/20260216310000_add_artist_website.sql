-- Add artist website for outbound profile links.
ALTER TABLE artists
ADD COLUMN IF NOT EXISTS website TEXT;
