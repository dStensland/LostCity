-- Venue highlights: hidden features and notable aspects of existing venues
CREATE TABLE venue_highlights (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  venue_id bigint NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  highlight_type text NOT NULL CHECK (highlight_type IN (
    'viewpoint', 'architecture', 'history', 'art', 'nature', 'photo_spot', 'hidden_feature'
  )),
  title text NOT NULL,
  description text,
  image_url text,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_venue_highlights_venue ON venue_highlights(venue_id);
ALTER TABLE venue_highlights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON venue_highlights FOR SELECT USING (true);
