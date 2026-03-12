-- Migration 475: Deactivate closed Atlanta venues (2025)
--
-- EATS Poncey-Highland: permanently closed October 2025.
-- Daddy D'z BBQ Joynt: permanently closed December 2024.
-- Vino Venue: restaurant side closed December 2025; wine shop, tastings,
--   and private events continue. Reclassify venue_type from 'restaurant'
--   to 'wine_bar' — do NOT deactivate.

BEGIN;

-- -------------------------------------------------------------------------
-- 1. EATS (slug: eats-poncey) — permanently closed October 2025
-- -------------------------------------------------------------------------
UPDATE venues
SET
  active = false,
  description = CASE
    WHEN description ILIKE '%Permanently closed. Do not reactivate via crawler.%' THEN description
    WHEN description IS NULL OR btrim(description) = '' THEN 'Permanently closed October 2025. Do not reactivate via crawler.'
    WHEN right(btrim(description), 1) IN ('.', '!', '?') THEN btrim(description) || ' Permanently closed October 2025. Do not reactivate via crawler.'
    ELSE btrim(description) || '. Permanently closed October 2025. Do not reactivate via crawler.'
  END
WHERE slug = 'eats-poncey';

-- Deactivate any sources whose venue_id points to EATS
UPDATE sources
SET is_active = false
WHERE venue_id = (SELECT id FROM venues WHERE slug = 'eats-poncey');

-- -------------------------------------------------------------------------
-- 2. Daddy D'z BBQ Joynt (slug: daddy-dz) — permanently closed December 2024
-- -------------------------------------------------------------------------
UPDATE venues
SET
  active = false,
  description = CASE
    WHEN description ILIKE '%Permanently closed. Do not reactivate via crawler.%' THEN description
    WHEN description IS NULL OR btrim(description) = '' THEN 'Permanently closed December 2024. Do not reactivate via crawler.'
    WHEN right(btrim(description), 1) IN ('.', '!', '?') THEN btrim(description) || ' Permanently closed December 2024. Do not reactivate via crawler.'
    ELSE btrim(description) || '. Permanently closed December 2024. Do not reactivate via crawler.'
  END
WHERE slug = 'daddy-dz';

-- Deactivate any sources whose venue_id points to Daddy D'z
UPDATE sources
SET is_active = false
WHERE venue_id = (SELECT id FROM venues WHERE slug = 'daddy-dz');

-- -------------------------------------------------------------------------
-- 3. Vino Venue (slug: vino-venue) — reclassify only, do NOT deactivate
--    Restaurant side closed December 2025; wine shop, tastings, and private
--    events continue under the same name and address.
-- -------------------------------------------------------------------------
UPDATE venues
SET venue_type = 'wine_bar'
WHERE slug = 'vino-venue'
  AND venue_type = 'restaurant';

COMMIT;
