-- Migration 165: Taxonomy Genre Refactor
-- Extends genre system to all categories, adds format-type flag,
-- normalizes venue types, adds user preference fields for accessibility/dietary/family needs

-- ============================================================================
-- 1. ADD GENRES TO VENUES AND FESTIVALS
-- ============================================================================

-- Add genres array to venues (for filtering bars by music type, restaurants by cuisine, etc.)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS genres TEXT[];

-- Add genres array to festivals
ALTER TABLE festivals ADD COLUMN IF NOT EXISTS genres TEXT[];

-- Create GIN indexes for efficient genre filtering
CREATE INDEX IF NOT EXISTS idx_venues_genres ON venues USING GIN (genres);
CREATE INDEX IF NOT EXISTS idx_festivals_genres ON festivals USING GIN (genres);

-- ============================================================================
-- 2. EXTEND GENRE_OPTIONS TABLE
-- ============================================================================

-- Add is_format flag to distinguish event formats (workshop, tasting, etc.) from content genres
ALTER TABLE genre_options ADD COLUMN IF NOT EXISTS is_format BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN genre_options.is_format IS 'TRUE for event format types (workshop, tasting, open-mic) vs content genres (rock, comedy, drama)';

-- ============================================================================
-- 3. ADD USER PREFERENCE FIELDS FOR NEEDS
-- ============================================================================

-- Expand user_preferences with accessibility, dietary, and family needs
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS needs_accessibility TEXT[],  -- ['wheelchair', 'asl', 'sensory-friendly']
  ADD COLUMN IF NOT EXISTS needs_dietary TEXT[],        -- ['vegetarian', 'vegan', 'gluten-free', 'halal', 'kosher']
  ADD COLUMN IF NOT EXISTS needs_family TEXT[];         -- ['stroller-friendly', 'changing-table', 'nursing-room', 'kids-menu']

-- ============================================================================
-- 4. SEED NEW GENRE OPTIONS (COMEDY, NIGHTLIFE, FOOD_DRINK, ETC.)
-- ============================================================================

-- COMEDY genres
INSERT INTO genre_options (category, genre, display_order, is_format) VALUES
  ('comedy', 'stand-up', 1, FALSE),
  ('comedy', 'improv', 2, FALSE),
  ('comedy', 'sketch', 3, FALSE),
  ('comedy', 'open-mic', 4, TRUE),   -- format
  ('comedy', 'roast', 5, FALSE),
  ('comedy', 'storytelling', 6, FALSE)
ON CONFLICT (category, genre) DO NOTHING;

-- NIGHTLIFE genres
INSERT INTO genre_options (category, genre, display_order, is_format) VALUES
  ('nightlife', 'dj', 1, FALSE),
  ('nightlife', 'drag', 2, FALSE),
  ('nightlife', 'trivia', 3, FALSE),
  ('nightlife', 'karaoke', 4, FALSE),
  ('nightlife', 'dance-party', 5, FALSE),
  ('nightlife', 'game-night', 6, FALSE),
  ('nightlife', 'burlesque', 7, FALSE),
  ('nightlife', 'wine-night', 8, FALSE),
  ('nightlife', 'cocktail-night', 9, FALSE)
ON CONFLICT (category, genre) DO NOTHING;

-- FOOD & DRINK genres (cuisines + formats)
INSERT INTO genre_options (category, genre, display_order, is_format) VALUES
  ('food_drink', 'southern', 1, FALSE),
  ('food_drink', 'mexican', 2, FALSE),
  ('food_drink', 'italian', 3, FALSE),
  ('food_drink', 'asian', 4, FALSE),
  ('food_drink', 'brunch', 5, FALSE),
  ('food_drink', 'wine', 6, FALSE),
  ('food_drink', 'beer', 7, FALSE),
  ('food_drink', 'cocktails', 8, FALSE),
  ('food_drink', 'coffee', 9, FALSE),
  ('food_drink', 'pop-up', 10, TRUE),     -- format
  ('food_drink', 'tasting', 11, TRUE),    -- format
  ('food_drink', 'cooking-class', 12, TRUE), -- format
  ('food_drink', 'food-festival', 13, FALSE),
  ('food_drink', 'seafood', 14, FALSE)
ON CONFLICT (category, genre) DO NOTHING;

