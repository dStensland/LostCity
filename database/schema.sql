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
  website TEXT,
  menu_url TEXT,
  reservation_url TEXT,
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
  end_date DATE,
  end_time TIME,
  is_all_day BOOLEAN DEFAULT false,
  category TEXT,
  subcategory TEXT,
  tags TEXT[],
  price_min DECIMAL(10, 2),
  price_max DECIMAL(10, 2),
  price_note TEXT,
  is_free BOOLEAN DEFAULT false,
  source_url TEXT NOT NULL,
  ticket_url TEXT,
  image_url TEXT,
  raw_text TEXT,
  extraction_confidence DECIMAL(3, 2),
  field_provenance JSONB,
  field_confidence JSONB,
  extraction_version TEXT,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  content_hash TEXT,
  canonical_event_id INTEGER REFERENCES events(id),
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
CREATE INDEX idx_events_venue_id ON events(venue_id);
CREATE INDEX idx_events_content_hash ON events(content_hash);
CREATE INDEX idx_events_source_id ON events(source_id);
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
