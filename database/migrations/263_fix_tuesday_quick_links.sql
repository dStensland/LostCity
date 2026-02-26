-- Fix broken quick link and dashboard card URLs in portal_feed_headers.
--
-- Issues fixed:
--   1. type=spots → type=destinations (spots is not a valid type param)
--   2. venue_types= (plural) → venue_type= (singular)
--   3. tags=X on destination links → proper filter params
--      - tags=coffee    → cuisine=coffee&tab=eat-drink
--      - tags=brunch    → cuisine=brunch_breakfast&tab=eat-drink
--      - tags=tacos     → cuisine=mexican&tab=eat-drink&label=Taco+Tuesday
--      - tags=happy-hour→ vibes=happy-hour
--      - tags=late-night→ vibes=late-night&tab=eat-drink
--      - tags=wine      → venue_type=bar&vibes=wine&tab=eat-drink
--
-- Note: tags= on event links (e.g. tags=market,farmers-market) are valid and left unchanged.
-- The destination-specific tags all appear at the end of the href before the closing quote,
-- so "tags=X"" is a safe replacement anchor.

BEGIN;

-- =========================================================================
-- Fix quick_links JSONB column
-- =========================================================================
-- Order matters: replace tags= patterns first, then venue_types→venue_type,
-- then type=spots→type=destinations.

UPDATE portal_feed_headers
SET quick_links = (
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
    quick_links::text,
    'tags=coffee"', 'cuisine=coffee&tab=eat-drink"'),
    'tags=brunch"', 'cuisine=brunch_breakfast&tab=eat-drink"'),
    'tags=tacos"', 'cuisine=mexican&tab=eat-drink&label=Taco+Tuesday"'),
    'tags=happy-hour"', 'vibes=happy-hour"'),
    'tags=late-night"', 'vibes=late-night&tab=eat-drink"'),
    'tags=wine"', 'venue_type=bar&vibes=wine&tab=eat-drink"'),
    'venue_types=', 'venue_type='),
    'type=spots', 'type=destinations')
)::jsonb
WHERE quick_links IS NOT NULL;

-- =========================================================================
-- Fix dashboard_cards JSONB column
-- =========================================================================
-- Dashboard cards use type=spots and venue_types= but don't use tags= on
-- destination-type links (they already use cuisine= etc).

UPDATE portal_feed_headers
SET dashboard_cards = (
  replace(
  replace(
    dashboard_cards::text,
    'venue_types=', 'venue_type='),
    'type=spots', 'type=destinations')
)::jsonb
WHERE dashboard_cards IS NOT NULL;

-- =========================================================================
-- Targeted fix: add tab + label to taco dashboard cards
-- =========================================================================
-- After the bulk type=spots fix, the taco cards have correct type=destinations
-- but are missing tab=eat-drink and label. Add them.

UPDATE portal_feed_headers
SET dashboard_cards = replace(
  dashboard_cards::text,
  'type=destinations&venue_type=restaurant&cuisine=mexican"',
  'type=destinations&venue_type=restaurant&cuisine=mexican&tab=eat-drink&label=Taco+Spots"'
)::jsonb
WHERE slug IN ('tue-lunch', 'tue-afternoon')
  AND dashboard_cards::text LIKE '%cuisine=mexican%';

COMMIT;
