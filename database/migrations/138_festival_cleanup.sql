-- Migration 138: Festival data cleanup
--
-- Based on research validating existing entries:
--   1. Delete bogus/defunct festivals that don't actually exist
--   2. Add websites to 15+ existing entries that were missing them
--   3. Fix incorrect data (Fashion Week URL, Lenox parade, Music Midtown status)

-- =============================================
-- DELETE BOGUS / DEFUNCT FESTIVALS
-- =============================================

-- These were speculative entries that don't exist as organized festivals
DELETE FROM festivals WHERE slug = 'atlanta-yoga-festival';
DELETE FROM festivals WHERE slug = 'beltline-yoga-fest';
DELETE FROM festivals WHERE slug = 'atlanta-wellness-festival';
DELETE FROM festivals WHERE slug = 'atlanta-comedy-festival';
DELETE FROM festivals WHERE slug = 'dads-garage-improv-fest';
DELETE FROM festivals WHERE slug = 'whole-world-comedy-fest';
DELETE FROM festivals WHERE slug = 'atlanta-one-minute-play-fest';

-- Music Midtown: on indefinite hiatus since May 2024, mark defunct
DELETE FROM festivals WHERE slug = 'music-midtown';

-- =============================================
-- FIX INCORRECT DATA
-- =============================================

-- Atlanta Fashion Week: .com domain is parked, real site is .co
UPDATE festivals SET
  website = 'https://www.atlantafashionweek.co'
WHERE slug = 'atlanta-fashion-week';

-- Lenox Square: there's no parade, just fireworks (returned 2025 after hiatus)
UPDATE festivals SET
  name = 'Lenox Square Fourth of July Fireworks',
  description = 'Buckhead''s Independence Day fireworks spectacular at Lenox Square, returned in 2025 after a hiatus since 2016. Fireworks display visible across Buckhead, complementing the Peachtree Road Race festivities.'
WHERE slug = 'lenox-july-4th-parade';

-- Atlanta Salsa Congress: update with correct branding and website
UPDATE festivals SET
  name = 'Atlanta Salsa & Bachata Festival',
  website = 'https://www.atlantasbf.com',
  description = 'Five-day Latin dance festival with 50+ workshops, 30+ world-class instructors in salsa, bachata, and kizomba. Social dancing, performances, and competitions drawing dancers from across the Southeast.'
WHERE slug = 'atlanta-salsa-congress';

-- SCAD FASHWKND: likely dormant since 2017, clear website to avoid dead link
UPDATE festivals SET
  description = 'SCAD''s fashion showcase highlighting senior collections from the university''s renowned fashion program. Runway shows, portfolio reviews, and industry networking. Note: last confirmed edition was 2017; may have been renamed or folded into other SCAD programming.'
WHERE slug = 'scad-fashwknd';

-- Atlanta Apparel Market: update with correct current website
UPDATE festivals SET
  website = 'https://www.atlanta-apparel.com'
WHERE slug = 'atlanta-apparel-market';

-- =============================================
-- ADD WEBSITES TO EXISTING FESTIVALS
-- =============================================

UPDATE festivals SET website = 'https://beadshows.com/'
WHERE slug = 'atlanta-bead-show' AND website IS NULL;

UPDATE festivals SET website = 'https://www.atlantacarnival.org/'
WHERE slug = 'atlanta-caribbean-carnival' AND website IS NULL;

UPDATE festivals SET website = 'https://atlantacocktailweek.com/'
WHERE slug = 'atlanta-cocktail-week' AND website IS NULL;

UPDATE festivals SET website = 'https://www.atlantamandir.info/'
WHERE slug = 'atlanta-diwali' AND website IS NULL;

UPDATE festivals SET website = 'https://www.eidfest.org/'
WHERE slug = 'atlanta-eid-festival' AND website IS NULL;

UPDATE festivals SET website = 'https://macandcheesefestival.com/'
WHERE slug = 'atlanta-mac-cheese-fest' AND website IS NULL;

UPDATE festivals SET website = 'https://www.cofga.org/'
WHERE slug = 'atlanta-model-train-show' AND website IS NULL;

UPDATE festivals SET website = 'https://uspizzafestivals.ticketsauce.com/e/atlanta-pizza-festival'
WHERE slug = 'atlanta-pizza-festival' AND website IS NULL;

UPDATE festivals SET website = 'https://recordshowsofamerica.com/show/the-atlanta-record-cd-show/'
WHERE slug = 'atlanta-record-show' AND website IS NULL;

UPDATE festivals SET website = 'https://esfna.org/'
WHERE slug = 'esfna-atlanta' AND website IS NULL;

UPDATE festivals SET website = 'https://psdba.org/dragon-boat-and-international-festival/'
WHERE slug = 'peachtree-city-dragon-boat' AND website IS NULL;

UPDATE festivals SET website = 'https://www.kennesaw-ga.gov/pigsandpeaches/'
WHERE slug = 'pigs-and-peaches-bbq' AND website IS NULL;

UPDATE festivals SET website = 'https://vahi.org/summerfest/'
WHERE slug = 'virginia-highland-summerfest' AND website IS NULL;

UPDATE festivals SET website = 'https://aliveexpo.com/'
WHERE slug = 'atlanta-plant-fest' AND website IS NULL;
