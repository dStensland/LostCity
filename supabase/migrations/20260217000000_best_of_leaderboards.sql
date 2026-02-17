-- ============================================================================
-- Best Of Leaderboards
-- Community-driven venue ranking with algorithm signals + community votes
-- ============================================================================

-- Categories table
CREATE TABLE IF NOT EXISTS best_of_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL,
  name        text NOT NULL,
  description text,
  icon        text,                          -- emoji or icon name
  venue_filter jsonb DEFAULT '{}',           -- optional venue_type / neighborhood filters
  signal_weights jsonb DEFAULT '{}',         -- per-category weight overrides
  portal_id   uuid REFERENCES portals(id),
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(slug, portal_id)
);

-- Community votes — one vote per user per category
CREATE TABLE IF NOT EXISTS best_of_votes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES best_of_categories(id) ON DELETE CASCADE,
  venue_id    integer NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, category_id)
);

-- "Make Your Case" blurbs — one per user per category per venue
CREATE TABLE IF NOT EXISTS best_of_cases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id   uuid NOT NULL REFERENCES best_of_categories(id) ON DELETE CASCADE,
  venue_id      integer NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  content       text NOT NULL CHECK (char_length(content) BETWEEN 30 AND 280),
  upvote_count  integer NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected', 'flagged')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, category_id, venue_id)
);

