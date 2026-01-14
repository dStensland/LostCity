-- Migration 010: Content Strategy Expansion
-- Adds event_producers, festivals, new venues, and spot types

-- ============================================================================
-- 1. EVENT_PRODUCERS TABLE (venue-less event producers)
-- Note: 'organizations' table exists for user accounts, so using different name
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_producers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,

  -- Type
  org_type TEXT NOT NULL,  -- 'arts_nonprofit', 'film_society', 'cultural_org', etc.

  -- Contact
  website TEXT,
  email TEXT,
  phone TEXT,

  -- Social (for scraping/monitoring)
  instagram TEXT,
  facebook TEXT,
  twitter TEXT,
  eventbrite_organizer_id TEXT,

  -- Location (general area, not specific venue)
  neighborhood TEXT,
  city TEXT DEFAULT 'Atlanta',

  -- Categories they typically produce
  categories TEXT[],

  -- Event scraping
  events_url TEXT,
  ical_url TEXT,

  -- Quality/Activity
  events_per_month_avg INT,
  last_event_date DATE,
  total_events_tracked INT DEFAULT 0,

  -- Curation
  featured BOOLEAN DEFAULT FALSE,
  hidden BOOLEAN DEFAULT FALSE,

  -- Meta
  description TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link events to event producers
ALTER TABLE events ADD COLUMN IF NOT EXISTS producer_id TEXT REFERENCES event_producers(id);

CREATE INDEX IF NOT EXISTS idx_events_producer ON events(producer_id);
CREATE INDEX IF NOT EXISTS idx_producers_type ON event_producers(org_type);
CREATE INDEX IF NOT EXISTS idx_producers_categories ON event_producers USING GIN(categories);

-- ============================================================================
-- 2. FESTIVALS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS festivals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  website TEXT,

  -- Timing
  typical_month INT CHECK (typical_month BETWEEN 1 AND 12),
  typical_duration_days INT DEFAULT 1,

  -- Location
  location TEXT,
  neighborhood TEXT,

  -- Categorization
  categories TEXT[],
  free BOOLEAN DEFAULT FALSE,

  -- Dates
  last_year_start DATE,
  last_year_end DATE,
  announced_2026 BOOLEAN DEFAULT FALSE,
  announced_start DATE,
  announced_end DATE,

  -- Ticketing
  ticket_url TEXT,

  -- Producer link
  producer_id TEXT REFERENCES event_producers(id),

  -- Meta
  description TEXT,
  image_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_festivals_month ON festivals(typical_month);

-- ============================================================================
-- 3. ADD FREE EVENT TRACKING
-- ============================================================================

-- These columns may already exist, so use IF NOT EXISTS
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT FALSE;

-- Index for free event queries
CREATE INDEX IF NOT EXISTS idx_events_free ON events(is_free) WHERE is_free = TRUE;

-- ============================================================================
-- 4. SEED ORGANIZATIONS
-- ============================================================================

INSERT INTO event_producers (id, name, slug, org_type, website, categories, neighborhood) VALUES
-- Art Centers
('atlanta-contemporary', 'Atlanta Contemporary', 'atlanta-contemporary', 'arts_nonprofit', 'https://atlantacontemporary.org', '{"art", "learning"}', 'Westside'),
('callanwolde', 'Callanwolde Fine Arts Center', 'callanwolde', 'arts_nonprofit', 'https://callanwolde.org', '{"art", "music", "learning"}', 'Druid Hills'),
('spruill-arts', 'Spruill Center for the Arts', 'spruill-arts', 'arts_nonprofit', 'https://spruillarts.org', '{"art", "learning"}', 'Dunwoody'),
('hammonds-house', 'Hammonds House Museum', 'hammonds-house', 'arts_nonprofit', 'https://hammondshouse.org', '{"art", "community"}', 'West End'),
('eyedrum', 'Eyedrum', 'eyedrum', 'arts_nonprofit', 'https://eyedrum.org', '{"art", "music", "community"}', 'Downtown'),
('woodruff-arts', 'Woodruff Arts Center', 'woodruff-arts', 'arts_nonprofit', 'https://woodruffcenter.org', '{"art", "music", "theater"}', 'Midtown'),

-- Arts Alliances
('decatur-arts', 'Decatur Arts Alliance', 'decatur-arts', 'arts_nonprofit', 'https://decaturartsalliance.org', '{"art", "community", "festival"}', 'Decatur'),
('atlanta-celebrates-photo', 'Atlanta Celebrates Photography', 'atlanta-celebrates-photo', 'arts_nonprofit', 'https://acpinfo.org', '{"art", "film"}', NULL),

-- Film Organizations
('atlanta-film-society', 'Atlanta Film Society', 'atlanta-film-society', 'film_society', 'https://atlantafilmsociety.org', '{"film"}', 'Midtown'),
('out-on-film', 'Out On Film', 'out-on-film', 'film_society', 'https://outonfilm.org', '{"film", "community"}', 'Midtown'),
('atlanta-jewish-film', 'Atlanta Jewish Film Festival', 'atlanta-jewish-film', 'film_society', 'https://ajff.org', '{"film", "community"}', NULL),
('bronzelens', 'BronzeLens Film Festival', 'bronzelens', 'film_society', 'https://bronzelens.com', '{"film", "community"}', NULL),

