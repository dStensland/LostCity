CREATE TABLE IF NOT EXISTS event_artists (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  billing_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_artists_event_id ON event_artists(event_id);
CREATE INDEX IF NOT EXISTS idx_event_artists_name ON event_artists(name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_artists_event_name ON event_artists(event_id, name);
