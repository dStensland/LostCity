-- Lost City Database Schema
-- Run this in Supabase SQL Editor to set up the database

-- Sources table: tracks where we crawl events from
CREATE TABLE sources (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  source_type TEXT NOT NULL,
  integration_method TEXT,
  crawl_frequency TEXT DEFAULT 'daily',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Venues table: normalized venue information
CREATE TABLE venues (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  address TEXT,
  neighborhood TEXT,
  city TEXT DEFAULT 'Atlanta',
  state TEXT DEFAULT 'GA',
  zip TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  venue_type TEXT,
  location_designator TEXT NOT NULL DEFAULT 'standard',
  website TEXT,
  menu_url TEXT,
  reservation_url TEXT,
  service_style TEXT CHECK (service_style IN ('quick_service', 'casual_dine_in', 'full_service', 'tasting_menu', 'bar_food', 'coffee_dessert')),
  meal_duration_min_minutes INTEGER CHECK (meal_duration_min_minutes BETWEEN 15 AND 360),
  meal_duration_max_minutes INTEGER CHECK (meal_duration_max_minutes BETWEEN 15 AND 480),
  walk_in_wait_minutes INTEGER CHECK (walk_in_wait_minutes BETWEEN 0 AND 240),
  payment_buffer_minutes INTEGER CHECK (payment_buffer_minutes BETWEEN 0 AND 60),
  accepts_reservations BOOLEAN,
  reservation_recommended BOOLEAN,
  planning_notes TEXT,
  planning_last_verified_at TIMESTAMPTZ,
  CONSTRAINT venues_meal_duration_order_check CHECK (
    meal_duration_min_minutes IS NULL
    OR meal_duration_max_minutes IS NULL
    OR meal_duration_min_minutes <= meal_duration_max_minutes
  ),
  aliases TEXT[],
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Venue specials: time-sensitive offerings (happy hours, daily specials, recurring deals)
CREATE TABLE venue_specials (
  id SERIAL PRIMARY KEY,
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  days_of_week INTEGER[],
  time_start TIME,
  time_end TIME,
  start_date DATE,
  end_date DATE,
  image_url TEXT,
  price_note TEXT,
  confidence TEXT DEFAULT 'medium',
  source_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_venue_specials_venue ON venue_specials(venue_id);
CREATE INDEX idx_venue_specials_type ON venue_specials(type);
CREATE INDEX idx_venue_specials_active ON venue_specials(is_active) WHERE is_active = true;

-- Events table: the core event data
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  source_id INTEGER REFERENCES sources(id),
  venue_id INTEGER REFERENCES venues(id),
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  start_time TIME,
  doors_time TIME,
  end_date DATE,
  end_time TIME,
  is_all_day BOOLEAN DEFAULT false,
  content_kind TEXT NOT NULL DEFAULT 'event' CHECK (content_kind IN ('event', 'exhibit', 'special')),
  category TEXT,
  subcategory TEXT,
  tags TEXT[],
  price_min DECIMAL(10, 2),
  price_max DECIMAL(10, 2),
  price_note TEXT,
  age_policy TEXT,
  age_min INT,
  age_max INT,
  ticket_status TEXT,
  reentry_policy TEXT,
  set_times_mentioned BOOLEAN DEFAULT false,
  is_free BOOLEAN DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  source_url TEXT NOT NULL,
  ticket_url TEXT,
  image_url TEXT,
  film_title TEXT,
  film_release_year INTEGER,
  film_imdb_id TEXT,
  film_external_genres TEXT[],
  film_identity_source TEXT,
  raw_text TEXT,
  extraction_confidence DECIMAL(3, 2),
  field_provenance JSONB,
  field_confidence JSONB,
  extraction_version TEXT,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  content_hash TEXT,
  canonical_event_id INTEGER REFERENCES events(id),
  festival_id TEXT REFERENCES festivals(id) ON DELETE SET NULL,
  is_tentpole BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Artists linked to events (headliners/supporting acts)
CREATE TABLE event_artists (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  billing_order INTEGER,
  is_headliner BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Images linked to events
CREATE TABLE event_images (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  type TEXT,
  source TEXT,
  confidence DECIMAL(3, 2),
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Links linked to events (ticketing, organizer, etc.)
CREATE TABLE event_links (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT,
  confidence DECIMAL(3, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crawl logs: track crawler runs for monitoring
CREATE TABLE crawl_logs (
  id SERIAL PRIMARY KEY,
  source_id INTEGER REFERENCES sources(id),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT,
  events_found INTEGER DEFAULT 0,
  events_new INTEGER DEFAULT 0,
  events_updated INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_events_start_date ON events(start_date);
CREATE INDEX idx_events_category ON events(category);
CREATE INDEX idx_events_content_kind ON events(content_kind);
CREATE INDEX idx_events_venue_id ON events(venue_id);
CREATE INDEX idx_events_content_hash ON events(content_hash);
CREATE INDEX idx_events_source_id ON events(source_id);
CREATE INDEX idx_events_is_active ON events(is_active);
CREATE INDEX idx_events_active_start_date ON events(start_date) WHERE is_active = true;
CREATE INDEX idx_events_spot_counts_portal_start_venue
ON events(portal_id, start_date, venue_id)
WHERE venue_id IS NOT NULL
  AND is_active = true
  AND canonical_event_id IS NULL
  AND COALESCE(is_sensitive, false) = false
  AND (is_feed_ready IS NULL OR is_feed_ready = true);
CREATE INDEX idx_event_artists_event_id ON event_artists(event_id);
CREATE INDEX idx_event_artists_name ON event_artists(name);
CREATE UNIQUE INDEX idx_event_artists_event_name ON event_artists(event_id, name);
CREATE INDEX idx_event_images_event_id ON event_images(event_id);
CREATE UNIQUE INDEX idx_event_images_event_url ON event_images(event_id, url);
CREATE INDEX idx_event_links_event_id ON event_links(event_id);
CREATE INDEX idx_event_links_type ON event_links(type);
CREATE UNIQUE INDEX idx_event_links_event_type_url ON event_links(event_id, type, url);
CREATE INDEX idx_crawl_logs_source_id ON crawl_logs(source_id);
CREATE INDEX idx_crawl_logs_started_at ON crawl_logs(started_at);
CREATE INDEX idx_venues_city_id_for_spots ON venues(city, id);

-- Aggregate upcoming event counts by venue for spots/find discovery.
CREATE OR REPLACE FUNCTION get_spot_event_counts(
  p_start_date DATE,
  p_end_date DATE,
  p_portal_id UUID DEFAULT NULL,
  p_city_names TEXT[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 480
)
RETURNS TABLE(
  venue_id INTEGER,
  event_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    e.venue_id,
    COUNT(*)::BIGINT AS event_count
  FROM events e
  JOIN venues v ON v.id = e.venue_id
  WHERE e.venue_id IS NOT NULL
    AND e.start_date >= p_start_date
    AND e.start_date <= p_end_date
    AND e.is_active = true
    AND e.canonical_event_id IS NULL
    AND (e.is_sensitive IS NULL OR e.is_sensitive = false)
    AND (e.is_feed_ready IS NULL OR e.is_feed_ready = true)
    AND (
      (p_portal_id IS NOT NULL AND e.portal_id = p_portal_id)
      OR (p_portal_id IS NULL AND e.portal_id IS NULL)
    )
    AND (
      p_city_names IS NULL
      OR array_length(p_city_names, 1) IS NULL
      OR v.city = ANY(p_city_names)
    )
  GROUP BY e.venue_id
  ORDER BY event_count DESC, e.venue_id ASC
  LIMIT GREATEST(COALESCE(p_limit, 480), 1);
$$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at on events
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Session-aware engagement model (festival sessions + calendar intent)
ALTER TABLE IF EXISTS event_rsvps
  ADD COLUMN IF NOT EXISTS engagement_target TEXT NOT NULL DEFAULT 'event',
  ADD COLUMN IF NOT EXISTS festival_id TEXT REFERENCES festivals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES series(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL
    AND to_regclass('public.events') IS NOT NULL
    AND to_regclass('public.festivals') IS NOT NULL
    AND to_regclass('public.series') IS NOT NULL
    AND to_regclass('public.portals') IS NOT NULL THEN
    CREATE TABLE IF NOT EXISTS event_calendar_saves (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      provider TEXT NOT NULL CHECK (provider IN ('google', 'outlook', 'ics')),
      engagement_target TEXT NOT NULL DEFAULT 'event' CHECK (engagement_target IN ('event', 'festival_session')),
      festival_id TEXT REFERENCES festivals(id) ON DELETE SET NULL,
      program_id UUID REFERENCES series(id) ON DELETE SET NULL,
      portal_id UUID REFERENCES portals(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (user_id, event_id, provider)
    );
  END IF;
END $$;

-- Insert initial sources
INSERT INTO sources (name, slug, url, source_type) VALUES
  ('Eventbrite', 'eventbrite', 'https://api.eventbrite.com', 'api'),
  ('Meetup', 'meetup', 'https://api.meetup.com', 'api'),
  ('Terminal West', 'terminal-west', 'https://terminalwestatl.com/events', 'scrape'),
  ('The Earl', 'the-earl', 'https://badearl.com/events', 'scrape'),
  ('Variety Playhouse', 'variety-playhouse', 'https://varietyplayhouse.com', 'scrape'),
  ('Dad''s Garage', 'dads-garage', 'https://dadsgarage.com/shows', 'scrape'),
  ('High Museum', 'high-museum', 'https://high.org/events', 'scrape'),
  ('Atlanta Botanical Garden', 'atlanta-botanical-garden', 'https://atlantabg.org/events', 'scrape'),
  ('Creative Loafing', 'creative-loafing', 'https://creativeloafing.com/events', 'scrape'),
  ('Do404', 'do404', 'https://do404.com', 'scrape');

-- Interest channels: portal-scoped semantic subscription primitives
CREATE TABLE IF NOT EXISTS interest_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID REFERENCES portals(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  channel_type TEXT NOT NULL CHECK (channel_type IN (
    'jurisdiction',
    'institution',
    'topic',
    'community',
    'intent',
    'cause'
  )),
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_interest_channels_global_slug
  ON interest_channels(slug)
  WHERE portal_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_interest_channels_portal_slug
  ON interest_channels(portal_id, slug)
  WHERE portal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_interest_channels_portal_active
  ON interest_channels(portal_id, is_active, sort_order);

CREATE TABLE IF NOT EXISTS interest_channel_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES interest_channels(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN (
    'source',
    'organization',
    'venue',
    'category',
    'tag',
    'geo',
    'expression'
  )),
  rule_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  priority INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interest_channel_rules_channel_active_priority
  ON interest_channel_rules(channel_id, is_active, priority);

CREATE TABLE IF NOT EXISTS user_channel_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES interest_channels(id) ON DELETE CASCADE,
  portal_id UUID REFERENCES portals(id) ON DELETE SET NULL,
  delivery_mode TEXT NOT NULL DEFAULT 'feed_only' CHECK (delivery_mode IN ('feed_only', 'instant', 'digest')),
  digest_frequency TEXT CHECK (digest_frequency IN ('daily', 'weekly')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, channel_id),
  CHECK (delivery_mode <> 'digest' OR digest_frequency IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_user_channel_subscriptions_user_portal
  ON user_channel_subscriptions(user_id, portal_id);

CREATE INDEX IF NOT EXISTS idx_user_channel_subscriptions_channel
  ON user_channel_subscriptions(channel_id);

CREATE TABLE IF NOT EXISTS event_channel_matches (
  portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES interest_channels(id) ON DELETE CASCADE,
  matched_rule_types TEXT[] NOT NULL DEFAULT '{}'::text[],
  match_reasons JSONB NOT NULL DEFAULT '{}'::jsonb,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (portal_id, event_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_event_channel_matches_portal_channel_time
  ON event_channel_matches(portal_id, channel_id, matched_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_channel_matches_portal_event
  ON event_channel_matches(portal_id, event_id);

CREATE INDEX IF NOT EXISTS idx_event_channel_matches_channel_event
  ON event_channel_matches(channel_id, event_id);

-- Structured volunteer opportunities: supports both event-backed shifts and
-- ongoing roles that do not have a single dated event row.
CREATE TABLE IF NOT EXISTS volunteer_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  portal_id UUID REFERENCES portals(id) ON DELETE SET NULL,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  description TEXT,
  commitment_level TEXT NOT NULL CHECK (commitment_level IN ('drop_in', 'ongoing', 'lead_role')),
  time_horizon TEXT CHECK (time_horizon IN ('one_day', 'multi_week', 'multi_month', 'ongoing')),
  onboarding_level TEXT CHECK (onboarding_level IN ('none', 'light', 'screening_required', 'training_required')),
  schedule_summary TEXT,
  location_summary TEXT,
  skills_required TEXT[] NOT NULL DEFAULT '{}'::text[],
  language_support TEXT[] NOT NULL DEFAULT '{}'::text[],
  physical_demand TEXT CHECK (physical_demand IN ('low', 'medium', 'high')),
  min_age INTEGER,
  family_friendly BOOLEAN NOT NULL DEFAULT FALSE,
  group_friendly BOOLEAN NOT NULL DEFAULT FALSE,
  remote_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  accessibility_notes TEXT,
  background_check_required BOOLEAN NOT NULL DEFAULT FALSE,
  training_required BOOLEAN NOT NULL DEFAULT FALSE,
  capacity_total INTEGER,
  capacity_remaining INTEGER,
  urgency_level TEXT NOT NULL DEFAULT 'normal' CHECK (urgency_level IN ('normal', 'urgent')),
  starts_on DATE,
  ends_on DATE,
  application_url TEXT NOT NULL,
  source_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT volunteer_opportunities_date_order_check CHECK (
    starts_on IS NULL OR ends_on IS NULL OR starts_on <= ends_on
  ),
  CONSTRAINT volunteer_opportunities_capacity_check CHECK (
    capacity_total IS NULL OR capacity_total >= 0
  ),
  CONSTRAINT volunteer_opportunities_capacity_remaining_check CHECK (
    capacity_remaining IS NULL OR capacity_remaining >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_volunteer_opportunities_org_active
  ON volunteer_opportunities(organization_id, is_active, commitment_level, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_volunteer_opportunities_source_active
  ON volunteer_opportunities(source_id, is_active, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_volunteer_opportunities_portal_active
  ON volunteer_opportunities(portal_id, is_active, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_volunteer_opportunities_event
  ON volunteer_opportunities(event_id)
  WHERE event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_volunteer_profile (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  causes TEXT[] NOT NULL DEFAULT '{}'::text[],
  skills TEXT[] NOT NULL DEFAULT '{}'::text[],
  availability_windows JSONB NOT NULL DEFAULT '[]'::jsonb,
  travel_radius_km INTEGER,
  mobility_constraints TEXT,
  languages TEXT[] NOT NULL DEFAULT '{}'::text[],
  commitment_preference TEXT CHECK (commitment_preference IN ('drop_in', 'ongoing', 'lead_role', 'mixed')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS volunteer_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES volunteer_opportunities(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  portal_id UUID REFERENCES portals(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('interested', 'committed', 'attended', 'cancelled', 'no_show')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, opportunity_id)
);

CREATE INDEX IF NOT EXISTS idx_volunteer_engagements_user_status
  ON volunteer_engagements(user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_volunteer_engagements_opportunity
  ON volunteer_engagements(opportunity_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_volunteer_engagements_portal
  ON volunteer_engagements(portal_id, updated_at DESC)
  WHERE portal_id IS NOT NULL;

CREATE TRIGGER update_volunteer_opportunities_updated_at
  BEFORE UPDATE ON volunteer_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_volunteer_engagements_updated_at
  BEFORE UPDATE ON volunteer_engagements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_volunteer_profile_updated_at
  BEFORE UPDATE ON user_volunteer_profile
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE volunteer_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_volunteer_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_engagements ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- Venue inventory snapshots
-- -------------------------------------------------------
-- Provider-backed availability and price snapshots keyed to a venue.
-- This is generic platform substrate for destination/accommodation inventory,
-- not Yonder-specific schema.

CREATE TABLE IF NOT EXISTS venue_inventory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  inventory_scope TEXT NOT NULL DEFAULT 'overnight' CHECK (
    inventory_scope IN ('overnight', 'day_use', 'package')
  ),
  arrival_date DATE NOT NULL,
  nights INTEGER NOT NULL CHECK (nights > 0 AND nights <= 30),
  captured_for_date DATE NOT NULL DEFAULT CURRENT_DATE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_label TEXT,
  total_results INTEGER,
  source_url TEXT,
  records JSONB NOT NULL DEFAULT '[]'::jsonb,
  sample_sites JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT venue_inventory_snapshots_total_results_check CHECK (
    total_results IS NULL OR total_results >= 0
  ),
  CONSTRAINT venue_inventory_snapshots_capture_key UNIQUE (
    venue_id,
    provider_id,
    inventory_scope,
    arrival_date,
    nights,
    captured_for_date
  )
);

CREATE INDEX IF NOT EXISTS idx_venue_inventory_snapshots_lookup
  ON venue_inventory_snapshots(venue_id, provider_id, inventory_scope, arrival_date, nights, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_venue_inventory_snapshots_captured_for_date
  ON venue_inventory_snapshots(captured_for_date, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_venue_inventory_snapshots_current_lookup
  ON venue_inventory_snapshots(
    venue_id,
    provider_id,
    inventory_scope,
    arrival_date,
    nights,
    captured_for_date DESC,
    captured_at DESC
  );

CREATE OR REPLACE VIEW current_venue_inventory_snapshots AS
SELECT DISTINCT ON (
  venue_id,
  provider_id,
  inventory_scope,
  arrival_date,
  nights
)
  id,
  venue_id,
  provider_id,
  inventory_scope,
  arrival_date,
  nights,
  captured_for_date,
  captured_at,
  window_label,
  total_results,
  source_url,
  records,
  sample_sites,
  metadata,
  created_at,
  updated_at
FROM venue_inventory_snapshots
ORDER BY
  venue_id,
  provider_id,
  inventory_scope,
  arrival_date,
  nights,
  captured_for_date DESC,
  captured_at DESC,
  created_at DESC;

CREATE TRIGGER update_venue_inventory_snapshots_updated_at
  BEFORE UPDATE ON venue_inventory_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE venue_inventory_snapshots ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- Programs (Hooky family portal — migration 307)
-- -------------------------------------------------------
-- Structured enrollment-based activities: camps, enrichment classes,
-- recreational leagues, clubs.

CREATE TABLE IF NOT EXISTS programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID REFERENCES portals(id) ON DELETE SET NULL,
  source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  venue_id INTEGER REFERENCES venues(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  program_type TEXT NOT NULL CHECK (
    program_type IN ('camp', 'enrichment', 'league', 'club', 'class', 'rec_program')
  ),
  provider_name TEXT,
  age_min INT,
  age_max INT,
  season TEXT CHECK (season IN ('summer', 'fall', 'spring', 'winter', 'year_round')),
  session_start DATE,
  session_end DATE,
  schedule_days INT[],
  schedule_start_time TIME,
  schedule_end_time TIME,
  cost_amount NUMERIC,
  cost_period TEXT CHECK (cost_period IN ('per_session', 'per_week', 'per_month', 'per_season')),
  cost_notes TEXT,
  registration_status TEXT NOT NULL DEFAULT 'unknown' CHECK (
    registration_status IN ('open', 'waitlist', 'closed', 'walk_in', 'sold_out', 'upcoming', 'unknown')
  ),
  registration_opens DATE,
  registration_closes DATE,
  registration_url TEXT,
  last_status_check_at TIMESTAMPTZ,
  before_after_care BOOLEAN NOT NULL DEFAULT false,
  lunch_included BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[],
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT programs_age_range_check CHECK (
    age_min IS NULL OR age_max IS NULL OR age_min <= age_max
  ),
  CONSTRAINT programs_session_order_check CHECK (
    session_start IS NULL OR session_end IS NULL OR session_start <= session_end
  ),
  CONSTRAINT programs_registration_window_check CHECK (
    registration_opens IS NULL OR registration_closes IS NULL OR registration_opens <= registration_closes
  )
);

CREATE INDEX IF NOT EXISTS idx_programs_portal_id ON programs(portal_id) WHERE portal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_programs_program_type ON programs(program_type, status);
CREATE INDEX IF NOT EXISTS idx_programs_registration_status ON programs(registration_status, status);
CREATE INDEX IF NOT EXISTS idx_programs_age_range ON programs(age_min, age_max) WHERE age_min IS NOT NULL OR age_max IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_programs_season ON programs(season, status) WHERE season IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_programs_status ON programs(status, updated_at DESC);

CREATE TRIGGER update_programs_updated_at
  BEFORE UPDATE ON programs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- Event Extractions (migration 497) — extraction metadata
-- separated from events table for performance
-- -------------------------------------------------------

CREATE TABLE IF NOT EXISTS event_extractions (
  event_id INTEGER PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  raw_text TEXT,
  extraction_confidence DECIMAL(3, 2),
  field_provenance JSONB,
  field_confidence JSONB,
  extraction_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- Exhibitions (Arts portal entity)
-- -------------------------------------------------------

CREATE TABLE IF NOT EXISTS exhibitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  portal_id UUID REFERENCES portals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  opening_date DATE,
  closing_date DATE,
  medium TEXT,
  exhibition_type TEXT CHECK (exhibition_type IN ('solo','group','installation','retrospective','popup','permanent')),
  admission_type TEXT CHECK (admission_type IN ('free','ticketed','donation','suggested')),
  admission_url TEXT,
  source_url TEXT,
  tags TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exhibitions_date_order CHECK (opening_date IS NULL OR closing_date IS NULL OR opening_date <= closing_date)
);

CREATE INDEX IF NOT EXISTS idx_exhibitions_venue ON exhibitions(venue_id, is_active);
CREATE INDEX IF NOT EXISTS idx_exhibitions_portal ON exhibitions(portal_id, is_active) WHERE portal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exhibitions_source ON exhibitions(source_id) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exhibitions_dates ON exhibitions(opening_date, closing_date) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS exhibition_artists (
  exhibition_id UUID NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  artist_name TEXT NOT NULL,
  artist_url TEXT,
  role TEXT DEFAULT 'artist' CHECK (role IN ('artist','curator','collaborator')),
  PRIMARY KEY (exhibition_id, artist_name)
);

CREATE TRIGGER update_exhibitions_updated_at
  BEFORE UPDATE ON exhibitions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE exhibitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exhibition_artists ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- Open Calls (Arts portal — deadline-driven opportunities)
-- -------------------------------------------------------

CREATE TABLE IF NOT EXISTS open_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  venue_id INTEGER REFERENCES venues(id) ON DELETE SET NULL,
  source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  portal_id UUID REFERENCES portals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  deadline DATE,
  application_url TEXT NOT NULL,
  fee NUMERIC,
  eligibility TEXT,
  medium_requirements TEXT[],
  call_type TEXT NOT NULL CHECK (call_type IN ('submission','residency','grant','commission','exhibition_proposal')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','reviewing','awarded')),
  source_url TEXT,
  tags TEXT[],
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_open_calls_deadline ON open_calls(deadline) WHERE is_active = true AND status = 'open';
CREATE INDEX IF NOT EXISTS idx_open_calls_portal ON open_calls(portal_id, is_active) WHERE portal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_open_calls_venue ON open_calls(venue_id) WHERE venue_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_open_calls_org ON open_calls(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_open_calls_type ON open_calls(call_type, status) WHERE is_active = true;

CREATE TRIGGER update_open_calls_updated_at
  BEFORE UPDATE ON open_calls
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE open_calls ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- Venue Destination Details (Adventure portal extension)
-- -------------------------------------------------------

CREATE TABLE IF NOT EXISTS venue_destination_details (
  venue_id INTEGER PRIMARY KEY REFERENCES venues(id) ON DELETE CASCADE,
  commitment_level TEXT CHECK (commitment_level IN ('hour','halfday','fullday','weekend')),
  difficulty TEXT CHECK (difficulty IN ('easy','moderate','challenging','expert')),
  trail_length_miles NUMERIC,
  conditions_notes TEXT,
  accessibility_notes TEXT,
  parking_type TEXT CHECK (parking_type IN ('free_lot','paid_lot','street','garage','none')),
  parking_capacity INTEGER,
  seasonal_availability TEXT[],
  best_time_of_day TEXT CHECK (best_time_of_day IN ('morning','afternoon','evening','any')),
  dog_friendly BOOLEAN,
  kid_friendly BOOLEAN,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_venue_destination_details_updated_at
  BEFORE UPDATE ON venue_destination_details
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -------------------------------------------------------
-- Search term corpus (migration 486)
-- -------------------------------------------------------
-- Canonical display terms plus alias-aware match terms used to build the
-- autocomplete corpus from crawled entities.

CREATE OR REPLACE FUNCTION normalize_search_term(p_input TEXT)
RETURNS TEXT AS $$
  SELECT NULLIF(
    regexp_replace(lower(trim(COALESCE(p_input, ''))), '\s+', ' ', 'g'),
    ''
  );
$$ LANGUAGE sql IMMUTABLE;

CREATE TABLE IF NOT EXISTS entity_search_terms (
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  suggestion_type TEXT NOT NULL CHECK (
    suggestion_type IN (
      'event',
      'venue',
      'organizer',
      'category',
      'tag',
      'vibe',
      'festival',
      'neighborhood'
    )
  ),
  term_type TEXT NOT NULL CHECK (
    term_type IN (
      'primary',
      'alias',
      'artist',
      'provider',
      'venue',
      'category',
      'tag',
      'vibe',
      'neighborhood'
    )
  ),
  display_term TEXT NOT NULL,
  match_term TEXT NOT NULL,
  city TEXT,
  weight INTEGER NOT NULL DEFAULT 1 CHECK (weight >= 1),
  source TEXT NOT NULL DEFAULT 'generated',
  confidence NUMERIC(3, 2) NOT NULL DEFAULT 1.00 CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_type, entity_id, suggestion_type, term_type, match_term)
);

CREATE INDEX IF NOT EXISTS idx_entity_search_terms_match_term
  ON entity_search_terms(match_term);

CREATE INDEX IF NOT EXISTS idx_entity_search_terms_city_type
  ON entity_search_terms(city, suggestion_type);

CREATE INDEX IF NOT EXISTS idx_entity_search_terms_display_term
  ON entity_search_terms(display_term);

CREATE TRIGGER update_entity_search_terms_updated_at
  BEFORE UPDATE ON entity_search_terms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS search_term_overrides (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  suggestion_type TEXT NOT NULL CHECK (
    suggestion_type IN (
      'event',
      'venue',
      'organizer',
      'category',
      'tag',
      'vibe',
      'festival',
      'neighborhood'
    )
  ),
  term_type TEXT NOT NULL DEFAULT 'alias' CHECK (
    term_type IN ('alias', 'abbreviation', 'nickname', 'synonym')
  ),
  display_term TEXT NOT NULL,
  match_term TEXT NOT NULL,
  city TEXT,
  weight INTEGER NOT NULL DEFAULT 2 CHECK (weight >= 1),
  confidence NUMERIC(3, 2) NOT NULL DEFAULT 1.00 CHECK (confidence >= 0 AND confidence <= 1),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, suggestion_type, match_term)
);

CREATE INDEX IF NOT EXISTS idx_search_term_overrides_match_term
  ON search_term_overrides(match_term)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_search_term_overrides_city_type
  ON search_term_overrides(city, suggestion_type)
  WHERE is_active = TRUE;

CREATE TRIGGER update_search_term_overrides_updated_at
  BEFORE UPDATE ON search_term_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -------------------------------------------------------
-- Search term incremental refresh + generated aliases (migration 490)
-- -------------------------------------------------------

CREATE OR REPLACE FUNCTION search_term_alias_candidates(
  p_display_term TEXT,
  p_slug TEXT DEFAULT NULL
)
RETURNS TEXT[] AS $$
  WITH normalized_base AS (
    SELECT normalize_search_term(p_display_term) AS base_term
  ),
  raw_candidates AS (
    SELECT normalize_search_term(candidate) AS candidate
    FROM unnest(
      ARRAY[
        regexp_replace(COALESCE(p_display_term, ''), '\s*\([^)]*\)\s*', ' ', 'g'),
        regexp_replace(COALESCE(p_display_term, ''), '^\s*the\s+', '', 'i'),
        regexp_replace(
          COALESCE(p_display_term, ''),
          '\s+(fine arts center|performing arts center|arts center|art center|community center|cultural center|event center|music hall|theatre|theater|playhouse|museum|gallery|studios?|hall|association|foundation|society|collective|project|initiative|coalition|alliance|committee|council|inc|llc)\s*$',
          '',
          'i'
        ),
        replace(COALESCE(p_slug, ''), '-', ' ')
      ]
    ) AS raw(candidate)
  )
  SELECT COALESCE(
    array_agg(DISTINCT rc.candidate) FILTER (
      WHERE rc.candidate IS NOT NULL
        AND char_length(rc.candidate) >= 4
        AND rc.candidate <> nb.base_term
    ),
    ARRAY[]::TEXT[]
  )
  FROM raw_candidates rc
  CROSS JOIN normalized_base nb;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION venue_search_term_weight(
  p_has_active_children BOOLEAN,
  p_parent_venue_id BIGINT DEFAULT NULL,
  p_featured BOOLEAN DEFAULT FALSE,
  p_explore_featured BOOLEAN DEFAULT FALSE,
  p_data_quality SMALLINT DEFAULT NULL
)
RETURNS INTEGER AS $$
  SELECT
    (CASE
      WHEN p_has_active_children THEN 4
      WHEN p_parent_venue_id IS NOT NULL THEN 2
      ELSE 1
    END)
    + (CASE
      WHEN COALESCE(p_explore_featured, FALSE) THEN 6
      WHEN COALESCE(p_featured, FALSE) THEN 3
      ELSE 0
    END)
    + (CASE
      WHEN COALESCE(p_data_quality, 0) >= 90 THEN 4
      WHEN COALESCE(p_data_quality, 0) >= 85 THEN 3
      WHEN COALESCE(p_data_quality, 0) >= 80 THEN 2
      WHEN COALESCE(p_data_quality, 0) >= 75 THEN 1
      ELSE 0
    END);
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION venue_generic_search_term_candidates(
  p_display_term TEXT
)
RETURNS TEXT[] AS $$
  WITH normalized_name AS (
    SELECT normalize_search_term(p_display_term) AS base_term
  )
  SELECT COALESCE(
    array_agg(DISTINCT candidate) FILTER (
      WHERE candidate IS NOT NULL
        AND candidate <> normalized_name.base_term
    ),
    ARRAY[]::TEXT[]
  )
  FROM normalized_name
  CROSS JOIN LATERAL (
    VALUES
      (CASE WHEN normalized_name.base_term ~ '\mmuseum(s)?\M' THEN 'museum' END),
      (CASE WHEN normalized_name.base_term ~ '\mgarden(s)?\M' THEN 'garden' END),
      (CASE WHEN normalized_name.base_term ~ '\mpark\M' THEN 'park' END),
      (CASE WHEN normalized_name.base_term ~ '\mmarket\M' THEN 'market' END),
      (CASE WHEN normalized_name.base_term ~ '\mplayhouse\M' THEN 'playhouse' END),
      (CASE WHEN normalized_name.base_term ~ '\mtheat(er|re)\M' THEN 'theater' END),
      (CASE WHEN normalized_name.base_term ~ '\mtheat(er|re)\M' THEN 'theatre' END),
      (CASE WHEN normalized_name.base_term ~ '\mamphitheat(er|re)\M' THEN 'amphitheater' END),
      (CASE WHEN normalized_name.base_term ~ '\mamphitheat(er|re)\M' THEN 'amphitheatre' END),
      (CASE WHEN normalized_name.base_term ~ '\mhall\M' THEN 'hall' END),
      (CASE WHEN normalized_name.base_term ~ '\msquare\M' THEN 'square' END),
      (CASE WHEN normalized_name.base_term ~ '\mplaza\M' THEN 'plaza' END),
      (CASE WHEN normalized_name.base_term ~ '\mtrail\M' THEN 'trail' END),
      (CASE WHEN normalized_name.base_term ~ '\marboretum\M' THEN 'arboretum' END),
      (CASE WHEN normalized_name.base_term ~ '\mzoo\M' THEN 'zoo' END),
      (CASE WHEN normalized_name.base_term ~ '\maquarium\M' THEN 'aquarium' END),
      (CASE WHEN normalized_name.base_term ~ '\mstadium\M' THEN 'stadium' END)
  ) AS candidates(candidate);
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION rebuild_entity_search_terms_scoped(
  p_city TEXT DEFAULT NULL,
  p_since TIMESTAMPTZ DEFAULT NULL,
  p_full BOOLEAN DEFAULT FALSE
)
RETURNS void AS $$
DECLARE
  v_metro_cities TEXT[];
  v_effective_since TIMESTAMPTZ;
BEGIN
  v_metro_cities := get_metro_cities(p_city);
  v_effective_since := CASE
    WHEN p_full THEN NULL
    ELSE COALESCE(p_since, now() - INTERVAL '6 hours')
  END;

  IF p_full THEN
    TRUNCATE TABLE entity_search_terms;
  ELSE
    DELETE FROM entity_search_terms est
    WHERE est.entity_type IN ('category', 'tag', 'vibe', 'neighborhood')
      OR (
        est.entity_type = 'event'
        AND EXISTS (
          SELECT 1
          FROM events e
          LEFT JOIN venues v ON v.id = e.venue_id
          WHERE e.id::TEXT = est.entity_id
            AND e.updated_at >= v_effective_since
            AND (v_metro_cities IS NULL OR v.city IS NULL OR v.city = ANY(v_metro_cities))
        )
      )
      OR (
        est.entity_type = 'venue'
        AND EXISTS (
          SELECT 1
          FROM venues v
          WHERE v.id::TEXT = est.entity_id
            AND COALESCE(
              (to_jsonb(v) ->> 'updated_at')::timestamptz,
              v.hours_updated_at,
              v.last_verified_at,
              v.created_at
            ) >= v_effective_since
            AND (v_metro_cities IS NULL OR v.city IS NULL OR v.city = ANY(v_metro_cities))
        )
      )
      OR (
        est.entity_type = 'organizer'
        AND EXISTS (
          SELECT 1
          FROM organizations o
          WHERE o.id::TEXT = est.entity_id
            AND o.updated_at >= v_effective_since
            AND (v_metro_cities IS NULL OR o.city IS NULL OR o.city = ANY(v_metro_cities))
        )
      )
      OR (
        est.entity_type = 'program'
        AND EXISTS (
          SELECT 1
          FROM programs p
          LEFT JOIN venues v ON v.id = p.venue_id
          WHERE p.id::TEXT = est.entity_id
            AND p.updated_at >= v_effective_since
            AND (v_metro_cities IS NULL OR v.city IS NULL OR v.city = ANY(v_metro_cities))
        )
      )
      OR (
        est.entity_type = 'festival'
        AND EXISTS (
          SELECT 1
          FROM festivals f
          WHERE f.id = est.entity_id
            AND f.updated_at >= v_effective_since
        )
      );
  END IF;

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'event', e.id::TEXT, 'event', 'primary', e.title, normalize_search_term(e.title), v.city, 1, 'events.title'
  FROM events e
  LEFT JOIN venues v ON v.id = e.venue_id
  WHERE e.start_date >= CURRENT_DATE
    AND COALESCE(e.is_active, TRUE) = TRUE
    AND e.canonical_event_id IS NULL
    AND normalize_search_term(e.title) IS NOT NULL
    AND (p_full OR e.updated_at >= v_effective_since)
    AND (v_metro_cities IS NULL OR v.city IS NULL OR v.city = ANY(v_metro_cities));

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'event', e.id::TEXT, 'event', 'artist', e.title, normalize_search_term(ea.name), v.city, 1, 'event_artists.name'
  FROM events e
  JOIN event_artists ea ON ea.event_id = e.id
  LEFT JOIN venues v ON v.id = e.venue_id
  WHERE e.start_date >= CURRENT_DATE
    AND COALESCE(e.is_active, TRUE) = TRUE
    AND e.canonical_event_id IS NULL
    AND normalize_search_term(e.title) IS NOT NULL
    AND normalize_search_term(ea.name) IS NOT NULL
    AND normalize_search_term(ea.name) <> normalize_search_term(e.title)
    AND (p_full OR e.updated_at >= v_effective_since)
    AND (v_metro_cities IS NULL OR v.city IS NULL OR v.city = ANY(v_metro_cities))
  ON CONFLICT DO NOTHING;

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'venue', v.id::TEXT, 'venue', 'primary', v.name, normalize_search_term(v.name), v.city,
    venue_search_term_weight(
      EXISTS (
        SELECT 1
        FROM venues child
        WHERE child.parent_venue_id = v.id
          AND COALESCE(child.active, TRUE) = TRUE
      ),
      v.parent_venue_id,
      COALESCE(v.featured, FALSE),
      COALESCE(v.explore_featured, FALSE),
      v.data_quality
    ),
    'venues.name'
  FROM venues v
  WHERE COALESCE(v.active, TRUE) = TRUE
    AND normalize_search_term(v.name) IS NOT NULL
    AND (p_full OR COALESCE(
      (to_jsonb(v) ->> 'updated_at')::timestamptz,
      v.hours_updated_at,
      v.last_verified_at,
      v.created_at
    ) >= v_effective_since)
    AND (v_metro_cities IS NULL OR v.city IS NULL OR v.city = ANY(v_metro_cities));

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'venue', v.id::TEXT, 'venue', 'alias', v.name, normalize_search_term(alias.term), v.city,
    venue_search_term_weight(
      EXISTS (
        SELECT 1
        FROM venues child
        WHERE child.parent_venue_id = v.id
          AND COALESCE(child.active, TRUE) = TRUE
      ),
      v.parent_venue_id,
      COALESCE(v.featured, FALSE),
      COALESCE(v.explore_featured, FALSE),
      v.data_quality
    ),
    'venues.aliases'
  FROM venues v
  CROSS JOIN LATERAL unnest(COALESCE(v.aliases, '{}'::TEXT[])) AS alias(term)
  WHERE COALESCE(v.active, TRUE) = TRUE
    AND normalize_search_term(v.name) IS NOT NULL
    AND normalize_search_term(alias.term) IS NOT NULL
    AND normalize_search_term(alias.term) <> normalize_search_term(v.name)
    AND (p_full OR COALESCE(
      (to_jsonb(v) ->> 'updated_at')::timestamptz,
      v.hours_updated_at,
      v.last_verified_at,
      v.created_at
    ) >= v_effective_since)
    AND (v_metro_cities IS NULL OR v.city IS NULL OR v.city = ANY(v_metro_cities))
  ON CONFLICT DO NOTHING;

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'venue', v.id::TEXT, 'venue', 'alias', v.name, alias.term, v.city,
    venue_search_term_weight(
      EXISTS (
        SELECT 1
        FROM venues child
        WHERE child.parent_venue_id = v.id
          AND COALESCE(child.active, TRUE) = TRUE
      ),
      v.parent_venue_id,
      COALESCE(v.featured, FALSE),
      COALESCE(v.explore_featured, FALSE),
      v.data_quality
    ),
    'venues.generated_aliases'
  FROM venues v
  CROSS JOIN LATERAL unnest(search_term_alias_candidates(v.name, v.slug)) AS alias(term)
  WHERE COALESCE(v.active, TRUE) = TRUE
    AND normalize_search_term(v.name) IS NOT NULL
    AND (p_full OR COALESCE(
      (to_jsonb(v) ->> 'updated_at')::timestamptz,
      v.hours_updated_at,
      v.last_verified_at,
      v.created_at
    ) >= v_effective_since)
    AND (v_metro_cities IS NULL OR v.city IS NULL OR v.city = ANY(v_metro_cities))
  ON CONFLICT DO NOTHING;

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'venue', v.id::TEXT, 'venue', 'alias', v.name, alias.term, v.city,
    venue_search_term_weight(
      EXISTS (
        SELECT 1
        FROM venues child
        WHERE child.parent_venue_id = v.id
          AND COALESCE(child.active, TRUE) = TRUE
      ),
      v.parent_venue_id,
      COALESCE(v.featured, FALSE),
      COALESCE(v.explore_featured, FALSE),
      v.data_quality
    ),
    'venues.generic_aliases'
  FROM venues v
  CROSS JOIN LATERAL unnest(venue_generic_search_term_candidates(v.name)) AS alias(term)
  WHERE COALESCE(v.active, TRUE) = TRUE
    AND normalize_search_term(v.name) IS NOT NULL
    AND (p_full OR COALESCE(
      (to_jsonb(v) ->> 'updated_at')::timestamptz,
      v.hours_updated_at,
      v.last_verified_at,
      v.created_at
    ) >= v_effective_since)
    AND (v_metro_cities IS NULL OR v.city IS NULL OR v.city = ANY(v_metro_cities))
  ON CONFLICT DO NOTHING;

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'organizer', o.id::TEXT, 'organizer', 'primary', o.name, normalize_search_term(o.name), o.city,
    GREATEST(COALESCE(o.total_events_tracked, 1), 1), 'organizations.name'
  FROM organizations o
  WHERE COALESCE(o.hidden, FALSE) = FALSE
    AND normalize_search_term(o.name) IS NOT NULL
    AND (p_full OR o.updated_at >= v_effective_since)
    AND (v_metro_cities IS NULL OR o.city IS NULL OR o.city = ANY(v_metro_cities));

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'organizer', o.id::TEXT, 'organizer', 'alias', o.name, alias.term, o.city,
    GREATEST(COALESCE(o.total_events_tracked, 1), 1), 'organizations.generated_aliases'
  FROM organizations o
  CROSS JOIN LATERAL unnest(search_term_alias_candidates(o.name, o.slug)) AS alias(term)
  WHERE COALESCE(o.hidden, FALSE) = FALSE
    AND normalize_search_term(o.name) IS NOT NULL
    AND (p_full OR o.updated_at >= v_effective_since)
    AND (v_metro_cities IS NULL OR o.city IS NULL OR o.city = ANY(v_metro_cities))
  ON CONFLICT DO NOTHING;

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'program', p.id::TEXT, 'event', 'primary', p.name, normalize_search_term(p.name), v.city, 1, 'programs.name'
  FROM programs p
  LEFT JOIN venues v ON v.id = p.venue_id
  WHERE p.status = 'active'
    AND normalize_search_term(p.name) IS NOT NULL
    AND (p_full OR p.updated_at >= v_effective_since)
    AND (v_metro_cities IS NULL OR v.city IS NULL OR v.city = ANY(v_metro_cities));

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'program', p.id::TEXT, 'event', 'alias', p.name, alias.term, v.city, 1, 'programs.generated_aliases'
  FROM programs p
  LEFT JOIN venues v ON v.id = p.venue_id
  CROSS JOIN LATERAL unnest(search_term_alias_candidates(p.name, p.slug)) AS alias(term)
  WHERE p.status = 'active'
    AND normalize_search_term(p.name) IS NOT NULL
    AND (p_full OR p.updated_at >= v_effective_since)
    AND (v_metro_cities IS NULL OR v.city IS NULL OR v.city = ANY(v_metro_cities))
  ON CONFLICT DO NOTHING;

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'program', p.id::TEXT, 'event', 'provider', p.name, normalize_search_term(p.provider_name), v.city, 1, 'programs.provider_name'
  FROM programs p
  LEFT JOIN venues v ON v.id = p.venue_id
  WHERE p.status = 'active'
    AND normalize_search_term(p.name) IS NOT NULL
    AND normalize_search_term(p.provider_name) IS NOT NULL
    AND normalize_search_term(p.provider_name) <> normalize_search_term(p.name)
    AND (p_full OR p.updated_at >= v_effective_since)
    AND (v_metro_cities IS NULL OR v.city IS NULL OR v.city = ANY(v_metro_cities))
  ON CONFLICT DO NOTHING;

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'program', p.id::TEXT, 'event', 'venue', p.name, normalize_search_term(v.name), v.city, 1, 'programs.venue'
  FROM programs p
  JOIN venues v ON v.id = p.venue_id
  WHERE p.status = 'active'
    AND normalize_search_term(p.name) IS NOT NULL
    AND normalize_search_term(v.name) IS NOT NULL
    AND normalize_search_term(v.name) <> normalize_search_term(p.name)
    AND (p_full OR p.updated_at >= v_effective_since)
    AND (v_metro_cities IS NULL OR v.city IS NULL OR v.city = ANY(v_metro_cities))
  ON CONFLICT DO NOTHING;

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'neighborhood',
    normalized_city || ':' || normalized_neighborhood,
    'neighborhood',
    'primary',
    display_term,
    normalized_neighborhood,
    city,
    frequency,
    'venues.neighborhood'
  FROM (
    SELECT
      MIN(v.neighborhood) AS display_term,
      MIN(v.city) AS city,
      normalize_search_term(v.city) AS normalized_city,
      normalize_search_term(v.neighborhood) AS normalized_neighborhood,
      COUNT(*)::INTEGER AS frequency
    FROM venues v
    WHERE COALESCE(v.active, TRUE) = TRUE
      AND normalize_search_term(v.neighborhood) IS NOT NULL
      AND normalize_search_term(v.city) IS NOT NULL
      AND (
        p_full OR COALESCE(
          (to_jsonb(v) ->> 'updated_at')::timestamptz,
          v.hours_updated_at,
          v.last_verified_at,
          v.created_at
        ) >= v_effective_since OR v_metro_cities IS NOT NULL
      )
      AND (v_metro_cities IS NULL OR v.city = ANY(v_metro_cities))
    GROUP BY normalize_search_term(v.city), normalize_search_term(v.neighborhood)
  ) neighborhoods;

  DELETE FROM entity_search_terms
  WHERE entity_type IN ('category', 'tag', 'vibe');

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'category', normalize_search_term(e.category_id), 'category', 'primary',
    MIN(e.category_id), normalize_search_term(e.category_id), NULL, COUNT(*)::INTEGER, 'events.category_id'
  FROM events e
  WHERE e.start_date >= CURRENT_DATE
    AND COALESCE(e.is_active, TRUE) = TRUE
    AND e.category_id IS NOT NULL
    AND normalize_search_term(e.category_id) IS NOT NULL
  GROUP BY normalize_search_term(e.category_id);

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'tag', normalize_search_term(tag.term), 'tag', 'tag',
    MIN(tag.term), normalize_search_term(tag.term), NULL, COUNT(*)::INTEGER, 'events.tags'
  FROM events e
  CROSS JOIN LATERAL unnest(COALESCE(e.tags, '{}'::TEXT[])) AS tag(term)
  WHERE e.start_date >= CURRENT_DATE
    AND COALESCE(e.is_active, TRUE) = TRUE
    AND normalize_search_term(tag.term) IS NOT NULL
  GROUP BY normalize_search_term(tag.term)
  HAVING COUNT(*) >= 3;

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'tag', normalize_search_term(tag.term), 'tag', 'tag',
    MIN(tag.term), normalize_search_term(tag.term), NULL, COUNT(*)::INTEGER, 'programs.tags'
  FROM programs p
  CROSS JOIN LATERAL unnest(COALESCE(p.tags, '{}'::TEXT[])) AS tag(term)
  WHERE p.status = 'active'
    AND normalize_search_term(tag.term) IS NOT NULL
  GROUP BY normalize_search_term(tag.term)
  HAVING COUNT(*) >= 2
  ON CONFLICT DO NOTHING;

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'vibe', normalize_search_term(vibe.term), 'vibe', 'vibe',
    MIN(vibe.term), normalize_search_term(vibe.term), NULL, COUNT(*)::INTEGER, 'venues.vibes'
  FROM venues v
  CROSS JOIN LATERAL unnest(COALESCE(v.vibes, '{}'::TEXT[])) AS vibe(term)
  WHERE COALESCE(v.active, TRUE) = TRUE
    AND normalize_search_term(vibe.term) IS NOT NULL
  GROUP BY normalize_search_term(vibe.term)
  HAVING COUNT(*) >= 2;

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'festival', f.id, 'festival', 'primary', f.name, normalize_search_term(f.name), NULL, 1, 'festivals.name'
  FROM festivals f
  WHERE normalize_search_term(f.name) IS NOT NULL
    AND (p_full OR f.updated_at >= v_effective_since);

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'festival', f.id, 'festival', 'alias', f.name, alias.term, NULL, 1, 'festivals.generated_aliases'
  FROM festivals f
  CROSS JOIN LATERAL unnest(search_term_alias_candidates(f.name, f.slug)) AS alias(term)
  WHERE normalize_search_term(f.name) IS NOT NULL
    AND (p_full OR f.updated_at >= v_effective_since)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION rebuild_entity_search_terms()
RETURNS void AS $$
BEGIN
  PERFORM rebuild_entity_search_terms_scoped(NULL, NULL, TRUE);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_search_suggestions()
RETURNS void AS $$
BEGIN
  PERFORM rebuild_entity_search_terms_scoped(NULL, NULL, TRUE);
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY search_suggestions;
  EXCEPTION
    WHEN feature_not_supported OR object_not_in_prerequisite_state THEN
      REFRESH MATERIALIZED VIEW search_suggestions;
  END;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_search_suggestions_incremental(
  p_city TEXT DEFAULT NULL,
  p_since TIMESTAMPTZ DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  PERFORM rebuild_entity_search_terms_scoped(p_city, p_since, FALSE);
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY search_suggestions;
  EXCEPTION
    WHEN feature_not_supported OR object_not_in_prerequisite_state THEN
      REFRESH MATERIALIZED VIEW search_suggestions;
  END;
END;
$$ LANGUAGE plpgsql;

-- -------------------------------------------------------
-- School calendar events (Hooky family portal — migration 307)
-- -------------------------------------------------------
-- Public school system calendar reference data (APS, DeKalb, Cobb, Gwinnett).
-- NOT per-child school affiliation — just calendar data for "Heads Up" alerts.

CREATE TABLE IF NOT EXISTS school_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_system TEXT NOT NULL CHECK (school_system IN ('aps', 'dekalb', 'cobb', 'gwinnett')),
  event_type TEXT NOT NULL CHECK (
    event_type IN ('no_school', 'half_day', 'break', 'holiday', 'early_release')
  ),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  school_year TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT school_calendar_date_order_check CHECK (start_date <= end_date)
);

CREATE INDEX IF NOT EXISTS idx_school_calendar_system ON school_calendar_events(school_system, school_year);
CREATE INDEX IF NOT EXISTS idx_school_calendar_date_range ON school_calendar_events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_school_calendar_school_year ON school_calendar_events(school_year);
CREATE INDEX IF NOT EXISTS idx_school_calendar_event_type ON school_calendar_events(event_type, start_date);

ALTER TABLE school_calendar_events ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- Editorial mentions + venue occasions (migrations 433, 442)
-- -------------------------------------------------------

CREATE TABLE IF NOT EXISTS editorial_mentions (
  id SERIAL PRIMARY KEY,
  venue_id INT REFERENCES venues(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL,
  article_url TEXT NOT NULL,
  article_title TEXT NOT NULL,
  mention_type TEXT NOT NULL DEFAULT 'feature',
  published_at TIMESTAMPTZ,
  guide_name TEXT,
  snippet TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT editorial_mentions_source_key_check CHECK (
    source_key IN (
      'eater_atlanta',
      'infatuation_atlanta',
      'rough_draft_atlanta',
      'atlanta_eats',
      'atlanta_magazine',
      'thrillist_atlanta',
      'whatnow_atlanta',
      'axios_atlanta',
      'atl_bucket_list',
      'atlas_obscura',
      'atlanta_trails',
      'explore_georgia'
    )
  ),
  CONSTRAINT editorial_mentions_mention_type_check CHECK (
    mention_type IN (
      'review',
      'guide_inclusion',
      'best_of',
      'opening',
      'closing',
      'feature'
    )
  ),
  CONSTRAINT editorial_mentions_snippet_length CHECK (
    snippet IS NULL OR length(snippet) <= 500
  )
);

CREATE INDEX IF NOT EXISTS idx_editorial_mentions_venue_id
  ON editorial_mentions(venue_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_editorial_mentions_published
  ON editorial_mentions(published_at DESC)
  WHERE is_active = true AND venue_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_editorial_mentions_source
  ON editorial_mentions(source_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_editorial_mentions_article_venue
  ON editorial_mentions(article_url, venue_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_editorial_mentions_article_unmatched
  ON editorial_mentions(article_url)
  WHERE venue_id IS NULL;

CREATE TRIGGER update_editorial_mentions_updated_at
  BEFORE UPDATE ON editorial_mentions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE editorial_mentions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS venue_occasions (
  id SERIAL PRIMARY KEY,
  venue_id INT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  occasion TEXT NOT NULL,
  confidence DECIMAL(3,2) NOT NULL DEFAULT 1.0,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT venue_occasions_occasion_check CHECK (
    occasion IN (
      'date_night',
      'groups',
      'solo',
      'outdoor_dining',
      'late_night',
      'quick_bite',
      'special_occasion',
      'beltline',
      'pre_game',
      'brunch',
      'family_friendly',
      'dog_friendly',
      'live_music'
    )
  ),
  CONSTRAINT venue_occasions_source_check CHECK (
    source IN ('manual', 'inferred', 'editorial')
  ),
  CONSTRAINT venue_occasions_confidence_range CHECK (
    confidence >= 0.0 AND confidence <= 1.0
  ),
  UNIQUE (venue_id, occasion)
);

CREATE INDEX IF NOT EXISTS idx_venue_occasions_occasion
  ON venue_occasions(occasion);

CREATE INDEX IF NOT EXISTS idx_venue_occasions_venue
  ON venue_occasions(venue_id);

ALTER TABLE venue_occasions ENABLE ROW LEVEL SECURITY;
