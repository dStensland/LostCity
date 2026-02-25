-- Taxonomy Definitions: Single source of truth for all tag-like values.
-- Replaces: genre_options table, hardcoded TAG_GROUPS, VALID_VIBES, OCCASION_CHIPS.
-- taxonomy_type: 'genre', 'event_tag', 'venue_vibe', 'occasion'

-- ─── Table Creation ──────────────────────────────────────────────────────────

CREATE TABLE taxonomy_definitions (
  id TEXT PRIMARY KEY,                    -- slug: "jazz", "date-night", "late-night"
  label TEXT NOT NULL,                    -- Display: "Jazz", "Date Night"
  taxonomy_type TEXT NOT NULL,            -- "genre", "event_tag", "venue_vibe", "occasion"
  taxonomy_group TEXT NOT NULL,           -- UI grouping: "music", "vibe", "access", "atmosphere"
  category_scope TEXT[],                  -- Event categories this applies to (NULL = all)
  entity_scope TEXT[] NOT NULL            -- Entity types: {"event"}, {"venue"}, {"event","venue"}
    DEFAULT '{"event","venue"}',
  is_format BOOLEAN DEFAULT FALSE,        -- True for formats (workshop, tasting) vs content
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  icon TEXT,
  color TEXT,
  filter_overrides JSONB,                 -- For occasions: compound filter presets
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_taxonomy_type ON taxonomy_definitions(taxonomy_type);
CREATE INDEX idx_taxonomy_group ON taxonomy_definitions(taxonomy_type, taxonomy_group);
CREATE INDEX idx_taxonomy_entity_scope ON taxonomy_definitions USING GIN(entity_scope);

-- ─── Seed: Genres (from genre_options) ───────────────────────────────────────

-- Music genres
INSERT INTO taxonomy_definitions (id, label, taxonomy_type, taxonomy_group, category_scope, entity_scope, is_format, display_order) VALUES
  ('rock', 'Rock', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 1),
  ('pop', 'Pop', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 2),
  ('hip-hop', 'Hip-Hop', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 3),
  ('r-and-b', 'R&B', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 4),
  ('jazz', 'Jazz', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 5),
  ('blues', 'Blues', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 6),
  ('country', 'Country', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 7),
  ('folk', 'Folk', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 8),
  ('electronic', 'Electronic', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 9),
  ('house', 'House', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 10),
  ('techno', 'Techno', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 11),
  ('edm', 'EDM', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 12),
  ('classical', 'Classical', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 13),
  ('opera', 'Opera', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 14),
  ('metal', 'Metal', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 15),
  ('punk', 'Punk', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 16),
  ('indie', 'Indie', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 17),
  ('alternative', 'Alternative', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 18),
  ('soul', 'Soul', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 19),
  ('funk', 'Funk', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 20),
  ('reggae', 'Reggae', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 21),
  ('latin', 'Latin', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 22),
  ('world', 'World', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 23),
  ('singer-songwriter', 'Singer-Songwriter', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 24),
  ('ambient', 'Ambient', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 25),
  ('experimental', 'Experimental', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 26),
  ('cover', 'Cover', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 27),
  ('tribute', 'Tribute', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 28),
  ('jam', 'Jam', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 29),
  ('bluegrass', 'Bluegrass', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 30),
  ('gospel', 'Gospel', 'genre', 'music', '{music}', '{event,venue,festival,series,artist}', false, 31);

-- Film genres
INSERT INTO taxonomy_definitions (id, label, taxonomy_type, taxonomy_group, category_scope, entity_scope, is_format, display_order) VALUES
  ('action', 'Action', 'genre', 'film', '{film}', '{event,venue,festival,series,artist}', false, 1),
  ('adventure', 'Adventure', 'genre', 'film', '{film}', '{event,venue,festival,series,artist}', false, 2),
  ('animation', 'Animation', 'genre', 'film', '{film}', '{event,venue,festival,series,artist}', false, 3),
  ('documentary', 'Documentary', 'genre', 'film', '{film}', '{event,venue,festival,series,artist}', false, 6),
  ('drama', 'Drama', 'genre', 'film', '{film}', '{event,venue,festival,series,artist}', false, 7),
  ('fantasy', 'Fantasy', 'genre', 'film', '{film}', '{event,venue,festival,series,artist}', false, 9),
  ('foreign', 'Foreign', 'genre', 'film', '{film}', '{event,venue,festival,series,artist}', false, 10),
  ('horror', 'Horror', 'genre', 'film', '{film}', '{event,venue,festival,series,artist}', false, 11),
  ('musical', 'Musical', 'genre', 'film', '{film}', '{event,venue,festival,series,artist}', false, 13),
  ('mystery', 'Mystery', 'genre', 'film', '{film}', '{event,venue,festival,series,artist}', false, 14),
  ('romance', 'Romance', 'genre', 'film', '{film}', '{event,venue,festival,series,artist}', false, 15),
  ('sci-fi', 'Sci-Fi', 'genre', 'film', '{film}', '{event,venue,festival,series,artist}', false, 16),
  ('thriller', 'Thriller', 'genre', 'film', '{film}', '{event,venue,festival,series,artist}', false, 17),
  ('war', 'War', 'genre', 'film', '{film}', '{event,venue,festival,series,artist}', false, 18),
  ('western', 'Western', 'genre', 'film', '{film}', '{event,venue,festival,series,artist}', false, 19),
  ('cult', 'Cult', 'genre', 'film', '{film}', '{event,venue,festival,series,artist}', false, 20),
  ('classic', 'Classic', 'genre', 'film', '{film}', '{event,venue,festival,series,artist}', false, 21),
  ('noir', 'Noir', 'genre', 'film', '{film}', '{event,venue,festival,series,artist}', false, 22),
  ('silent', 'Silent', 'genre', 'film', '{film}', '{event,venue,festival,series,artist}', false, 23);

-- Comedy genres
INSERT INTO taxonomy_definitions (id, label, taxonomy_type, taxonomy_group, category_scope, entity_scope, is_format, display_order) VALUES
  ('stand-up', 'Stand-Up', 'genre', 'comedy', '{comedy}', '{event,venue,festival,series,artist}', false, 1),
  ('improv', 'Improv', 'genre', 'comedy', '{comedy}', '{event,venue,festival,series,artist}', false, 2),
  ('sketch', 'Sketch', 'genre', 'comedy', '{comedy}', '{event,venue,festival,series,artist}', false, 3),
  ('open-mic', 'Open Mic', 'genre', 'comedy', '{comedy}', '{event,venue,festival,series,artist}', true, 4),
  ('roast', 'Roast', 'genre', 'comedy', '{comedy}', '{event,venue,festival,series,artist}', false, 5),
  ('storytelling', 'Storytelling', 'genre', 'comedy', '{comedy}', '{event,venue,festival,series,artist}', false, 6);

-- Theater genres (id prefixed with "theater-" where collisions exist)
INSERT INTO taxonomy_definitions (id, label, taxonomy_type, taxonomy_group, category_scope, entity_scope, is_format, display_order) VALUES
  ('theater-drama', 'Drama', 'genre', 'theater', '{theater}', '{event,venue,festival,series,artist}', false, 1),
  ('theater-comedy', 'Comedy', 'genre', 'theater', '{theater}', '{event,venue,festival,series,artist}', false, 2),
  ('tragedy', 'Tragedy', 'genre', 'theater', '{theater}', '{event,venue,festival,series,artist}', false, 3),
  ('shakespeare', 'Shakespeare', 'genre', 'theater', '{theater}', '{event,venue,festival,series,artist}', false, 5),
  ('new-work', 'New Work', 'genre', 'theater', '{theater}', '{event,venue,festival,series,artist}', false, 6),
  ('one-person', 'One-Person Show', 'genre', 'theater', '{theater}', '{event,venue,festival,series,artist}', false, 7),
  ('broadway', 'Broadway', 'genre', 'theater', '{theater}', '{event,venue,festival,series,artist}', false, 11),
  ('revue', 'Revue', 'genre', 'theater', '{theater}', '{event,venue,festival,series,artist}', false, 12),
  ('ballet', 'Ballet', 'genre', 'theater', '{theater}', '{event,venue,festival,series,artist}', false, 20),
  ('modern-dance', 'Modern Dance', 'genre', 'theater', '{theater}', '{event,venue,festival,series,artist}', false, 21),
  ('contemporary-dance', 'Contemporary Dance', 'genre', 'theater', '{theater}', '{event,venue,festival,series,artist}', false, 22),
  ('tap', 'Tap', 'genre', 'theater', '{theater}', '{event,venue,festival,series,artist}', false, 23),
  ('folk-dance', 'Folk Dance', 'genre', 'theater', '{theater}', '{event,venue,festival,series,artist}', false, 24),
  ('symphony', 'Symphony', 'genre', 'theater', '{theater}', '{event,venue,festival,series,artist}', false, 31),
  ('orchestra', 'Orchestra', 'genre', 'theater', '{theater}', '{event,venue,festival,series,artist}', false, 32),
  ('choral', 'Choral', 'genre', 'theater', '{theater}', '{event,venue,festival,series,artist}', false, 33),
  ('spoken-word', 'Spoken Word', 'genre', 'theater', '{theater}', '{event,venue,festival,series,artist}', false, 43),
  ('circus', 'Circus', 'genre', 'theater', '{theater}', '{event,venue,festival,series,artist}', false, 50),
  ('acrobatics', 'Acrobatics', 'genre', 'theater', '{theater}', '{event,venue,festival,series,artist}', false, 51),
  ('magic', 'Magic', 'genre', 'theater', '{theater}', '{event,venue,festival,series,artist}', false, 52),
  ('burlesque', 'Burlesque', 'genre', 'theater', '{theater}', '{event,venue,festival,series,artist}', false, 53),
  ('cabaret', 'Cabaret', 'genre', 'theater', '{theater}', '{event,venue,festival,series,artist}', false, 54),
  ('variety', 'Variety', 'genre', 'theater', '{theater}', '{event,venue,festival,series,artist}', false, 55),
  ('drag', 'Drag', 'genre', 'theater', '{theater}', '{event,venue,festival,series,artist}', false, 56),
  ('children', 'Children', 'genre', 'theater', '{theater}', '{event,venue,festival,series,artist}', false, 60),
  ('puppet', 'Puppet', 'genre', 'theater', '{theater}', '{event,venue,festival,series,artist}', false, 61),
  ('immersive', 'Immersive', 'genre', 'theater', '{theater}', '{event,venue,festival,series,artist}', false, 62),
  ('devised', 'Devised', 'genre', 'theater', '{theater}', '{event,venue,festival,series,artist}', false, 64);

-- Sports genres
INSERT INTO taxonomy_definitions (id, label, taxonomy_type, taxonomy_group, category_scope, entity_scope, is_format, display_order) VALUES
  ('baseball', 'Baseball', 'genre', 'sports', '{sports}', '{event,venue,festival,series,artist}', false, 1),
  ('basketball', 'Basketball', 'genre', 'sports', '{sports}', '{event,venue,festival,series,artist}', false, 2),
  ('football', 'Football', 'genre', 'sports', '{sports}', '{event,venue,festival,series,artist}', false, 3),
  ('soccer', 'Soccer', 'genre', 'sports', '{sports}', '{event,venue,festival,series,artist}', false, 4),
  ('hockey', 'Hockey', 'genre', 'sports', '{sports}', '{event,venue,festival,series,artist}', false, 5),
  ('softball', 'Softball', 'genre', 'sports', '{sports}', '{event,venue,festival,series,artist}', false, 10),
  ('volleyball', 'Volleyball', 'genre', 'sports', '{sports}', '{event,venue,festival,series,artist}', false, 11),
  ('lacrosse', 'Lacrosse', 'genre', 'sports', '{sports}', '{event,venue,festival,series,artist}', false, 12),
  ('rugby', 'Rugby', 'genre', 'sports', '{sports}', '{event,venue,festival,series,artist}', false, 13),
  ('cricket', 'Cricket', 'genre', 'sports', '{sports}', '{event,venue,festival,series,artist}', false, 14),
  ('field-hockey', 'Field Hockey', 'genre', 'sports', '{sports}', '{event,venue,festival,series,artist}', false, 15),
  ('boxing', 'Boxing', 'genre', 'sports', '{sports}', '{event,venue,festival,series,artist}', false, 20),
  ('mma', 'MMA', 'genre', 'sports', '{sports}', '{event,venue,festival,series,artist}', false, 21),
  ('wrestling', 'Wrestling', 'genre', 'sports', '{sports}', '{event,venue,festival,series,artist}', false, 22),
  ('kickboxing', 'Kickboxing', 'genre', 'sports', '{sports}', '{event,venue,festival,series,artist}', false, 23),
  ('racing', 'Racing', 'genre', 'sports', '{sports}', '{event,venue,festival,series,artist}', false, 30),
  ('motorsports', 'Motorsports', 'genre', 'sports', '{sports}', '{event,venue,festival,series,artist}', false, 31),
  ('golf', 'Golf', 'genre', 'sports', '{sports}', '{event,venue,festival,series,artist}', false, 40),
  ('tennis', 'Tennis', 'genre', 'sports', '{sports}', '{event,venue,festival,series,artist}', false, 41),
  ('track', 'Track', 'genre', 'sports', '{sports}', '{event,venue,festival,series,artist}', false, 42),
  ('gymnastics', 'Gymnastics', 'genre', 'sports', '{sports}', '{event,venue,festival,series,artist}', false, 43),
  ('swimming', 'Swimming', 'genre', 'sports', '{sports}', '{event,venue,festival,series,artist}', false, 44),
  ('marathon', 'Marathon', 'genre', 'sports', '{sports}', '{event,venue,festival,series,artist}', false, 50),
  ('triathlon', 'Triathlon', 'genre', 'sports', '{sports}', '{event,venue,festival,series,artist}', false, 51),
  ('esports', 'Esports', 'genre', 'sports', '{sports}', '{event,venue,festival,series,artist}', false, 60),
  ('roller-derby', 'Roller Derby', 'genre', 'sports', '{sports}', '{event,venue,festival,series,artist}', false, 62),
  ('pickleball', 'Pickleball', 'genre', 'sports', '{sports}', '{event,venue,festival,series,artist}', false, 63);

-- Nightlife genres
INSERT INTO taxonomy_definitions (id, label, taxonomy_type, taxonomy_group, category_scope, entity_scope, is_format, display_order) VALUES
  ('dj', 'DJ', 'genre', 'nightlife', '{nightlife}', '{event,venue,festival,series,artist}', false, 1),
  ('dance-party', 'Dance Party', 'genre', 'nightlife', '{nightlife}', '{event,venue,festival,series,artist}', false, 5),
  ('game-night', 'Game Night', 'genre', 'nightlife', '{nightlife}', '{event,venue,festival,series,artist}', false, 6),
  ('wine-night', 'Wine Night', 'genre', 'nightlife', '{nightlife}', '{event,venue,festival,series,artist}', false, 8),
  ('cocktail-night', 'Cocktail Night', 'genre', 'nightlife', '{nightlife}', '{event,venue,festival,series,artist}', false, 9),
  ('bar-games', 'Bar Games', 'genre', 'nightlife', '{nightlife}', '{event,venue,festival,series,artist}', false, 10),
  ('poker', 'Poker', 'genre', 'nightlife', '{nightlife}', '{event,venue,festival,series,artist}', false, 11),
  ('bingo', 'Bingo', 'genre', 'nightlife', '{nightlife}', '{event,venue,festival,series,artist}', false, 12);

-- Food & Drink genres
INSERT INTO taxonomy_definitions (id, label, taxonomy_type, taxonomy_group, category_scope, entity_scope, is_format, display_order) VALUES
  ('southern', 'Southern', 'genre', 'food_drink', '{food_drink}', '{event,venue,festival,series,artist}', false, 1),
  ('mexican', 'Mexican', 'genre', 'food_drink', '{food_drink}', '{event,venue,festival,series,artist}', false, 2),
  ('italian', 'Italian', 'genre', 'food_drink', '{food_drink}', '{event,venue,festival,series,artist}', false, 3),
  ('asian', 'Asian', 'genre', 'food_drink', '{food_drink}', '{event,venue,festival,series,artist}', false, 4),
  ('brunch', 'Brunch', 'genre', 'food_drink', '{food_drink}', '{event,venue,festival,series,artist}', false, 5),
  ('wine', 'Wine', 'genre', 'food_drink', '{food_drink}', '{event,venue,festival,series,artist}', false, 6),
  ('beer', 'Beer', 'genre', 'food_drink', '{food_drink}', '{event,venue,festival,series,artist}', false, 7),
  ('cocktails', 'Cocktails', 'genre', 'food_drink', '{food_drink}', '{event,venue,festival,series,artist}', false, 8),
  ('coffee', 'Coffee', 'genre', 'food_drink', '{food_drink}', '{event,venue,festival,series,artist}', false, 9),
  ('pop-up', 'Pop-Up', 'genre', 'food_drink', '{food_drink}', '{event,venue,festival,series,artist}', true, 10),
  ('tasting', 'Tasting', 'genre', 'food_drink', '{food_drink}', '{event,venue,festival,series,artist}', true, 11),
  ('cooking-class', 'Cooking Class', 'genre', 'food_drink', '{food_drink}', '{event,venue,festival,series,artist}', true, 12),
  ('food-festival', 'Food Festival', 'genre', 'food_drink', '{food_drink}', '{event,venue,festival,series,artist}', false, 13),
  ('seafood', 'Seafood', 'genre', 'food_drink', '{food_drink}', '{event,venue,festival,series,artist}', false, 14);

-- Art genres
INSERT INTO taxonomy_definitions (id, label, taxonomy_type, taxonomy_group, category_scope, entity_scope, is_format, display_order) VALUES
  ('exhibition', 'Exhibition', 'genre', 'art', '{art}', '{event,venue,festival,series,artist}', true, 1),
  ('gallery-opening', 'Gallery Opening', 'genre', 'art', '{art}', '{event,venue,festival,series,artist}', true, 2),
  ('photography', 'Photography', 'genre', 'art', '{art}', '{event,venue,festival,series,artist}', false, 3),
  ('sculpture', 'Sculpture', 'genre', 'art', '{art}', '{event,venue,festival,series,artist}', false, 4),
  ('street-art', 'Street Art', 'genre', 'art', '{art}', '{event,venue,festival,series,artist}', false, 5),
  ('craft', 'Craft', 'genre', 'art', '{art}', '{event,venue,festival,series,artist}', false, 6),
  ('digital', 'Digital', 'genre', 'art', '{art}', '{event,venue,festival,series,artist}', false, 7),
  ('performance', 'Performance', 'genre', 'art', '{art}', '{event,venue,festival,series,artist}', false, 8),
  ('art-market', 'Market', 'genre', 'art', '{art}', '{event,venue,festival,series,artist}', false, 9);

-- Fitness genres
INSERT INTO taxonomy_definitions (id, label, taxonomy_type, taxonomy_group, category_scope, entity_scope, is_format, display_order) VALUES
  ('yoga', 'Yoga', 'genre', 'fitness', '{fitness}', '{event,venue,festival,series,artist}', false, 1),
  ('run', 'Run', 'genre', 'fitness', '{fitness}', '{event,venue,festival,series,artist}', false, 2),
  ('cycling', 'Cycling', 'genre', 'fitness', '{fitness}', '{event,venue,festival,series,artist}', false, 3),
  ('dance', 'Dance', 'genre', 'fitness', '{fitness}', '{event,venue,festival,series,artist}', false, 4),
  ('hike', 'Hike', 'genre', 'fitness', '{fitness}', '{event,venue,festival,series,artist}', false, 5),
  ('crossfit', 'CrossFit', 'genre', 'fitness', '{fitness}', '{event,venue,festival,series,artist}', false, 6),
  ('martial-arts', 'Martial Arts', 'genre', 'fitness', '{fitness}', '{event,venue,festival,series,artist}', false, 7),
  ('pilates', 'Pilates', 'genre', 'fitness', '{fitness}', '{event,venue,festival,series,artist}', false, 8),
  ('climbing', 'Climbing', 'genre', 'fitness', '{fitness}', '{event,venue,festival,series,artist}', false, 10);

-- Learning genres
INSERT INTO taxonomy_definitions (id, label, taxonomy_type, taxonomy_group, category_scope, entity_scope, is_format, display_order) VALUES
  ('workshop', 'Workshop', 'genre', 'learning', '{learning}', '{event,venue,festival,series,artist}', true, 1),
  ('class', 'Class', 'genre', 'learning', '{learning}', '{event,venue,festival,series,artist}', true, 2),
  ('lecture', 'Lecture', 'genre', 'learning', '{learning}', '{event,venue,festival,series,artist}', true, 3),
  ('seminar', 'Seminar', 'genre', 'learning', '{learning}', '{event,venue,festival,series,artist}', true, 4),
  ('book-club', 'Book Club', 'genre', 'learning', '{learning,words}', '{event,venue,festival,series,artist}', true, 5),
  ('tour', 'Tour', 'genre', 'learning', '{learning}', '{event,venue,festival,series,artist}', true, 6),
  ('film-screening', 'Film Screening', 'genre', 'learning', '{learning}', '{event,venue,festival,series,artist}', true, 7),
  ('language', 'Language', 'genre', 'learning', '{learning}', '{event,venue,festival,series,artist}', false, 8);

-- Community genres
INSERT INTO taxonomy_definitions (id, label, taxonomy_type, taxonomy_group, category_scope, entity_scope, is_format, display_order) VALUES
  ('volunteer', 'Volunteer', 'genre', 'community', '{community}', '{event,venue,festival,series,artist}', false, 1),
  ('meetup', 'Meetup', 'genre', 'community', '{community}', '{event,venue,festival,series,artist}', false, 2),
  ('networking', 'Networking', 'genre', 'community', '{community}', '{event,venue,festival,series,artist}', false, 3),
  ('lgbtq', 'LGBTQ+', 'genre', 'community', '{community}', '{event,venue,festival,series,artist}', false, 4),
  ('faith', 'Faith', 'genre', 'community', '{community}', '{event,venue,festival,series,artist}', false, 5),
  ('activism', 'Activism', 'genre', 'community', '{community}', '{event,venue,festival,series,artist}', false, 6),
  ('support', 'Support', 'genre', 'community', '{community}', '{event,venue,festival,series,artist}', false, 7),
  ('cultural', 'Cultural', 'genre', 'community', '{community}', '{event,venue,festival,series,artist}', false, 8);

-- Family genres
INSERT INTO taxonomy_definitions (id, label, taxonomy_type, taxonomy_group, category_scope, entity_scope, is_format, display_order) VALUES
  ('storytime', 'Storytime', 'genre', 'family', '{family}', '{event,venue,festival,series,artist}', false, 1),
  ('crafts', 'Crafts', 'genre', 'family', '{family}', '{event,venue,festival,series,artist}', false, 2),
  ('science', 'Science', 'genre', 'family', '{family}', '{event,venue,festival,series,artist}', false, 3),
  ('nature', 'Nature', 'genre', 'family', '{family}', '{event,venue,festival,series,artist}', false, 4),
  ('puppet-show', 'Puppet Show', 'genre', 'family', '{family}', '{event,venue,festival,series,artist}', false, 5),
  ('festival', 'Festival', 'genre', 'family', '{family}', '{event,venue,festival,series,artist}', false, 6),
  ('music-for-kids', 'Music for Kids', 'genre', 'family', '{family}', '{event,venue,festival,series,artist}', false, 7),
  ('outdoor-play', 'Outdoor Play', 'genre', 'family', '{family}', '{event,venue,festival,series,artist}', false, 8);

-- Outdoor genres
INSERT INTO taxonomy_definitions (id, label, taxonomy_type, taxonomy_group, category_scope, entity_scope, is_format, display_order) VALUES
  ('parks', 'Parks', 'genre', 'outdoor', '{outdoors}', '{event,venue,festival,series,artist}', false, 1),
  ('garden', 'Garden', 'genre', 'outdoor', '{outdoors}', '{event,venue,festival,series,artist}', false, 2),
  ('market', 'Market', 'genre', 'outdoor', '{outdoors,markets}', '{event,venue,festival,series,artist}', false, 3),
  ('sightseeing', 'Sightseeing', 'genre', 'outdoor', '{outdoors}', '{event,venue,festival,series,artist}', false, 4),
  ('water', 'Water', 'genre', 'outdoor', '{outdoors}', '{event,venue,festival,series,artist}', false, 5),
  ('camping', 'Camping', 'genre', 'outdoor', '{outdoors}', '{event,venue,festival,series,artist}', false, 6);

-- Words genres
INSERT INTO taxonomy_definitions (id, label, taxonomy_type, taxonomy_group, category_scope, entity_scope, is_format, display_order) VALUES
  ('reading', 'Reading', 'genre', 'words', '{words}', '{event,venue,festival,series,artist}', false, 1),
  ('poetry', 'Poetry', 'genre', 'words', '{words}', '{event,venue,festival,series,artist}', false, 2),
  ('writing', 'Writing', 'genre', 'words', '{words}', '{event,venue,festival,series,artist}', false, 5),
  ('comics', 'Comics', 'genre', 'words', '{words}', '{event,venue,festival,series,artist}', false, 6),
  ('literary-festival', 'Literary Festival', 'genre', 'words', '{words}', '{event,venue,festival,series,artist}', false, 7);

-- Cross-category genres (used in multiple categories — nightlife + comedy + theater)
-- karaoke, trivia, drag, burlesque, storytelling already inserted above for their primary category.
-- They have category_scope arrays that cover their primary category.
-- Crawlers assign genres by category, so cross-use works naturally.

-- ─── Seed: Event Tags (from TAG_GROUPS) ─────────────────────────────────────

-- Vibe tags
INSERT INTO taxonomy_definitions (id, label, taxonomy_type, taxonomy_group, category_scope, entity_scope, display_order) VALUES
  ('date-night', 'Date Night', 'event_tag', 'vibe', NULL, '{event}', 1),
  ('chill', 'Chill', 'event_tag', 'vibe', NULL, '{event}', 2),
  ('high-energy', 'High Energy', 'event_tag', 'vibe', NULL, '{event}', 3),
  ('intimate', 'Intimate', 'event_tag', 'vibe', NULL, '{event}', 4),
  ('rowdy', 'Rowdy', 'event_tag', 'vibe', NULL, '{event}', 5);

-- Access tags
INSERT INTO taxonomy_definitions (id, label, taxonomy_type, taxonomy_group, category_scope, entity_scope, display_order) VALUES
  ('free', 'Free', 'event_tag', 'access', NULL, '{event}', 1),
  ('all-ages', 'All Ages', 'event_tag', 'access', NULL, '{event}', 2),
  ('18-plus', '18+', 'event_tag', 'access', NULL, '{event}', 3),
  ('21-plus', '21+', 'event_tag', 'access', NULL, '{event}', 4),
  ('family-friendly', 'Family', 'event_tag', 'access', NULL, '{event}', 5),
  ('accessible', 'Accessible', 'event_tag', 'access', NULL, '{event}', 6),
  ('outdoor', 'Outdoor', 'event_tag', 'access', NULL, '{event}', 7);

-- Type tags
INSERT INTO taxonomy_definitions (id, label, taxonomy_type, taxonomy_group, category_scope, entity_scope, display_order) VALUES
  ('live-music', 'Live Music', 'event_tag', 'type', NULL, '{event}', 1),
  ('tag-class', 'Class', 'event_tag', 'type', NULL, '{event}', 2),
  ('educational', 'Educational', 'event_tag', 'type', NULL, '{event}', 3),
  ('hands-on', 'Hands-On', 'event_tag', 'type', NULL, '{event}', 4),
  ('community', 'Community', 'event_tag', 'type', NULL, '{event}', 5),
  ('tag-volunteer', 'Volunteer', 'event_tag', 'type', NULL, '{event}', 6);

-- Special tags
INSERT INTO taxonomy_definitions (id, label, taxonomy_type, taxonomy_group, category_scope, entity_scope, display_order) VALUES
  ('local-artist', 'Local Artist', 'event_tag', 'special', NULL, '{event}', 1),
  ('touring', 'Touring', 'event_tag', 'special', NULL, '{event}', 2),
  ('album-release', 'Album Release', 'event_tag', 'special', NULL, '{event}', 3),
  ('one-night-only', 'One Night Only', 'event_tag', 'special', NULL, '{event}', 4),
  ('opening-night', 'Opening Night', 'event_tag', 'special', NULL, '{event}', 5),
  ('closing-night', 'Closing Night', 'event_tag', 'special', NULL, '{event}', 6),
  ('debut', 'Debut', 'event_tag', 'special', NULL, '{event}', 7),
  ('holiday', 'Holiday', 'event_tag', 'special', NULL, '{event}', 8),
  ('seasonal', 'Seasonal', 'event_tag', 'special', NULL, '{event}', 9);

-- Logistics tags
INSERT INTO taxonomy_definitions (id, label, taxonomy_type, taxonomy_group, category_scope, entity_scope, display_order) VALUES
  ('ticketed', 'Ticketed', 'event_tag', 'logistics', NULL, '{event}', 1),
  ('rsvp-required', 'RSVP Required', 'event_tag', 'logistics', NULL, '{event}', 2),
  ('sold-out', 'Sold Out', 'event_tag', 'logistics', NULL, '{event}', 3),
  ('limited-seating', 'Limited Seating', 'event_tag', 'logistics', NULL, '{event}', 4);

-- ─── Seed: Venue Vibes (from VALID_VIBES in tags.py) ────────────────────────

-- Atmosphere vibes
INSERT INTO taxonomy_definitions (id, label, taxonomy_type, taxonomy_group, category_scope, entity_scope, display_order) VALUES
  ('late-night', 'Late Night', 'venue_vibe', 'atmosphere', NULL, '{venue}', 1),
  ('date-spot', 'Date Spot', 'venue_vibe', 'atmosphere', NULL, '{venue}', 2),
  ('divey', 'Divey', 'venue_vibe', 'atmosphere', NULL, '{venue}', 3),
  ('vibe-intimate', 'Intimate', 'venue_vibe', 'atmosphere', NULL, '{venue}', 4),
  ('upscale', 'Upscale', 'venue_vibe', 'atmosphere', NULL, '{venue}', 5),
  ('casual', 'Casual', 'venue_vibe', 'atmosphere', NULL, '{venue}', 6),
  ('artsy', 'Artsy', 'venue_vibe', 'atmosphere', NULL, '{venue}', 7),
  ('historic', 'Historic', 'venue_vibe', 'atmosphere', NULL, '{venue}', 8),
  ('trendy', 'Trendy', 'venue_vibe', 'atmosphere', NULL, '{venue}', 9),
  ('cozy', 'Cozy', 'venue_vibe', 'atmosphere', NULL, '{venue}', 10),
  ('lively', 'Lively', 'venue_vibe', 'atmosphere', NULL, '{venue}', 11);

-- Venue style vibes
INSERT INTO taxonomy_definitions (id, label, taxonomy_type, taxonomy_group, category_scope, entity_scope, display_order) VALUES
  ('sports-bar', 'Sports Bar', 'venue_vibe', 'venue-style', NULL, '{venue}', 1),
  ('neighborhood-bar', 'Neighborhood Bar', 'venue_vibe', 'venue-style', NULL, '{venue}', 2),
  ('dive-bar', 'Dive Bar', 'venue_vibe', 'venue-style', NULL, '{venue}', 3),
  ('vibe-pop-up', 'Pop-Up', 'venue_vibe', 'venue-style', NULL, '{venue}', 4),
  ('fast-casual', 'Fast Casual', 'venue_vibe', 'venue-style', NULL, '{venue}', 5),
  ('counter-service', 'Counter Service', 'venue_vibe', 'venue-style', NULL, '{venue}', 6),
  ('happy-hour', 'Happy Hour', 'venue_vibe', 'venue-style', NULL, '{venue}', 7);

-- Amenity vibes
INSERT INTO taxonomy_definitions (id, label, taxonomy_type, taxonomy_group, category_scope, entity_scope, display_order) VALUES
  ('outdoor-seating', 'Outdoor Seating', 'venue_vibe', 'amenities', NULL, '{venue}', 1),
  ('craft-cocktails', 'Craft Cocktails', 'venue_vibe', 'amenities', NULL, '{venue}', 2),
  ('vibe-live-music', 'Live Music', 'venue_vibe', 'amenities', NULL, '{venue}', 3),
  ('good-for-groups', 'Good for Groups', 'venue_vibe', 'amenities', NULL, '{venue}', 4),
  ('vibe-rooftop', 'Rooftop', 'venue_vibe', 'amenities', NULL, '{venue}', 5),
  ('patio', 'Patio', 'venue_vibe', 'amenities', NULL, '{venue}', 6),
  ('free-parking', 'Free Parking', 'venue_vibe', 'amenities', NULL, '{venue}', 7),
  ('vibe-games', 'Games', 'venue_vibe', 'amenities', NULL, '{venue}', 8),
  ('vibe-karaoke', 'Karaoke', 'venue_vibe', 'amenities', NULL, '{venue}', 9);

-- Accessibility vibes
INSERT INTO taxonomy_definitions (id, label, taxonomy_type, taxonomy_group, category_scope, entity_scope, display_order) VALUES
  ('vibe-all-ages', 'All Ages', 'venue_vibe', 'accessibility', NULL, '{venue}', 1),
  ('vibe-family-friendly', 'Family Friendly', 'venue_vibe', 'accessibility', NULL, '{venue}', 2),
  ('dog-friendly', 'Dog Friendly', 'venue_vibe', 'accessibility', NULL, '{venue}', 3),
  ('wheelchair-accessible', 'Wheelchair Accessible', 'venue_vibe', 'accessibility', NULL, '{venue}', 4);

-- Identity vibes
INSERT INTO taxonomy_definitions (id, label, taxonomy_type, taxonomy_group, category_scope, entity_scope, display_order) VALUES
  ('lgbtq-friendly', 'LGBTQ+', 'venue_vibe', 'identity', NULL, '{venue}', 1),
  ('black-owned', 'Black-Owned', 'venue_vibe', 'identity', NULL, '{venue}', 2),
  ('woman-owned', 'Woman-Owned', 'venue_vibe', 'identity', NULL, '{venue}', 3);

-- ─── Seed: Occasions (from OCCASION_CHIPS, ACTIVITY_CHIPS, NIGHTLIFE_CHIPS) ─

-- Eat & Drink occasions
INSERT INTO taxonomy_definitions (id, label, taxonomy_type, taxonomy_group, category_scope, entity_scope, icon, color, filter_overrides, display_order) VALUES
  ('occ-coffee', 'Coffee', 'occasion', 'eat-drink', NULL, '{venue}', 'coffee_shop', '#D4A574',
   '{"venueTypes": ["restaurant"], "cuisine": ["coffee"]}', 1),
  ('occ-breakfast', 'Breakfast', 'occasion', 'eat-drink', NULL, '{venue}', 'restaurant', '#FB923C',
   '{"cuisine": ["brunch_breakfast", "coffee"]}', 2),
  ('occ-brunch', 'Brunch', 'occasion', 'eat-drink', NULL, '{venue}', 'food_drink', '#FBBF24',
   '{"cuisine": ["brunch_breakfast"]}', 3),
  ('occ-lunch', 'Lunch', 'occasion', 'eat-drink', NULL, '{venue}', 'restaurant', '#FB923C',
   '{"venueTypes": ["restaurant", "food_hall"]}', 4),
  ('occ-happy-hour', 'Happy Hour', 'occasion', 'eat-drink', NULL, '{venue}', 'bar', '#FBBF24',
   '{"venueTypes": ["bar", "brewery", "restaurant"]}', 5),
  ('occ-late-night', 'Late Night', 'occasion', 'eat-drink', NULL, '{venue}', 'nightlife', '#A78BFA',
   '{"vibes": ["late-night"]}', 6),
  ('occ-date-night-ed', 'Date Night', 'occasion', 'eat-drink', NULL, '{venue}', 'food_drink', '#F472B6',
   '{"vibes": ["date-spot", "upscale", "intimate"]}', 7);

-- Things to Do occasions
INSERT INTO taxonomy_definitions (id, label, taxonomy_type, taxonomy_group, category_scope, entity_scope, icon, color, filter_overrides, display_order) VALUES
  ('occ-museums', 'Museums', 'occasion', 'things-to-do', NULL, '{venue}', 'museum', '#A78BFA',
   '{"venueTypes": ["museum", "gallery", "arts_center"]}', 1),
  ('occ-outdoors', 'Outdoors', 'occasion', 'things-to-do', NULL, '{venue}', 'outdoors', '#4ADE80',
   '{"venueTypes": ["park", "trail", "landmark", "viewpoint"]}', 2),
  ('occ-family-fun', 'Family Fun', 'occasion', 'things-to-do', NULL, '{venue}', 'games', '#86EFAC',
   '{"venueTypes": ["arcade", "recreation", "attraction", "eatertainment"]}', 3),
  ('occ-arts', 'Arts & Theater', 'occasion', 'things-to-do', NULL, '{venue}', 'theater', '#F472B6',
   '{"venueTypes": ["theater", "cinema", "arts_center"]}', 4),
  ('occ-fitness', 'Fitness', 'occasion', 'things-to-do', NULL, '{venue}', 'fitness', '#5EEAD4',
   '{"venueTypes": ["fitness", "recreation"]}', 5);

-- Nightlife occasions
INSERT INTO taxonomy_definitions (id, label, taxonomy_type, taxonomy_group, category_scope, entity_scope, icon, color, filter_overrides, display_order) VALUES
  ('occ-live-music', 'Live Music', 'occasion', 'nightlife', NULL, '{venue}', 'music', '#F472B6',
   '{"vibes": ["live-music"]}', 1),
  ('occ-cocktails', 'Cocktails', 'occasion', 'nightlife', NULL, '{venue}', 'food_drink', '#FBBF24',
   '{"vibes": ["craft-cocktails"]}', 2),
  ('occ-date-night-nl', 'Date Night', 'occasion', 'nightlife', NULL, '{venue}', 'food_drink', '#F472B6',
   '{"vibes": ["date-spot", "intimate"]}', 3),
  ('occ-divey', 'Divey', 'occasion', 'nightlife', NULL, '{venue}', 'bar', '#86EFAC',
   '{"vibes": ["dive-bar", "casual"]}', 4);

-- ─── Drop genre_options (replaced by taxonomy_definitions WHERE taxonomy_type = 'genre') ─

DROP TABLE IF EXISTS genre_options;
