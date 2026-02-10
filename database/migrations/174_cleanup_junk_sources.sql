-- Migration 174: Clean up junk event sources
-- These changes were applied live; this migration records them for consistency.
--
-- 1. Delete all events from source 709 (laughing-skull-comedy-fest)
--    - Fake festival source that duplicated the real venue crawler (source 22, laughing-skull)
-- 2. Delete all events from source 132 (decatur-arts-festival)
--    - Produced junk titles like "Sunday, May 4, 11 am – 5 pm" and section headings
-- 3. Deactivate source 132 (decatur-arts-festival)
-- 4. Delete source 709 entirely (was a bogus duplicate)
-- 5. Confirm source 588 (decatur-wine-festival) remains is_active = false

BEGIN;

-- Delete junk events from both sources
DELETE FROM events WHERE source_id = 709;
DELETE FROM events WHERE source_id = 132;

-- Deactivate decatur-arts-festival
UPDATE sources SET is_active = false WHERE id = 132;

-- Remove the bogus laughing-skull-comedy-fest source entirely
-- (duplicated the real laughing-skull venue crawler, source 22)
DELETE FROM sources WHERE id = 709;

-- Verify decatur-wine-festival stays inactive (no-op, just documenting)
-- SELECT id, slug, is_active FROM sources WHERE id = 588;
-- Expected: is_active = false

COMMIT;

-- DOWN
-- INSERT INTO sources (id, slug, is_active) VALUES (709, 'laughing-skull-comedy-fest', true);
-- UPDATE sources SET is_active = true WHERE id = 132;
-- (Events cannot be restored without a full backup)