-- ART genres
INSERT INTO genre_options (category, genre, display_order, is_format) VALUES
  ('art', 'exhibition', 1, TRUE),       -- format
  ('art', 'gallery-opening', 2, TRUE),  -- format
  ('art', 'photography', 3, FALSE),
  ('art', 'sculpture', 4, FALSE),
  ('art', 'street-art', 5, FALSE),
  ('art', 'craft', 6, FALSE),
  ('art', 'digital', 7, FALSE),
  ('art', 'performance', 8, FALSE),
  ('art', 'market', 9, FALSE)
ON CONFLICT (category, genre) DO NOTHING;

-- FITNESS genres
INSERT INTO genre_options (category, genre, display_order, is_format) VALUES
  ('fitness', 'yoga', 1, FALSE),
  ('fitness', 'run', 2, FALSE),
  ('fitness', 'cycling', 3, FALSE),
  ('fitness', 'dance', 4, FALSE),
  ('fitness', 'hike', 5, FALSE),
  ('fitness', 'crossfit', 6, FALSE),
  ('fitness', 'martial-arts', 7, FALSE),
  ('fitness', 'pilates', 8, FALSE),
  ('fitness', 'swimming', 9, FALSE),
  ('fitness', 'climbing', 10, FALSE)
ON CONFLICT (category, genre) DO NOTHING;

-- LEARNING genres
INSERT INTO genre_options (category, genre, display_order, is_format) VALUES
  ('learning', 'workshop', 1, TRUE),      -- format
  ('learning', 'class', 2, TRUE),         -- format
  ('learning', 'lecture', 3, TRUE),       -- format
  ('learning', 'seminar', 4, TRUE),       -- format
  ('learning', 'book-club', 5, TRUE),     -- format
  ('learning', 'tour', 6, TRUE),          -- format
  ('learning', 'film-screening', 7, TRUE), -- format
  ('learning', 'language', 8, FALSE)
ON CONFLICT (category, genre) DO NOTHING;

-- COMMUNITY genres
INSERT INTO genre_options (category, genre, display_order, is_format) VALUES
  ('community', 'volunteer', 1, FALSE),
  ('community', 'meetup', 2, FALSE),
  ('community', 'networking', 3, FALSE),
  ('community', 'lgbtq', 4, FALSE),
  ('community', 'faith', 5, FALSE),
  ('community', 'activism', 6, FALSE),
  ('community', 'support', 7, FALSE),
  ('community', 'cultural', 8, FALSE)
ON CONFLICT (category, genre) DO NOTHING;

-- FAMILY genres
INSERT INTO genre_options (category, genre, display_order, is_format) VALUES
  ('family', 'storytime', 1, FALSE),
  ('family', 'crafts', 2, FALSE),
  ('family', 'science', 3, FALSE),
  ('family', 'nature', 4, FALSE),
  ('family', 'puppet-show', 5, FALSE),
  ('family', 'festival', 6, FALSE),
  ('family', 'music-for-kids', 7, FALSE),
  ('family', 'outdoor-play', 8, FALSE)
ON CONFLICT (category, genre) DO NOTHING;

-- OUTDOOR genres
INSERT INTO genre_options (category, genre, display_order, is_format) VALUES
  ('outdoor', 'parks', 1, FALSE),
  ('outdoor', 'garden', 2, FALSE),
  ('outdoor', 'market', 3, FALSE),
  ('outdoor', 'sightseeing', 4, FALSE),
  ('outdoor', 'water', 5, FALSE),
  ('outdoor', 'camping', 6, FALSE),
  ('outdoor', 'adventure', 7, FALSE)
ON CONFLICT (category, genre) DO NOTHING;

-- WORDS genres
INSERT INTO genre_options (category, genre, display_order, is_format) VALUES
  ('words', 'reading', 1, FALSE),
  ('words', 'poetry', 2, FALSE),
  ('words', 'book-club', 3, TRUE),        -- format
  ('words', 'storytelling', 4, FALSE),
  ('words', 'writing', 5, FALSE),
  ('words', 'comics', 6, FALSE),
  ('words', 'literary-festival', 7, FALSE)
ON CONFLICT (category, genre) DO NOTHING;

