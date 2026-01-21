-- Migration: Add genre support for films, music, theater, and sports
-- Hybrid approach: curated common genres + custom allowed

-- Add genres array to series (primary location for recurring content)
ALTER TABLE series ADD COLUMN genres TEXT[];

-- Add genres array to events (for standalone events without a series)
ALTER TABLE events ADD COLUMN genres TEXT[];

-- Index for genre filtering
CREATE INDEX idx_series_genres ON series USING GIN (genres);
CREATE INDEX idx_events_genres ON events USING GIN (genres);

-- Reference table for curated genres (not enforced, but used for UI/suggestions)
CREATE TABLE genre_options (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,  -- film, music, theater, sports
  genre TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  UNIQUE(category, genre)
);

-- Film genres
INSERT INTO genre_options (category, genre, display_order) VALUES
  ('film', 'action', 1),
  ('film', 'adventure', 2),
  ('film', 'animation', 3),
  ('film', 'comedy', 4),
  ('film', 'crime', 5),
  ('film', 'documentary', 6),
  ('film', 'drama', 7),
  ('film', 'family', 8),
  ('film', 'fantasy', 9),
  ('film', 'foreign', 10),
  ('film', 'horror', 11),
  ('film', 'indie', 12),
  ('film', 'musical', 13),
  ('film', 'mystery', 14),
  ('film', 'romance', 15),
  ('film', 'sci-fi', 16),
  ('film', 'thriller', 17),
  ('film', 'war', 18),
  ('film', 'western', 19),
  ('film', 'cult', 20),
  ('film', 'classic', 21),
  ('film', 'noir', 22),
  ('film', 'silent', 23),
  ('film', 'experimental', 24);

-- Music genres
INSERT INTO genre_options (category, genre, display_order) VALUES
  ('music', 'rock', 1),
  ('music', 'pop', 2),
  ('music', 'hip-hop', 3),
  ('music', 'r&b', 4),
  ('music', 'jazz', 5),
  ('music', 'blues', 6),
  ('music', 'country', 7),
  ('music', 'folk', 8),
  ('music', 'electronic', 9),
  ('music', 'house', 10),
  ('music', 'techno', 11),
  ('music', 'edm', 12),
  ('music', 'classical', 13),
  ('music', 'opera', 14),
  ('music', 'metal', 15),
  ('music', 'punk', 16),
  ('music', 'indie', 17),
  ('music', 'alternative', 18),
  ('music', 'soul', 19),
  ('music', 'funk', 20),
  ('music', 'reggae', 21),
  ('music', 'latin', 22),
  ('music', 'world', 23),
  ('music', 'singer-songwriter', 24),
  ('music', 'ambient', 25),
  ('music', 'experimental', 26),
  ('music', 'cover', 27),
  ('music', 'tribute', 28),
  ('music', 'jam', 29),
  ('music', 'bluegrass', 30),
  ('music', 'gospel', 31);

-- Theater genres
INSERT INTO genre_options (category, genre, display_order) VALUES
  ('theater', 'musical', 1),
  ('theater', 'drama', 2),
  ('theater', 'comedy', 3),
  ('theater', 'tragedy', 4),
  ('theater', 'improv', 5),
  ('theater', 'sketch', 6),
  ('theater', 'stand-up', 7),
  ('theater', 'one-person', 8),
  ('theater', 'puppet', 9),
  ('theater', 'dance', 10),
  ('theater', 'ballet', 11),
  ('theater', 'opera', 12),
  ('theater', 'burlesque', 13),
  ('theater', 'cabaret', 14),
  ('theater', 'variety', 15),
  ('theater', 'magic', 16),
  ('theater', 'circus', 17),
  ('theater', 'immersive', 18),
  ('theater', 'experimental', 19),
  ('theater', 'classic', 20),
  ('theater', 'shakespeare', 21),
  ('theater', 'children', 22),
  ('theater', 'devised', 23),
  ('theater', 'new-work', 24);

-- Sports types
INSERT INTO genre_options (category, genre, display_order) VALUES
  ('sports', 'baseball', 1),
  ('sports', 'basketball', 2),
  ('sports', 'football', 3),
  ('sports', 'soccer', 4),
  ('sports', 'hockey', 5),
  ('sports', 'golf', 6),
  ('sports', 'tennis', 7),
  ('sports', 'boxing', 8),
  ('sports', 'mma', 9),
  ('sports', 'wrestling', 10),
  ('sports', 'racing', 11),
  ('sports', 'motorsports', 12),
  ('sports', 'track', 13),
  ('sports', 'gymnastics', 14),
  ('sports', 'swimming', 15),
  ('sports', 'volleyball', 16),
  ('sports', 'lacrosse', 17),
  ('sports', 'rugby', 18),
  ('sports', 'cricket', 19),
  ('sports', 'esports', 20),
  ('sports', 'poker', 21),
  ('sports', 'cycling', 22),
  ('sports', 'marathon', 23),
  ('sports', 'triathlon', 24),
  ('sports', 'crossfit', 25),
  ('sports', 'roller-derby', 26);

-- Index for quick genre lookups
CREATE INDEX idx_genre_options_category ON genre_options(category);

-- Comments
COMMENT ON TABLE genre_options IS 'Curated genre options per category - used for UI suggestions, not enforced';
COMMENT ON COLUMN series.genres IS 'Genre tags for the series (e.g., horror, comedy for films)';
COMMENT ON COLUMN events.genres IS 'Genre tags for standalone events (events with series_id inherit from series)';
