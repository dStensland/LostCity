-- Lost City: Category Taxonomy Migration
-- Creates hierarchical category system with categories and subcategories

-- ============================================
-- 1. Create categories table (top level)
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_order INT NOT NULL,
  icon TEXT,
  color TEXT
);

-- ============================================
-- 2. Create subcategories table
-- ============================================
CREATE TABLE IF NOT EXISTS subcategories (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  display_order INT NOT NULL
);

-- ============================================
-- 3. Seed categories
-- ============================================
INSERT INTO categories (id, name, display_order, icon, color) VALUES
  ('music', 'Music', 1, 'music', '#E8A87C'),
  ('film', 'Film', 2, 'film', '#41B3A3'),
  ('comedy', 'Comedy', 3, 'laugh', '#E27D60'),
  ('theater', 'Theater', 4, 'theater', '#C38D9E'),
  ('art', 'Art', 5, 'palette', '#85DCB8'),
  ('sports', 'Sports', 6, 'trophy', '#E8A87C'),
  ('food_drink', 'Food & Drink', 7, 'utensils', '#F4C87C'),
  ('nightlife', 'Nightlife', 8, 'moon', '#E27D8A'),
  ('community', 'Community', 9, 'users', '#8B9DC3'),
  ('fitness', 'Fitness', 10, 'dumbbell', '#7FDBFF'),
  ('family', 'Family', 11, 'child', '#FFD166'),
  ('learning', 'Learning', 12, 'book', '#A8E6CF'),
  ('other', 'Other', 99, 'star', '#888888'),
  ('dance', 'Dance', 13, 'music', '#C38D9E'),
  ('tours', 'Tours', 14, 'map', '#7FDBFF'),
  ('meetup', 'Meetup', 15, 'users', '#ED1C40'),
  ('words', 'Words', 16, 'book', '#93C5FD')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color;

-- ============================================
-- 4. Seed subcategories
-- ============================================

-- MUSIC subcategories
INSERT INTO subcategories (id, category_id, name, display_order) VALUES
  ('music.live', 'music', 'Live Music', 1),
  ('music.live.rock', 'music', 'Rock / Indie', 2),
  ('music.live.hiphop', 'music', 'Hip-Hop / R&B', 3),
  ('music.live.electronic', 'music', 'Electronic / DJ', 4),
  ('music.live.jazz', 'music', 'Jazz / Blues', 5),
  ('music.live.country', 'music', 'Country / Folk / Americana', 6),
  ('music.live.metal', 'music', 'Metal / Punk / Hardcore', 7),
  ('music.live.pop', 'music', 'Pop', 8),
  ('music.live.latin', 'music', 'Latin / World', 9),
  ('music.live.acoustic', 'music', 'Singer-Songwriter / Acoustic', 10),
  ('music.classical', 'music', 'Classical / Orchestra', 11),
  ('music.openmic', 'music', 'Open Mic / Jam Session', 12),
  ('music.festival', 'music', 'Music Festival', 13)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order;

-- FILM subcategories
INSERT INTO subcategories (id, category_id, name, display_order) VALUES
  ('film.new', 'film', 'New Release', 1),
  ('film.repertory', 'film', 'Repertory / Revival', 2),
  ('film.documentary', 'film', 'Documentary', 3),
  ('film.festival', 'film', 'Film Festival', 4),
  ('film.outdoor', 'film', 'Outdoor / Drive-In', 5),
  ('film.screening', 'film', 'Screening + Q&A', 6)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order;

-- COMEDY subcategories
INSERT INTO subcategories (id, category_id, name, display_order) VALUES
  ('comedy.standup', 'comedy', 'Stand-Up', 1),
  ('comedy.improv', 'comedy', 'Improv', 2),
  ('comedy.sketch', 'comedy', 'Sketch', 3),
  ('comedy.openmic', 'comedy', 'Open Mic', 4),
  ('comedy.festival', 'comedy', 'Comedy Festival', 5)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order;

-- THEATER subcategories
INSERT INTO subcategories (id, category_id, name, display_order) VALUES
  ('theater.play', 'theater', 'Play', 1),
  ('theater.musical', 'theater', 'Musical', 2),
  ('theater.dance', 'theater', 'Dance / Ballet', 3),
  ('theater.opera', 'theater', 'Opera', 4),
  ('theater.burlesque', 'theater', 'Burlesque / Cabaret', 5),
  ('theater.immersive', 'theater', 'Immersive / Interactive', 6),
  ('theater.childrens', 'theater', 'Childrens Theater', 7)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order;

