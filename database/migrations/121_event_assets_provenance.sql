-- Event images table
CREATE TABLE IF NOT EXISTS event_images (
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

CREATE INDEX IF NOT EXISTS idx_event_images_event_id ON event_images(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_images_event_url ON event_images(event_id, url);

-- Event links table
CREATE TABLE IF NOT EXISTS event_links (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT,
  confidence DECIMAL(3, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_links_event_id ON event_links(event_id);
CREATE INDEX IF NOT EXISTS idx_event_links_type ON event_links(type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_links_event_type_url ON event_links(event_id, type, url);

-- Add provenance + confidence fields to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS field_provenance JSONB;
ALTER TABLE events ADD COLUMN IF NOT EXISTS field_confidence JSONB;
ALTER TABLE events ADD COLUMN IF NOT EXISTS extraction_version TEXT;

-- Extend event_artists with headliner flag
ALTER TABLE event_artists ADD COLUMN IF NOT EXISTS is_headliner BOOLEAN DEFAULT false;