-- Music Organizations
('atlanta-symphony', 'Atlanta Symphony Orchestra', 'atlanta-symphony', 'arts_nonprofit', 'https://aso.org', '{"music"}', 'Midtown'),
('atlanta-opera', 'Atlanta Opera', 'atlanta-opera', 'arts_nonprofit', 'https://atlantaopera.org', '{"music", "theater"}', 'Midtown'),
('atlanta-ballet', 'Atlanta Ballet', 'atlanta-ballet', 'arts_nonprofit', 'https://atlantaballet.com', '{"theater", "fitness"}', 'Midtown'),

-- Community Organizations
('atlanta-beltline-inc', 'Atlanta BeltLine Inc', 'atlanta-beltline-inc', 'community_group', 'https://beltline.org', '{"art", "community", "fitness"}', NULL),
('trees-atlanta', 'Trees Atlanta', 'trees-atlanta', 'community_group', 'https://treesatlanta.org', '{"community", "fitness"}', NULL),
('park-pride', 'Park Pride', 'park-pride', 'community_group', 'https://parkpride.org', '{"community"}', NULL),
('atlanta-audubon', 'Atlanta Audubon Society', 'atlanta-audubon', 'community_group', 'https://atlantaaudubon.org', '{"community", "learning"}', NULL),

-- Running & Fitness
('atlanta-track-club', 'Atlanta Track Club', 'atlanta-track-club', 'running_club', 'https://atlantatrackclub.org', '{"fitness", "community"}', NULL),
('november-project-atl', 'November Project Atlanta', 'november-project-atl', 'running_club', 'https://november-project.com/atlanta', '{"fitness", "community"}', NULL),

-- Food & Drink
('taste-of-atlanta', 'Taste of Atlanta', 'taste-of-atlanta', 'food_festival', 'https://tasteofatlanta.com', '{"food_drink", "festival"}', 'Midtown'),

-- Cultural Organizations
('atlanta-pride', 'Atlanta Pride Committee', 'atlanta-pride', 'community_group', 'https://atlantapride.org', '{"community", "festival"}', 'Midtown'),
('japan-fest', 'JapanFest Atlanta', 'japan-fest', 'cultural_org', 'https://japanfest.org', '{"community", "festival"}', 'Duluth'),

-- Literary
('atlanta-writers-club', 'Atlanta Writers Club', 'atlanta-writers-club', 'community_group', 'https://atlantawritersclub.org', '{"words", "community"}', NULL),
('decatur-book-fest', 'AJC Decatur Book Festival', 'decatur-book-fest', 'community_group', 'https://decaturbookfestival.com', '{"words", "festival"}', 'Decatur')

ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. SEED FESTIVALS
-- ============================================================================

INSERT INTO festivals (id, name, slug, website, typical_month, typical_duration_days, location, categories, free) VALUES
('shaky-knees', 'Shaky Knees', 'shaky-knees', 'https://shakykneesfestival.com', 5, 3, 'Central Park', '{"music", "festival"}', FALSE),
('music-midtown', 'Music Midtown', 'music-midtown', 'https://musicmidtown.com', 9, 2, 'Piedmont Park', '{"music", "festival"}', FALSE),
('atlanta-jazz-fest', 'Atlanta Jazz Festival', 'atlanta-jazz-fest', 'https://atlantafestivals.com', 5, 3, 'Piedmont Park', '{"music", "festival"}', TRUE),
('dragon-con', 'Dragon Con', 'dragon-con', 'https://dragoncon.org', 9, 4, 'Downtown Hotels', '{"community", "festival"}', FALSE),
('decatur-book-festival', 'Decatur Book Festival', 'decatur-book-festival', 'https://decaturbookfestival.com', 10, 2, 'Decatur Square', '{"words", "festival"}', TRUE),
('atlanta-film-festival', 'Atlanta Film Festival', 'atlanta-film-festival', 'https://atlantafilmfestival.com', 4, 10, 'Various', '{"film", "festival"}', FALSE),
('atl-pride', 'Atlanta Pride Festival', 'atl-pride', 'https://atlantapride.org', 10, 2, 'Piedmont Park', '{"community", "festival"}', TRUE),
('inman-park-festival', 'Inman Park Festival', 'inman-park-festival', 'https://inmanparkfestival.org', 4, 2, 'Inman Park', '{"art", "community", "festival"}', TRUE),
('candler-park-fall-fest', 'Candler Park Fall Fest', 'candler-park-fall-fest', 'https://fallfest.candlerpark.org', 10, 2, 'Candler Park', '{"music", "community", "festival"}', TRUE),
('l5p-halloween', 'Little 5 Points Halloween', 'l5p-halloween', 'https://l5phalloween.com', 10, 1, 'Little Five Points', '{"community", "festival"}', TRUE),
('taste-of-atlanta-fest', 'Taste of Atlanta', 'taste-of-atlanta-fest', 'https://tasteofatlanta.com', 10, 3, 'Midtown', '{"food_drink", "festival"}', FALSE),
('dogwood-festival', 'Atlanta Dogwood Festival', 'dogwood-festival', 'https://dogwood.org', 4, 3, 'Piedmont Park', '{"art", "music", "festival"}', TRUE),
('sweet-auburn-fest', 'Sweet Auburn Springfest', 'sweet-auburn-fest', 'https://sweetauburn.com', 5, 2, 'Auburn Avenue', '{"music", "community", "festival"}', TRUE),
('one-musicfest', 'ONE Musicfest', 'one-musicfest', 'https://onemusicfest.com', 10, 2, 'Piedmont Park', '{"music", "festival"}', FALSE)
ON CONFLICT (id) DO NOTHING;