-- ART subcategories
INSERT INTO subcategories (id, category_id, name, display_order) VALUES
  ('art.exhibition', 'art', 'Exhibition / Gallery', 1),
  ('art.museum', 'art', 'Museum', 2),
  ('art.artwalk', 'art', 'Art Walk / Open Studios', 3),
  ('art.workshop', 'art', 'Workshop / Class', 4),
  ('art.fair', 'art', 'Art Fair / Market', 5),
  ('art.street', 'art', 'Street Art / Public Art', 6)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order;

-- SPORTS subcategories
INSERT INTO subcategories (id, category_id, name, display_order) VALUES
  ('sports.pro', 'sports', 'Professional', 1),
  ('sports.college', 'sports', 'College', 2),
  ('sports.amateur', 'sports', 'Amateur / Rec League', 3),
  ('sports.outdoor', 'sports', 'Outdoor / Adventure', 4),
  ('sports.combat', 'sports', 'Combat Sports / Wrestling', 5),
  ('sports.esports', 'sports', 'Esports / Gaming', 6)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order;

-- FOOD & DRINK subcategories
INSERT INTO subcategories (id, category_id, name, display_order) VALUES
  ('food_drink.festival', 'food_drink', 'Food Festival', 1),
  ('food_drink.tasting', 'food_drink', 'Tasting / Pairing', 2),
  ('food_drink.popup', 'food_drink', 'Pop-Up / Supper Club', 3),
  ('food_drink.class', 'food_drink', 'Cooking Class', 4),
  ('food_drink.bar', 'food_drink', 'Bar Event / Happy Hour', 5),
  ('food_drink.brewery', 'food_drink', 'Brewery / Distillery Tour', 6),
  ('food_drink.market', 'food_drink', 'Food Market / Night Market', 7)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order;

-- NIGHTLIFE subcategories
INSERT INTO subcategories (id, category_id, name, display_order) VALUES
  ('nightlife.dj', 'nightlife', 'DJ / Dance Night', 1),
  ('nightlife.club', 'nightlife', 'Club Night', 2),
  ('nightlife.drag', 'nightlife', 'Drag / Cabaret', 3),
  ('nightlife.karaoke', 'nightlife', 'Karaoke', 4),
  ('nightlife.trivia', 'nightlife', 'Trivia / Game Night', 5),
  ('nightlife.social', 'nightlife', 'Singles / Social', 6),
  ('nightlife.latenight', 'nightlife', 'Late Night', 7)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order;

-- COMMUNITY subcategories
INSERT INTO subcategories (id, category_id, name, display_order) VALUES
  ('community.volunteer', 'community', 'Volunteer', 1),
  ('community.meetup', 'community', 'Meetup / Social', 2),
  ('community.networking', 'community', 'Networking / Professional', 3),
  ('community.religious', 'community', 'Religious / Spiritual', 4),
  ('community.political', 'community', 'Political / Activism', 5),
  ('community.support', 'community', 'Support Group', 6),
  ('community.neighborhood', 'community', 'Neighborhood / Local', 7),
  ('community.lgbtq', 'community', 'LGBTQ+', 8)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order;

-- FITNESS subcategories
INSERT INTO subcategories (id, category_id, name, display_order) VALUES
  ('fitness.yoga', 'fitness', 'Yoga / Pilates', 1),
  ('fitness.running', 'fitness', 'Running / Walking', 2),
  ('fitness.cycling', 'fitness', 'Cycling', 3),
  ('fitness.group', 'fitness', 'Group Fitness Class', 4),
  ('fitness.league', 'fitness', 'Sports League', 5),
  ('fitness.outdoor', 'fitness', 'Outdoor / Adventure', 6),
  ('fitness.wellness', 'fitness', 'Wellness / Recovery', 7)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order;

-- FAMILY subcategories
INSERT INTO subcategories (id, category_id, name, display_order) VALUES
  ('family.kids', 'family', 'Kids Activity', 1),
  ('family.allages', 'family', 'All Ages Show', 2),
  ('family.festival', 'family', 'Festival / Fair', 3),
  ('family.educational', 'family', 'Educational', 4),
  ('family.holiday', 'family', 'Holiday / Seasonal', 5),
  ('family.storytime', 'family', 'Storytime / Reading', 6)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order;

-- LEARNING subcategories
INSERT INTO subcategories (id, category_id, name, display_order) VALUES
  ('learning.workshop', 'learning', 'Workshop / Class', 1),
  ('learning.lecture', 'learning', 'Lecture / Talk', 2),
  ('learning.book', 'learning', 'Book Event / Reading', 3),
  ('learning.tour', 'learning', 'Tour', 4),
  ('learning.conference', 'learning', 'Conference / Summit', 5),
  ('learning.skillshare', 'learning', 'Skill Share', 6)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order;

