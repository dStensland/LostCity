-- Lost City: Price Estimation Migration
-- Adds typical price ranges to venues and categories for estimation

-- ============================================
-- 1. Add typical price columns to venues
-- ============================================
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS typical_price_min DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS typical_price_max DECIMAL(10, 2);

-- ============================================
-- 2. Add typical price columns to categories
-- ============================================
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS typical_price_min DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS typical_price_max DECIMAL(10, 2);

-- ============================================
-- 3. Set category price defaults
-- ============================================
UPDATE categories SET typical_price_min = 15, typical_price_max = 30 WHERE id = 'music';
UPDATE categories SET typical_price_min = 12, typical_price_max = 18 WHERE id = 'film';
UPDATE categories SET typical_price_min = 15, typical_price_max = 35 WHERE id = 'comedy';
UPDATE categories SET typical_price_min = 25, typical_price_max = 80 WHERE id = 'theater';
UPDATE categories SET typical_price_min = 15, typical_price_max = 25 WHERE id = 'art';
UPDATE categories SET typical_price_min = 20, typical_price_max = 100 WHERE id = 'sports';
UPDATE categories SET typical_price_min = 10, typical_price_max = 50 WHERE id = 'food_drink';
UPDATE categories SET typical_price_min = 10, typical_price_max = 25 WHERE id = 'nightlife';
UPDATE categories SET typical_price_min = 0, typical_price_max = 0 WHERE id = 'community';
UPDATE categories SET typical_price_min = 10, typical_price_max = 30 WHERE id = 'fitness';
UPDATE categories SET typical_price_min = 10, typical_price_max = 25 WHERE id = 'family';
UPDATE categories SET typical_price_min = 15, typical_price_max = 50 WHERE id = 'learning';
UPDATE categories SET typical_price_min = 15, typical_price_max = 30 WHERE id = 'dance';
UPDATE categories SET typical_price_min = 20, typical_price_max = 40 WHERE id = 'tours';

-- ============================================
-- 4. Set venue price defaults (known venues)
-- ============================================

-- Music Venues
UPDATE venues SET typical_price_min = 15, typical_price_max = 25 WHERE slug = '529' OR name ILIKE '%529%';
UPDATE venues SET typical_price_min = 15, typical_price_max = 30 WHERE slug = 'the-earl' OR name ILIKE '%the earl%';
UPDATE venues SET typical_price_min = 20, typical_price_max = 40 WHERE slug = 'terminal-west' OR name ILIKE '%terminal west%';
UPDATE venues SET typical_price_min = 15, typical_price_max = 35 WHERE slug = 'variety-playhouse' OR name ILIKE '%variety playhouse%';
UPDATE venues SET typical_price_min = 15, typical_price_max = 30 WHERE slug = 'smiths-olde-bar' OR name ILIKE '%smith%s olde bar%';
UPDATE venues SET typical_price_min = 12, typical_price_max = 25 WHERE slug = 'eddies-attic' OR name ILIKE '%eddie%s attic%';
UPDATE venues SET typical_price_min = 25, typical_price_max = 60 WHERE slug = 'city-winery' OR name ILIKE '%city winery%';
UPDATE venues SET typical_price_min = 35, typical_price_max = 150 WHERE slug = 'tabernacle' OR name ILIKE '%tabernacle%';
UPDATE venues SET typical_price_min = 40, typical_price_max = 200 WHERE slug = 'state-farm-arena' OR name ILIKE '%state farm arena%';
UPDATE venues SET typical_price_min = 30, typical_price_max = 150 WHERE slug = 'fox-theatre' OR name ILIKE '%fox theatre%';
UPDATE venues SET typical_price_min = 25, typical_price_max = 75 WHERE slug = 'coca-cola-roxy' OR name ILIKE '%roxy%';
UPDATE venues SET typical_price_min = 20, typical_price_max = 50 WHERE slug = 'buckhead-theatre' OR name ILIKE '%buckhead theatre%';
UPDATE venues SET typical_price_min = 10, typical_price_max = 20 WHERE slug = 'star-bar' OR name ILIKE '%star bar%';
UPDATE venues SET typical_price_min = 10, typical_price_max = 20 WHERE slug = 'the-masquerade' OR name ILIKE '%masquerade%';
UPDATE venues SET typical_price_min = 15, typical_price_max = 35 WHERE slug = 'aisle-5' OR name ILIKE '%aisle 5%';

