-- Lost City Places Schema
-- PostGIS-enabled database for ITP Atlanta places

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- NEIGHBORHOODS
-- ============================================================================

CREATE TABLE IF NOT EXISTS neighborhoods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  radius INT NOT NULL,  -- meters
  tier INT NOT NULL DEFAULT 2,  -- 1=high activity, 2=medium, 3=low
  location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PLACES
-- ============================================================================

CREATE TABLE IF NOT EXISTS places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_place_id TEXT UNIQUE NOT NULL,

  -- Basic info
  name TEXT NOT NULL,
  address TEXT,
  neighborhood_id TEXT REFERENCES neighborhoods(id),

  -- Location
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
  ) STORED,

  -- Categorization
  category_id TEXT NOT NULL,  -- 'restaurants', 'bars', etc.
  google_types TEXT[],
  primary_type TEXT,

  -- Google data
  rating DECIMAL(2, 1),
  rating_count INT,
  price_level INT CHECK (price_level BETWEEN 0 AND 4),

  -- Hours
  hours_json JSONB,
  is_24_hours BOOLEAN DEFAULT FALSE,

  -- Contact
  phone TEXT,
  website TEXT,
  google_maps_url TEXT,

  -- Attributes
  wheelchair_accessible BOOLEAN,
  outdoor_seating BOOLEAN,
  serves_vegetarian BOOLEAN,
  serves_vegan BOOLEAN,
  serves_beer BOOLEAN,
  serves_wine BOOLEAN,
  serves_breakfast BOOLEAN,
  serves_brunch BOOLEAN,
  serves_lunch BOOLEAN,
  serves_dinner BOOLEAN,
  delivery BOOLEAN,
  dine_in BOOLEAN,
  takeout BOOLEAN,
  reservable BOOLEAN,

  -- Scores (0-100)
  google_score INT DEFAULT 0,        -- computed from rating + popularity
  event_venue_score INT DEFAULT 0,   -- computed from event data
  user_score INT DEFAULT 0,          -- computed from user signals
  final_score INT DEFAULT 0,         -- weighted composite

  -- Curation flags
  editor_pick BOOLEAN DEFAULT FALSE,
  local_certified BOOLEAN DEFAULT FALSE,
  hidden_gem BOOLEAN DEFAULT FALSE,
  tourist_trap BOOLEAN DEFAULT FALSE,

  -- Lost City specific
  is_event_venue BOOLEAN DEFAULT FALSE,
  linked_venue_id INT,  -- FK to venues table if this is an event venue

  -- Healthcare portal flags (for Piedmont, etc.)
  heart_healthy_options BOOLEAN,
  low_sodium_options BOOLEAN,
  diabetic_friendly BOOLEAN,

  -- Meta
  hidden BOOLEAN DEFAULT FALSE,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  last_refreshed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_places_location ON places USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_places_category ON places(category_id);