-- MEETUP subcategories
INSERT INTO subcategories (id, category_id, name, display_order) VALUES
  ('meetup.tech', 'meetup', 'Tech & Science', 1),
  ('meetup.professional', 'meetup', 'Professional & Career', 2),
  ('meetup.social', 'meetup', 'Social & Networking', 3),
  ('meetup.hobbies', 'meetup', 'Hobbies & Interests', 4),
  ('meetup.outdoors', 'meetup', 'Outdoors & Adventure', 5),
  ('meetup.learning', 'meetup', 'Learning & Development', 6),
  ('meetup.health', 'meetup', 'Health & Wellness', 7),
  ('meetup.creative', 'meetup', 'Arts & Creative', 8),
  ('meetup.sports', 'meetup', 'Sports & Fitness', 9),
  ('meetup.food', 'meetup', 'Food & Drink', 10),
  ('meetup.parents', 'meetup', 'Parents & Family', 11),
  ('meetup.lgbtq', 'meetup', 'LGBTQ+', 12)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order;

-- WORDS subcategories
INSERT INTO subcategories (id, category_id, name, display_order) VALUES
  ('words.reading', 'words', 'Reading / Signing', 1),
  ('words.bookclub', 'words', 'Book Club', 2),
  ('words.poetry', 'words', 'Poetry', 3),
  ('words.storytelling', 'words', 'Storytelling', 4),
  ('words.workshop', 'words', 'Writing Workshop', 5),
  ('words.lecture', 'words', 'Author Talk', 6)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order;

-- ============================================
-- 5. Add new columns to events table
-- ============================================
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS category_id TEXT REFERENCES categories(id),
  ADD COLUMN IF NOT EXISTS subcategory_id TEXT REFERENCES subcategories(id);

-- ============================================
-- 6. Create indexes for new columns
-- ============================================
CREATE INDEX IF NOT EXISTS idx_events_category_id ON events(category_id);
CREATE INDEX IF NOT EXISTS idx_events_subcategory_id ON events(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_category_id ON subcategories(category_id);

-- ============================================
-- 7. Migrate existing category data
-- ============================================
UPDATE events SET category_id = category WHERE category IS NOT NULL AND category_id IS NULL;

-- Map old subcategory values to new IDs
UPDATE events SET subcategory_id = 'music.live.rock' WHERE category = 'music' AND subcategory IN ('rock', 'alternative') AND subcategory_id IS NULL;
UPDATE events SET subcategory_id = 'music.live.hiphop' WHERE category = 'music' AND subcategory IN ('hiphop', 'rnb') AND subcategory_id IS NULL;
UPDATE events SET subcategory_id = 'music.live.jazz' WHERE category = 'music' AND subcategory = 'jazz' AND subcategory_id IS NULL;
UPDATE events SET subcategory_id = 'music.live.country' WHERE category = 'music' AND subcategory = 'country' AND subcategory_id IS NULL;
UPDATE events SET subcategory_id = 'music.live.metal' WHERE category = 'music' AND subcategory = 'metal' AND subcategory_id IS NULL;
UPDATE events SET subcategory_id = 'music.live.pop' WHERE category = 'music' AND subcategory = 'pop' AND subcategory_id IS NULL;
UPDATE events SET subcategory_id = 'music.classical' WHERE category = 'music' AND subcategory = 'classical' AND subcategory_id IS NULL;
UPDATE events SET subcategory_id = 'comedy.improv' WHERE category = 'comedy' AND subcategory = 'improv' AND subcategory_id IS NULL;
UPDATE events SET subcategory_id = 'comedy.standup' WHERE category = 'comedy' AND subcategory = 'comedy' AND subcategory_id IS NULL;
UPDATE events SET subcategory_id = 'community.volunteer' WHERE category = 'community' AND subcategory = 'volunteer' AND subcategory_id IS NULL;
UPDATE events SET subcategory_id = 'art.museum' WHERE category = 'art' AND subcategory = 'museum' AND subcategory_id IS NULL;
UPDATE events SET subcategory_id = 'art.exhibition' WHERE category = 'art' AND subcategory = 'garden' AND subcategory_id IS NULL;

-- ============================================
-- 8. Add rollup_behavior to sources table
-- ============================================
ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS rollup_behavior TEXT DEFAULT 'normal';

-- Set rollup behavior for specific sources
UPDATE sources SET rollup_behavior = 'category' WHERE slug IN ('hands-on-atlanta');
UPDATE sources SET rollup_behavior = 'venue' WHERE slug IN ('tara-theatre', 'plaza-theatre', 'landmark-midtown');
