-- Migration 144: Festival data quality cleanup
--
-- A. Clear bogus announced dates (Feb 2026 import artifacts where typical_month != 2)
-- B. Clear stale pre-2025 dates
-- C. Clear Jan 2026 import artifacts where typical_month != 1
-- D. Remove 4 duplicate festival pairs (reassign series first)
-- E. Remove ~19 non-festival entries (single games, promos, trade shows, concert series)
-- F. Clear bad descriptions (scraped taglines, outdated references)

BEGIN;

-- ============================================================
-- A. Clear bogus Feb 2026 dates (import artifacts)
-- These all have announced_start in Feb 2026 but typical_month != 2
-- ============================================================

UPDATE festivals
SET announced_start = NULL, announced_end = NULL, announced_2026 = false
WHERE slug IN (
  'atlanta-fashion-week',
  'illuminights-zoo',
  'college-football-playoff-natl',
  'chick-fil-a-peach-bowl',
  'dreamhack-atlanta',
  'atlanta-film-festival',
  'petit-le-mans',
  'sec-championship-game',
  'johns-creek-arts-fest',
  'johns-creek-diwali',
  'taste-of-marietta',
  'atlanta-supercross',
  'acworth-beer-wine-fest',
  'acworth-dragon-boat-festival',
  'big-shanty-festival',
  'laughing-skull-comedy-fest',
  'candler-park-fall-fest',
  'johns-creek-international-fest',
  'newnan-porchfest',
  'countdown-over-atl',
  'georgia-vegfest',
  'lake-lanier-oktoberfest',
  'lake-lanier-lights',
  'snellville-days',
  'southern-fried-queer-pride',
  'dahlonega-arts-wine',
  'stone-mountain-christmas',
  'stone-mountain-fantastic-fourth',
  'stone-mountain-dino-fest',
  'stone-mountain-latino-fest',
  'spartan-race-atlanta',
  'garden-lights-holiday-nights',
  'panda-fest-atlanta',
  'thanksgiving-half-marathon'
);

-- ============================================================
-- B. Clear stale pre-2025 dates
-- ============================================================

UPDATE festivals
SET announced_start = NULL, announced_end = NULL, announced_2026 = false
WHERE announced_start < '2025-01-01';

-- ============================================================
-- C. Clear stale 2025 dates (events that already happened)
-- ============================================================

UPDATE festivals
SET announced_start = NULL, announced_end = NULL, announced_2026 = false
WHERE announced_start < '2026-01-01';

-- ============================================================
-- D. Clear Jan 2026 import artifacts (typical_month != 1)
-- ============================================================

UPDATE festivals
SET announced_start = NULL, announced_end = NULL, announced_2026 = false
WHERE slug IN (
  'atl-comedy-film-fest',
  'lawrenceville-boogie',
  'alliance-collision-project'
);
-- Note: atlanta-apparel-market and atlanta-united-season-opener are deleted below as non-festivals

-- ============================================================
-- E. Remove duplicate festivals (reassign series first)
-- ============================================================

-- 1. atlanta-wine-week → merge into atlanta-food-wine-festival
-- (no linked series to reassign)
DELETE FROM festivals WHERE slug = 'atlanta-wine-week';

-- 2. atlanta-salsa-congress → merge into atlanta-salsa-bachata-festival
-- (no linked series to reassign)
DELETE FROM festivals WHERE slug = 'atlanta-salsa-congress';

-- 3. shaky-knees-festival → merge into shaky-knees (has better data)
UPDATE series SET festival_id = 'shaky-knees'
WHERE festival_id = 'shaky-knees-festival';
DELETE FROM festivals WHERE slug = 'shaky-knees-festival';

-- 4. covington-vampire-diaries → merge into covington-vampire-diaries-fest (has series)
UPDATE series SET festival_id = 'covington-vampire-diaries-fest'
WHERE festival_id = 'covington-vampire-diaries';
DELETE FROM festivals WHERE slug = 'covington-vampire-diaries';

-- ============================================================
-- F. Remove non-festival entries
-- Unlink series first, then delete festival record
-- ============================================================

-- Single sports games
UPDATE series SET festival_id = NULL, series_type = 'recurring_show'
WHERE festival_id IN (
  'atlanta-braves-opening-day',
  'atlanta-hawks-home-opener',
  'atlanta-united-season-opener',
  'chick-fil-a-peach-bowl',
  'chick-fil-a-kickoff-game',
  'sec-championship-game',
  'college-football-playoff-natl'
);
DELETE FROM festivals WHERE slug IN (
  'atlanta-braves-opening-day',
  'atlanta-hawks-home-opener',
  'atlanta-united-season-opener',
  'chick-fil-a-peach-bowl',
  'chick-fil-a-kickoff-game',
  'sec-championship-game',
  'college-football-playoff-natl'
);

-- Team promo events
UPDATE series SET festival_id = NULL, series_type = 'recurring_show'
WHERE festival_id IN ('braves-fest', 'braves-country-fest');
DELETE FROM festivals WHERE slug IN ('braves-fest', 'braves-country-fest');

-- Recurring events (not festivals)
UPDATE series SET festival_id = NULL, series_type = 'recurring_show'
WHERE festival_id IN ('woodstock-summer-concert-series', 'fernbank-after-dark', 'atlanta-coin-show');
DELETE FROM festivals WHERE slug IN ('woodstock-summer-concert-series', 'fernbank-after-dark', 'atlanta-coin-show');

-- Promo campaigns (not festivals)
UPDATE series SET festival_id = NULL, series_type = 'recurring_show'
WHERE festival_id IN ('atlanta-restaurant-week', 'atlanta-cocktail-week');
DELETE FROM festivals WHERE slug IN ('atlanta-restaurant-week', 'atlanta-cocktail-week');

-- Trade shows
UPDATE series SET festival_id = NULL, series_type = 'recurring_show'
WHERE festival_id IN ('atlanta-apparel-market', 'atlanta-home-show');
DELETE FROM festivals WHERE slug IN ('atlanta-apparel-market', 'atlanta-home-show');

-- Alliance Theatre season (not a festival)
UPDATE series SET festival_id = NULL, series_type = 'recurring_show'
WHERE festival_id = 'alliance-collision-project';
DELETE FROM festivals WHERE slug = 'alliance-collision-project';

-- ============================================================
-- G. Clear bad descriptions
-- ============================================================

-- Scraped tagline with outdated date reference
UPDATE festivals SET description = NULL
WHERE slug = 'decatur-book-festival'
  AND description LIKE '%20th Anniversary%';

-- Scraped navigation/junk text
UPDATE festivals SET description = NULL
WHERE slug = 'east-atlanta-strut'
  AND description LIKE '%Thanks for strutting%';

-- Outdated date reference in description
UPDATE festivals SET description = NULL
WHERE slug = 'shaky-knees'
  AND description LIKE '%Stay connected for upcoming%';

COMMIT;
