-- Add blurhash columns to events and venues tables
-- BlurHash is a compact representation of a placeholder for an image
-- It encodes the image as a short string (~20-30 chars) that can be decoded
-- client-side into a blurred placeholder, eliminating blank-image flash while loading

-- Add blurhash to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS blurhash text;
COMMENT ON COLUMN events.blurhash IS 'BlurHash string for image placeholder while image loads';

-- Add blurhash to venues table
ALTER TABLE venues ADD COLUMN IF NOT EXISTS blurhash text;
COMMENT ON COLUMN venues.blurhash IS 'BlurHash string for image placeholder while image loads';