-- Case upvotes — one per user per case
CREATE TABLE IF NOT EXISTS best_of_case_upvotes (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_id   uuid NOT NULL REFERENCES best_of_cases(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, case_id)
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_best_of_votes_category ON best_of_votes(category_id);
CREATE INDEX IF NOT EXISTS idx_best_of_votes_venue ON best_of_votes(category_id, venue_id);
CREATE INDEX IF NOT EXISTS idx_best_of_cases_category ON best_of_cases(category_id);
CREATE INDEX IF NOT EXISTS idx_best_of_cases_venue ON best_of_cases(category_id, venue_id);
CREATE INDEX IF NOT EXISTS idx_best_of_case_upvotes_case ON best_of_case_upvotes(case_id);
CREATE INDEX IF NOT EXISTS idx_best_of_categories_portal ON best_of_categories(portal_id, is_active);

-- ============================================================================
-- Trigger: auto-update upvote_count on best_of_cases
-- ============================================================================
CREATE OR REPLACE FUNCTION update_best_of_case_upvote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE best_of_cases SET upvote_count = upvote_count + 1 WHERE id = NEW.case_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE best_of_cases SET upvote_count = GREATEST(upvote_count - 1, 0) WHERE id = OLD.case_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_best_of_case_upvote_count ON best_of_case_upvotes;
CREATE TRIGGER trg_best_of_case_upvote_count
  AFTER INSERT OR DELETE ON best_of_case_upvotes
  FOR EACH ROW EXECUTE FUNCTION update_best_of_case_upvote_count();

-- ============================================================================
-- Materialized view: pre-computed algorithm scores per venue
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS best_of_venue_scores AS
WITH follow_scores AS (
  SELECT followed_venue_id AS venue_id, LEAST(COUNT(*), 20) * 2 AS score
  FROM follows WHERE followed_venue_id IS NOT NULL
  GROUP BY followed_venue_id
),
save_scores AS (
  SELECT venue_id, LEAST(COUNT(*), 15) * 1 AS score
  FROM saved_items WHERE venue_id IS NOT NULL
  GROUP BY venue_id
),
recommendation_scores AS (
  SELECT venue_id, LEAST(COUNT(*), 15) * 3 AS score
  FROM recommendations WHERE venue_id IS NOT NULL
  GROUP BY venue_id
),
event_scores AS (
  SELECT venue_id, LEAST(COUNT(*), 20) * 0.5 AS score
  FROM events
  WHERE start_date >= CURRENT_DATE
    AND canonical_event_id IS NULL
  GROUP BY venue_id
),
rsvp_scores AS (
  SELECT e.venue_id, LEAST(COUNT(*), 40) * 0.25 AS score
  FROM event_rsvps r
  JOIN events e ON e.id = r.event_id
  WHERE r.created_at >= now() - interval '30 days'
    AND e.venue_id IS NOT NULL
  GROUP BY e.venue_id
),
track_scores AS (
  SELECT tv.venue_id, LEAST(COUNT(*), 3) * 3 AS score
  FROM explore_track_venues tv
  WHERE tv.status = 'approved'
  GROUP BY tv.venue_id
),
list_scores AS (
  SELECT venue_id, LEAST(COUNT(*), 5) * 1 AS score
  FROM list_items
  WHERE item_type = 'venue' AND venue_id IS NOT NULL
  GROUP BY venue_id
)
SELECT
  v.id AS venue_id,
  COALESCE(f.score, 0) +
  COALESCE(s.score, 0) +
  COALESCE(rec.score, 0) +
  COALESCE(ev.score, 0) +
  COALESCE(rsvp.score, 0) +
  COALESCE(t.score, 0) +
  COALESCE(l.score, 0) AS algorithm_score
FROM venues v
LEFT JOIN follow_scores f ON f.venue_id = v.id
LEFT JOIN save_scores s ON s.venue_id = v.id
LEFT JOIN recommendation_scores rec ON rec.venue_id = v.id
LEFT JOIN event_scores ev ON ev.venue_id = v.id
LEFT JOIN rsvp_scores rsvp ON rsvp.venue_id = v.id
LEFT JOIN track_scores t ON t.venue_id = v.id
LEFT JOIN list_scores l ON l.venue_id = v.id
WHERE COALESCE(f.score, 0) + COALESCE(s.score, 0) + COALESCE(rec.score, 0) +
      COALESCE(ev.score, 0) + COALESCE(rsvp.score, 0) + COALESCE(t.score, 0) +
      COALESCE(l.score, 0) > 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_best_of_venue_scores_venue
  ON best_of_venue_scores(venue_id);

-- ============================================================================
-- RLS Policies
-- ============================================================================
ALTER TABLE best_of_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE best_of_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE best_of_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE best_of_case_upvotes ENABLE ROW LEVEL SECURITY;

-- Categories: public read
CREATE POLICY best_of_categories_select ON best_of_categories
  FOR SELECT USING (true);

-- Votes: public read, auth insert/delete own
CREATE POLICY best_of_votes_select ON best_of_votes
  FOR SELECT USING (true);
CREATE POLICY best_of_votes_insert ON best_of_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY best_of_votes_delete ON best_of_votes
  FOR DELETE USING (auth.uid() = user_id);

-- Cases: public read, auth insert/update own
CREATE POLICY best_of_cases_select ON best_of_cases
  FOR SELECT USING (true);
CREATE POLICY best_of_cases_insert ON best_of_cases
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY best_of_cases_update ON best_of_cases
  FOR UPDATE USING (auth.uid() = user_id);

-- Case upvotes: public read, auth insert/delete own
CREATE POLICY best_of_case_upvotes_select ON best_of_case_upvotes
  FOR SELECT USING (true);
CREATE POLICY best_of_case_upvotes_insert ON best_of_case_upvotes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY best_of_case_upvotes_delete ON best_of_case_upvotes
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- Seed: 10 categories for Atlanta portal
-- ============================================================================
INSERT INTO best_of_categories (slug, name, description, icon, portal_id, sort_order) VALUES
  ('best-dive-bar', 'Best Dive Bar', 'Where character counts more than cocktail menus', 'beer', (SELECT id FROM portals WHERE slug = 'atlanta'), 1),
  ('best-brunch', 'Best Brunch', 'Weekend mornings done right', 'utensils', (SELECT id FROM portals WHERE slug = 'atlanta'), 2),
  ('best-date-night', 'Best Date Night', 'Impress without trying too hard', 'heart', (SELECT id FROM portals WHERE slug = 'atlanta'), 3),
  ('best-rooftop', 'Best Rooftop', 'Skyline views and sunset vibes', 'sun', (SELECT id FROM portals WHERE slug = 'atlanta'), 4),
  ('best-live-music', 'Best Live Music', 'Where the sound system hits different', 'music', (SELECT id FROM portals WHERE slug = 'atlanta'), 5),
  ('best-patio', 'Best Patio', 'Al fresco at its finest', 'leaf', (SELECT id FROM portals WHERE slug = 'atlanta'), 6),
  ('best-happy-hour', 'Best Happy Hour', 'Maximum vibes per dollar', 'clock', (SELECT id FROM portals WHERE slug = 'atlanta'), 7),
  ('best-late-night', 'Best Late Night', 'For when the night is still young at 1am', 'moon', (SELECT id FROM portals WHERE slug = 'atlanta'), 8),
  ('best-hidden-gem', 'Best Hidden Gem', 'The spots locals keep to themselves', 'gem', (SELECT id FROM portals WHERE slug = 'atlanta'), 9),
  ('best-new-spot', 'Best New Spot', 'Opened in the last year and already a favorite', 'sparkles', (SELECT id FROM portals WHERE slug = 'atlanta'), 10)
ON CONFLICT (slug, portal_id) DO NOTHING;