CREATE INDEX IF NOT EXISTS idx_places_neighborhood ON places(neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_places_final_score ON places(final_score DESC);
CREATE INDEX IF NOT EXISTS idx_places_google_id ON places(google_place_id);
CREATE INDEX IF NOT EXISTS idx_places_event_venue ON places(is_event_venue) WHERE is_event_venue = TRUE;
CREATE INDEX IF NOT EXISTS idx_places_editor_pick ON places(editor_pick) WHERE editor_pick = TRUE;

-- Full-text search
ALTER TABLE places ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(neighborhood_id, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(address, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_places_fts ON places USING GIN(fts);

-- ============================================================================
-- USER SIGNALS (Phase 2)
-- ============================================================================

CREATE TABLE IF NOT EXISTS place_user_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID REFERENCES places(id) ON DELETE CASCADE,
  user_id UUID,  -- References auth.users when auth is set up

  -- Signal types
  saved BOOLEAN DEFAULT FALSE,
  saved_at TIMESTAMPTZ,

  calendar_added BOOLEAN DEFAULT FALSE,
  calendar_added_at TIMESTAMPTZ,

  clicked BOOLEAN DEFAULT FALSE,
  click_count INT DEFAULT 0,
  last_clicked_at TIMESTAMPTZ,

  checked_in BOOLEAN DEFAULT FALSE,
  checkin_count INT DEFAULT 0,
  last_checkin_at TIMESTAMPTZ,

  recommended BOOLEAN DEFAULT FALSE,
  recommended_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(place_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_signals_place ON place_user_signals(place_id);
CREATE INDEX IF NOT EXISTS idx_signals_user ON place_user_signals(user_id);

-- ============================================================================
-- SIGNAL STATS (Materialized View)
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS place_signal_stats AS
SELECT
  place_id,
  COUNT(*) FILTER (WHERE saved) as save_count,
  COUNT(*) FILTER (WHERE calendar_added) as calendar_count,
  SUM(click_count) as total_clicks,
  COUNT(*) FILTER (WHERE checked_in) as checkin_users,
  SUM(checkin_count) as total_checkins,
  COUNT(*) FILTER (WHERE recommended) as recommendation_count,
  COUNT(*) FILTER (WHERE saved AND saved_at > NOW() - INTERVAL '30 days') as saves_30d,
  COUNT(*) FILTER (WHERE checked_in AND last_checkin_at > NOW() - INTERVAL '30 days') as checkins_30d
FROM place_user_signals
GROUP BY place_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_signal_stats_place ON place_signal_stats(place_id);

-- ============================================================================
-- HOSPITALS (for portal)
-- ============================================================================

CREATE TABLE IF NOT EXISTS hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  address TEXT NOT NULL,
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
  ) STORED,
  phone TEXT,
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- HOSPITAL NEARBY PLACES (Materialized View)
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS hospital_nearby_places AS
SELECT
  p.id as place_id,
  p.name,
  p.category_id,
  p.final_score,
  p.rating,
  p.price_level,
  p.is_24_hours,
  p.wheelchair_accessible,
  h.id as hospital_id,
  h.slug as hospital_slug,
  ROUND(ST_Distance(p.location, h.location)::numeric) as distance_meters
FROM places p
CROSS JOIN hospitals h
WHERE ST_DWithin(p.location, h.location, 5000)  -- 5km radius
  AND p.hidden = FALSE
  AND p.final_score >= 40;

CREATE INDEX IF NOT EXISTS idx_hospital_nearby ON hospital_nearby_places(hospital_id, category_id, distance_meters);
CREATE INDEX IF NOT EXISTS idx_hospital_nearby_score ON hospital_nearby_places(hospital_id, final_score DESC);

-- ============================================================================
-- SCORING FUNCTIONS
-- ============================================================================

-- Helper function for Google score (Bayesian average)
CREATE OR REPLACE FUNCTION calculate_google_score(p_rating DECIMAL, p_rating_count INT)
RETURNS INT AS $$
DECLARE
  prior_rating DECIMAL := 4.0;
  prior_count INT := 30;
  adjusted_rating DECIMAL;
  popularity_factor DECIMAL;
  rating_score INT;
  popularity_score INT;
BEGIN
  IF p_rating IS NULL OR p_rating_count IS NULL OR p_rating_count = 0 THEN
    RETURN 0;
  END IF;

  adjusted_rating := (p_rating * p_rating_count + prior_rating * prior_count) / (p_rating_count + prior_count);
  popularity_factor := LOG(p_rating_count + 1) / 3;
  rating_score := ((adjusted_rating - 1) / 4 * 70)::INT;
  popularity_score := LEAST(30, (popularity_factor * 30)::INT);

  RETURN rating_score + popularity_score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to recalculate all scores for a place
CREATE OR REPLACE FUNCTION update_place_scores(place_uuid UUID)
RETURNS void AS $$
DECLARE
  g_score INT;
  e_score INT;
  u_score INT;
  f_score INT;
  place_rec RECORD;
  signal_rec RECORD;
  event_rec RECORD;
  total_signals INT;
  maturity FLOAT;
  w_google FLOAT;
  w_event FLOAT;
  w_user FLOAT;
BEGIN
  -- Get place data
  SELECT * INTO place_rec FROM places WHERE id = place_uuid;

  IF place_rec IS NULL THEN
    RETURN;
  END IF;

  -- Calculate Google score
  g_score := calculate_google_score(place_rec.rating, place_rec.rating_count);

  -- Calculate event venue score (if applicable)
  IF place_rec.is_event_venue AND place_rec.linked_venue_id IS NOT NULL THEN
    SELECT
      COUNT(*) as event_count,
      COUNT(DISTINCT category_id) as category_count
    INTO event_rec
    FROM events
    WHERE venue_id = place_rec.linked_venue_id;

    e_score := LEAST(100, (LN(COALESCE(event_rec.event_count, 0) + 1) * 33)::INT + (COALESCE(event_rec.category_count, 0) * 5));
  ELSE
    e_score := 0;
  END IF;

  -- Calculate user score
  SELECT * INTO signal_rec FROM place_signal_stats WHERE place_id = place_uuid;
  IF signal_rec IS NOT NULL THEN
    u_score := LEAST(100, (
      (COALESCE(signal_rec.save_count, 0) * 1) +
      (COALESCE(signal_rec.calendar_count, 0) * 3) +
      (COALESCE(signal_rec.checkin_users, 0) * 5) +
      (COALESCE(signal_rec.recommendation_count, 0) * 10)
    )::INT);
  ELSE
    u_score := 0;
  END IF;

  -- Get total signals for weighting
  SELECT COUNT(*) INTO total_signals FROM place_user_signals;

  -- Calculate final score with dynamic weighting
  maturity := LEAST(1.0, COALESCE(total_signals, 0)::FLOAT / 10000);
  w_google := 0.7 - (maturity * 0.4);
  w_event := 0.2;
  w_user := maturity * 0.4;

  f_score := (g_score * w_google + e_score * w_event + u_score * w_user)::INT;

  -- Editorial modifiers
  IF place_rec.editor_pick THEN f_score := f_score + 12; END IF;
  IF place_rec.local_certified THEN f_score := f_score + 8; END IF;
  IF place_rec.hidden_gem THEN f_score := f_score + 5; END IF;
  IF place_rec.tourist_trap THEN f_score := f_score - 20; END IF;

  f_score := GREATEST(0, LEAST(100, f_score));

  -- Update place
  UPDATE places SET
    google_score = g_score,
    event_venue_score = e_score,
    user_score = u_score,
    final_score = f_score,
    updated_at = NOW()
  WHERE id = place_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- NEARBY PLACES FUNCTION (for API)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_nearby_places(
  p_lat FLOAT,
  p_lng FLOAT,
  p_radius INT,
  p_category TEXT DEFAULT NULL,
  p_min_score INT DEFAULT 40
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  address TEXT,
  category_id TEXT,
  rating DECIMAL,
  price_level INT,
  final_score INT,
  is_24_hours BOOLEAN,
  wheelchair_accessible BOOLEAN,
  phone TEXT,
  website TEXT,
  google_maps_url TEXT,
  distance_meters INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.address,
    p.category_id,
    p.rating,
    p.price_level,
    p.final_score,
    p.is_24_hours,
    p.wheelchair_accessible,
    p.phone,
    p.website,
    p.google_maps_url,
    ST_Distance(
      p.location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    )::INT as distance_meters
  FROM places p
  WHERE ST_DWithin(
    p.location,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    p_radius
  )
  AND p.hidden = FALSE
  AND p.final_score >= p_min_score
  AND (p_category IS NULL OR p.category_id = p_category)
  ORDER BY distance_meters ASC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INCREMENT SIGNAL COUNT FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_signal_count(
  p_place_id UUID,
  p_user_id UUID,
  p_field TEXT
)
RETURNS void AS $$
BEGIN
  IF p_field = 'click_count' THEN
    UPDATE place_user_signals
    SET click_count = click_count + 1, updated_at = NOW()
    WHERE place_id = p_place_id AND user_id = p_user_id;
  ELSIF p_field = 'checkin_count' THEN
    UPDATE place_user_signals
    SET checkin_count = checkin_count + 1, updated_at = NOW()
    WHERE place_id = p_place_id AND user_id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SEED NEIGHBORHOODS
-- ============================================================================

INSERT INTO neighborhoods (id, name, lat, lng, radius, tier) VALUES
  -- Tier 1: High activity cores
  ('downtown', 'Downtown', 33.749, -84.388, 2000, 1),
  ('midtown', 'Midtown', 33.784, -84.383, 2000, 1),
  ('buckhead', 'Buckhead', 33.838, -84.379, 2500, 1),
  ('old-fourth-ward', 'Old Fourth Ward', 33.769, -84.362, 1500, 1),
  ('east-atlanta-village', 'East Atlanta Village', 33.740, -84.341, 1000, 1),
  ('little-five-points', 'Little Five Points', 33.764, -84.349, 1000, 1),
  ('decatur', 'Decatur', 33.775, -84.296, 2000, 1),
  ('west-midtown', 'West Midtown', 33.791, -84.422, 2000, 1),
  ('ponce-city-market', 'Ponce City Market Area', 33.772, -84.365, 800, 1),
  ('krog-street', 'Krog Street', 33.759, -84.363, 600, 1),

  -- Tier 2: Active neighborhoods
  ('virginia-highland', 'Virginia Highland', 33.774, -84.356, 1200, 2),
  ('inman-park', 'Inman Park', 33.761, -84.352, 1200, 2),
  ('grant-park', 'Grant Park', 33.738, -84.370, 1500, 2),
  ('cabbagetown', 'Cabbagetown', 33.749, -84.353, 800, 2),
  ('reynoldstown', 'Reynoldstown', 33.749, -84.340, 1000, 2),
  ('kirkwood', 'Kirkwood', 33.756, -84.318, 1500, 2),
  ('candler-park', 'Candler Park', 33.764, -84.336, 1200, 2),
  ('edgewood', 'Edgewood', 33.752, -84.331, 1000, 2),
  ('west-end', 'West End', 33.736, -84.413, 1500, 2),
  ('atlantic-station', 'Atlantic Station', 33.791, -84.395, 1000, 2),
  ('ansley-park', 'Ansley Park', 33.794, -84.380, 1200, 2),
  ('morningside', 'Morningside', 33.796, -84.357, 1500, 2),
  ('druid-hills', 'Druid Hills', 33.783, -84.328, 2000, 2),
  ('east-lake', 'East Lake', 33.756, -84.302, 1500, 2),
  ('summerhill', 'Summerhill', 33.735, -84.381, 1200, 2),

  -- Tier 3: Residential-heavy
  ('lake-claire', 'Lake Claire', 33.767, -84.322, 1000, 3),
  ('ormewood-park', 'Ormewood Park', 33.727, -84.348, 1200, 3),
  ('poncey-highland', 'Poncey-Highland', 33.772, -84.348, 1000, 3),
  ('castleberry-hill', 'Castleberry Hill', 33.748, -84.401, 800, 3),
  ('sweet-auburn', 'Sweet Auburn', 33.755, -84.376, 1000, 3),
  ('pittsburgh', 'Pittsburgh', 33.727, -84.404, 1200, 3),
  ('mechanicsville', 'Mechanicsville', 33.735, -84.400, 1000, 3),
  ('vine-city', 'Vine City', 33.760, -84.417, 1200, 3),
  ('english-avenue', 'English Avenue', 33.768, -84.428, 1000, 3),
  ('grove-park', 'Grove Park', 33.787, -84.457, 1500, 3),
  ('collier-hills', 'Collier Hills', 33.810, -84.410, 1500, 3),
  ('brookwood-hills', 'Brookwood Hills', 33.808, -84.390, 1000, 3),
  ('adair-park', 'Adair Park', 33.728, -84.413, 1000, 3),
  ('capitol-view', 'Capitol View', 33.712, -84.413, 1200, 3),
  ('peoplestown', 'Peoplestown', 33.723, -84.387, 1000, 3)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  radius = EXCLUDED.radius,
  tier = EXCLUDED.tier;