-- Comedy Venues
UPDATE venues SET typical_price_min = 15, typical_price_max = 35 WHERE slug = 'laughing-skull-lounge' OR name ILIKE '%laughing skull%';
UPDATE venues SET typical_price_min = 20, typical_price_max = 40 WHERE slug = 'punchline' OR name ILIKE '%punchline%';
UPDATE venues SET typical_price_min = 10, typical_price_max = 20 WHERE slug = 'dads-garage' OR name ILIKE '%dad%s garage%';
UPDATE venues SET typical_price_min = 15, typical_price_max = 30 WHERE slug = 'relapse-theatre' OR name ILIKE '%relapse%';

-- Theaters
UPDATE venues SET typical_price_min = 25, typical_price_max = 100 WHERE slug = 'alliance-theatre' OR name ILIKE '%alliance theatre%';
UPDATE venues SET typical_price_min = 30, typical_price_max = 150 WHERE slug = 'atlanta-ballet' OR name ILIKE '%atlanta ballet%';
UPDATE venues SET typical_price_min = 40, typical_price_max = 200 WHERE slug = 'atlanta-opera' OR name ILIKE '%atlanta opera%';
UPDATE venues SET typical_price_min = 25, typical_price_max = 80 WHERE slug = 'horizon-theatre' OR name ILIKE '%horizon theatre%';
UPDATE venues SET typical_price_min = 20, typical_price_max = 60 WHERE slug = 'theatrical-outfit' OR name ILIKE '%theatrical outfit%';
UPDATE venues SET typical_price_min = 25, typical_price_max = 75 WHERE slug = 'actors-express' OR name ILIKE '%actor%s express%';

-- Movie Theaters
UPDATE venues SET typical_price_min = 10, typical_price_max = 15 WHERE slug = 'plaza-theatre' OR name ILIKE '%plaza theatre%';
UPDATE venues SET typical_price_min = 10, typical_price_max = 15 WHERE slug = 'tara-theatre' OR name ILIKE '%tara theatre%';
UPDATE venues SET typical_price_min = 12, typical_price_max = 18 WHERE slug = 'landmark-midtown' OR name ILIKE '%landmark%midtown%';

-- Museums & Cultural
UPDATE venues SET typical_price_min = 18, typical_price_max = 25 WHERE slug = 'high-museum' OR name ILIKE '%high museum%';
UPDATE venues SET typical_price_min = 22, typical_price_max = 30 WHERE slug = 'atlanta-botanical-garden' OR name ILIKE '%botanical garden%';
UPDATE venues SET typical_price_min = 12, typical_price_max = 20 WHERE slug = 'center-for-puppetry-arts' OR name ILIKE '%puppetry arts%';
UPDATE venues SET typical_price_min = 15, typical_price_max = 22 WHERE slug = 'fernbank' OR name ILIKE '%fernbank%';
UPDATE venues SET typical_price_min = 0, typical_price_max = 0 WHERE name ILIKE '%carlos museum%';

-- Free Venues (parks, community spaces)
UPDATE venues SET typical_price_min = 0, typical_price_max = 0 WHERE name ILIKE '%piedmont park%';
UPDATE venues SET typical_price_min = 0, typical_price_max = 0 WHERE name ILIKE '%centennial%park%';
UPDATE venues SET typical_price_min = 0, typical_price_max = 0 WHERE name ILIKE '%beltline%';

-- Nightlife
UPDATE venues SET typical_price_min = 10, typical_price_max = 20 WHERE slug = 'the-basement' OR name ILIKE '%the basement%';
UPDATE venues SET typical_price_min = 10, typical_price_max = 30 WHERE slug = 'district' OR name ILIKE '%district atlanta%';
UPDATE venues SET typical_price_min = 20, typical_price_max = 50 WHERE slug = 'ravine' OR name ILIKE '%ravine%';
UPDATE venues SET typical_price_min = 0, typical_price_max = 10 WHERE name ILIKE '%johnnys hideaway%';

-- ============================================
-- 5. Create index for price lookups
-- ============================================
CREATE INDEX IF NOT EXISTS idx_venues_typical_price ON venues(typical_price_min, typical_price_max) WHERE typical_price_min IS NOT NULL;
