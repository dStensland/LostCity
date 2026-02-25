-- Add layout_variant column to portal_feed_headers
-- Allows admins to choose between different GreetingBar layout treatments.
-- NULL = algorithmic rotation (default behavior).

ALTER TABLE portal_feed_headers
  ADD COLUMN IF NOT EXISTS layout_variant VARCHAR(20) DEFAULT NULL;

COMMENT ON COLUMN portal_feed_headers.layout_variant IS
  'GreetingBar layout: centered, bottom-left, split, editorial. NULL = auto-rotate.';
