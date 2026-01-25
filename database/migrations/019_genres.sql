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
-- Organized by type: plays, musicals, performance art, dance, spoken word, variety
INSERT INTO genre_options (category, genre, display_order) VALUES
  -- Plays
  ('theater', 'drama', 1),
  ('theater', 'comedy', 2),
  ('theater', 'tragedy', 3),
  ('theater', 'classic', 4),
  ('theater', 'shakespeare', 5),
  ('theater', 'new-work', 6),
  ('theater', 'one-person', 7),
  -- Musicals
  ('theater', 'musical', 10),
  ('theater', 'broadway', 11),
  ('theater', 'revue', 12),
  -- Dance
  ('theater', 'ballet', 20),
  ('theater', 'modern-dance', 21),
  ('theater', 'contemporary-dance', 22),
  ('theater', 'tap', 23),
  ('theater', 'folk-dance', 24),
  -- Music/Opera
  ('theater', 'opera', 30),
  ('theater', 'symphony', 31),
  ('theater', 'orchestra', 32),
  ('theater', 'choral', 33),
  -- Spoken Word/Comedy
  ('theater', 'stand-up', 40),
  ('theater', 'improv', 41),
  ('theater', 'sketch', 42),
  ('theater', 'spoken-word', 43),
  ('theater', 'storytelling', 44),
  -- Variety/Spectacle
  ('theater', 'circus', 50),
  ('theater', 'acrobatics', 51),
  ('theater', 'magic', 52),
  ('theater', 'burlesque', 53),
  ('theater', 'cabaret', 54),
  ('theater', 'variety', 55),
  ('theater', 'drag', 56),
  -- Family/Special
  ('theater', 'children', 60),
  ('theater', 'puppet', 61),
  ('theater', 'immersive', 62),
  ('theater', 'experimental', 63),
  ('theater', 'devised', 64);

-- Sports types
-- Organized by: major leagues, college, combat, racing, individual, misc
INSERT INTO genre_options (category, genre, display_order) VALUES
  -- Major team sports (Atlanta teams)
  ('sports', 'baseball', 1),
  ('sports', 'basketball', 2),
  ('sports', 'football', 3),
  ('sports', 'soccer', 4),
  ('sports', 'hockey', 5),
  -- Other team sports
  ('sports', 'softball', 10),
  ('sports', 'volleyball', 11),
  ('sports', 'lacrosse', 12),
  ('sports', 'rugby', 13),
  ('sports', 'cricket', 14),
  ('sports', 'field-hockey', 15),
  -- Combat sports
  ('sports', 'boxing', 20),
  ('sports', 'mma', 21),
  ('sports', 'wrestling', 22),
  ('sports', 'kickboxing', 23),
  -- Racing/Motorsports
  ('sports', 'racing', 30),
  ('sports', 'motorsports', 31),
  ('sports', 'nascar', 32),
  ('sports', 'monster-truck', 33),
  ('sports', 'dirt-track', 34),
  -- Individual sports
  ('sports', 'golf', 40),
  ('sports', 'tennis', 41),
  ('sports', 'track', 42),
  ('sports', 'gymnastics', 43),
  ('sports', 'swimming', 44),
  ('sports', 'diving', 45),
  ('sports', 'figure-skating', 46),
  -- Endurance
  ('sports', 'marathon', 50),
  ('sports', 'triathlon', 51),
  ('sports', 'cycling', 52),
  ('sports', 'crossfit', 53),
  -- Alternative/Misc
  ('sports', 'esports', 60),
  ('sports', 'poker', 61),
  ('sports', 'roller-derby', 62),
  ('sports', 'pickleball', 63),
  ('sports', 'cornhole', 64),
  ('sports', 'axe-throwing', 65);

-- Index for quick genre lookups
CREATE INDEX idx_genre_options_category ON genre_options(category);

-- Comments
COMMENT ON TABLE genre_options IS 'Curated genre options per category - used for UI suggestions, not enforced';
COMMENT ON COLUMN series.genres IS 'Genre tags for the series (e.g., horror, comedy for films)';
COMMENT ON COLUMN events.genres IS 'Genre tags for standalone events (events with series_id inherit from series)';