-- SPORTS genres (non-music) - expand existing with additional display_order values
INSERT INTO genre_options (category, genre, display_order, is_format) VALUES
  -- These should already exist from 019_genres.sql, but we'll add more detail
  ('sports', 'baseball', 1, FALSE),
  ('sports', 'basketball', 2, FALSE),
  ('sports', 'football', 3, FALSE),
  ('sports', 'soccer', 4, FALSE),
  ('sports', 'hockey', 5, FALSE),
  ('sports', 'softball', 10, FALSE),
  ('sports', 'volleyball', 11, FALSE),
  ('sports', 'lacrosse', 12, FALSE),
  ('sports', 'rugby', 13, FALSE),
  ('sports', 'cricket', 14, FALSE),
  ('sports', 'field-hockey', 15, FALSE),
  ('sports', 'boxing', 20, FALSE),
  ('sports', 'mma', 21, FALSE),
  ('sports', 'wrestling', 22, FALSE),
  ('sports', 'kickboxing', 23, FALSE),
  ('sports', 'racing', 30, FALSE),
  ('sports', 'motorsports', 31, FALSE),
  ('sports', 'nascar', 32, FALSE),
  ('sports', 'monster-truck', 33, FALSE),
  ('sports', 'dirt-track', 34, FALSE),
  ('sports', 'golf', 40, FALSE),
  ('sports', 'tennis', 41, FALSE),
  ('sports', 'track', 42, FALSE),
  ('sports', 'gymnastics', 43, FALSE),
  ('sports', 'swimming', 44, FALSE),
  ('sports', 'diving', 45, FALSE),
  ('sports', 'figure-skating', 46, FALSE),
  ('sports', 'marathon', 50, FALSE),
  ('sports', 'triathlon', 51, FALSE),
  ('sports', 'cycling', 52, FALSE),
  ('sports', 'crossfit', 53, FALSE),
  ('sports', 'esports', 60, FALSE),
  ('sports', 'poker', 61, FALSE),
  ('sports', 'roller-derby', 62, FALSE),
  ('sports', 'pickleball', 63, FALSE),
  ('sports', 'cornhole', 64, FALSE),
  ('sports', 'axe-throwing', 65, FALSE)
ON CONFLICT (category, genre) DO NOTHING;

-- ============================================================================
-- 5. NORMALIZE VENUE TYPES
-- ============================================================================

-- Consolidate specialized bar types into 'bar' with genres
-- sports_bar → bar + genres:['sports']
UPDATE venues
SET
  venue_type = 'bar',
  spot_type = 'bar',
  genres = ARRAY['sports']
WHERE venue_type = 'sports_bar'
  AND genres IS NULL;

-- wine_bar → bar + genres:['wine']
UPDATE venues
SET
  venue_type = 'bar',
  spot_type = 'bar',
  genres = ARRAY['wine']
WHERE venue_type = 'wine_bar'
  AND genres IS NULL;

-- cocktail_bar → bar + genres:['cocktails']
UPDATE venues
SET
  venue_type = 'bar',
  spot_type = 'bar',
  genres = ARRAY['cocktails']
WHERE venue_type = 'cocktail_bar'
  AND genres IS NULL;

-- ============================================================================
-- 6. DEPRECATION COMMENTS
-- ============================================================================

-- Mark events.subcategory as deprecated (genres array is the new way)
COMMENT ON COLUMN events.subcategory IS 'DEPRECATED: Use genres array instead. Old subcategory values mapped to genre_options table.';

-- ============================================================================
-- 7. COMMENTS FOR NEW FIELDS
-- ============================================================================

COMMENT ON COLUMN venues.genres IS 'Genre tags for the venue (e.g., [''sports''] for sports bar, [''wine'', ''cocktails''] for wine bar, [''mexican'', ''brunch''] for restaurant)';
COMMENT ON COLUMN festivals.genres IS 'Genre tags for the festival (e.g., [''rock'', ''indie''] for music festival, [''documentary''] for film festival)';
COMMENT ON COLUMN user_preferences.needs_accessibility IS 'Accessibility requirements (wheelchair, asl, sensory-friendly, etc.)';
COMMENT ON COLUMN user_preferences.needs_dietary IS 'Dietary restrictions (vegetarian, vegan, gluten-free, halal, kosher, etc.)';
COMMENT ON COLUMN user_preferences.needs_family IS 'Family amenities needed (stroller-friendly, changing-table, nursing-room, kids-menu, etc.)';
