-- Add text_treatment column to portal_feed_headers
-- Controls how text renders over hero photos: gradient intensity, shadows, backdrop effects.
-- NULL / 'auto' = algorithm picks based on time slot.

ALTER TABLE portal_feed_headers
  ADD COLUMN IF NOT EXISTS text_treatment VARCHAR(20) DEFAULT NULL;

COMMENT ON COLUMN portal_feed_headers.text_treatment IS
  'Text rendering preset: auto, clean, frosted, bold, cinematic. NULL = auto.';
