-- Migration 287: Convert a mano + Buena Vida drink promos from events to venue_specials
-- These events from source 1177 are venue attributes (drink promos, charity nights),
-- not programmed activities. Move to venue_specials and exclude from Regulars.

-- ============================================================================
-- UP
-- ============================================================================

-- 1. Create venue_specials for a mano drink promos
-- a mano slug: "a-mano" (Italian wine bar, Old Fourth Ward)
INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, price_note, source_url, confidence)
SELECT
  v.id,
  'Spritzy Saturdays',
  'drink_special',
  'Saturday Aperol spritzes and Italian cocktail specials at a mano.',
  '{6}',  -- Saturday (ISO 8601: 6=Sat)
  NULL,
  NULL,
  'https://www.amanoatl.com',
  'medium'
FROM venues v WHERE v.slug = 'a-mano'
ON CONFLICT DO NOTHING;

INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, price_note, source_url, confidence)
SELECT
  v.id,
  'Lends a Hand Night',
  'recurring_deal',
  'Weekly charity night at a mano. A portion of proceeds supports a rotating local cause.',
  NULL,  -- day unknown
  NULL,
  NULL,
  'https://www.amanoatl.com',
  'medium'
FROM venues v WHERE v.slug = 'a-mano'
ON CONFLICT DO NOTHING;

-- 2. Create venue_specials for Buena Vida
INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, price_note, source_url, confidence)
SELECT
  v.id,
  'Candlelight Wednesdays',
  'drink_special',
  'Wednesday candlelight ambiance with drink specials at Buena Vida.',
  '{3}',  -- Wednesday (ISO 8601: 3=Wed)
  NULL,
  NULL,
  NULL,
  'medium'
FROM venues v WHERE v.slug = 'buena-vida'
ON CONFLICT DO NOTHING;

-- 3. Exclude these events from Regulars by setting is_regular_ready = false
-- Match by title + source_id 1177 (venue specials source)
UPDATE events
SET is_regular_ready = false, updated_at = NOW()
WHERE source_id = 1177
  AND title IN ('Spritzy Saturdays', 'a mano Lends a Hand Night', 'Candlelight Wednesdays')
  AND is_regular_ready = true;

-- ============================================================================
-- DOWN
-- ============================================================================
-- DELETE FROM venue_specials WHERE title IN ('Spritzy Saturdays', 'Lends a Hand Night', 'Candlelight Wednesdays')
--   AND venue_id IN (SELECT id FROM venues WHERE slug IN ('a-mano', 'buena-vida'));
-- UPDATE events SET is_regular_ready = true WHERE source_id = 1177
--   AND title IN ('Spritzy Saturdays', 'a mano Lends a Hand Night', 'Candlelight Wednesdays');
