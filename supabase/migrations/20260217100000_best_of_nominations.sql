-- ============================================================================
-- Best Of Nominations
-- Gate venue relevance per category so only appropriate venues appear
-- ============================================================================

-- Nominations table
CREATE TABLE IF NOT EXISTS best_of_nominations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,  -- null for system seed
  category_id uuid NOT NULL REFERENCES best_of_categories(id) ON DELETE CASCADE,
  venue_id    integer NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pending', 'rejected')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(category_id, venue_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_best_of_nominations_category ON best_of_nominations(category_id, status);
CREATE INDEX IF NOT EXISTS idx_best_of_nominations_venue ON best_of_nominations(venue_id);

-- RLS
ALTER TABLE best_of_nominations ENABLE ROW LEVEL SECURITY;

CREATE POLICY best_of_nominations_select ON best_of_nominations
  FOR SELECT USING (true);

CREATE POLICY best_of_nominations_insert ON best_of_nominations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Seed nominations from venue_type (all system-seeded, status='approved')
-- ============================================================================

-- best-dive-bar: bar venues
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c
JOIN venues v ON v.venue_type = 'bar'
WHERE c.slug = 'best-dive-bar'
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- best-brunch: restaurants
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c
JOIN venues v ON v.venue_type IN ('restaurant')
WHERE c.slug = 'best-brunch'
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- best-date-night: restaurant, cocktail_bar, lounge, wine_bar, rooftop
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c
JOIN venues v ON v.venue_type IN ('restaurant', 'cocktail_bar', 'lounge', 'wine_bar', 'rooftop')
WHERE c.slug = 'best-date-night'
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- best-rooftop: rooftop venues
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c
JOIN venues v ON v.venue_type = 'rooftop'
WHERE c.slug = 'best-rooftop'
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- best-live-music: music_venue
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c
JOIN venues v ON v.venue_type = 'music_venue'
WHERE c.slug = 'best-live-music'
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- best-patio: restaurant, bar, brewery
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c
JOIN venues v ON v.venue_type IN ('restaurant', 'bar', 'brewery')
WHERE c.slug = 'best-patio'
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- best-happy-hour: bar, cocktail_bar, sports_bar, brewery
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c
JOIN venues v ON v.venue_type IN ('bar', 'cocktail_bar', 'sports_bar', 'brewery')
WHERE c.slug = 'best-happy-hour'
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- best-late-night: bar, nightclub, club, lounge
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c
JOIN venues v ON v.venue_type IN ('bar', 'nightclub', 'club', 'lounge')
WHERE c.slug = 'best-late-night'
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- best-hidden-gem: venues with hidden-gem tag
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c
JOIN venues v ON 'hidden-gem' = ANY(v.vibes)
WHERE c.slug = 'best-hidden-gem'
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- best-new-spot: venues created in last 12 months
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c
JOIN venues v ON v.created_at >= now() - interval '12 months'
WHERE c.slug = 'best-new-spot'
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- ============================================================================
-- Backfill any existing votes as nominations
-- ============================================================================
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT DISTINCT category_id, venue_id, 'approved'
FROM best_of_votes
ON CONFLICT (category_id, venue_id) DO NOTHING;
