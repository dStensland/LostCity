-- Migration: Community Venue Tagging System
-- Creates tables for user-contributed tags on venues with voting

-- Tag definitions (curated + community)
CREATE TABLE IF NOT EXISTS venue_tag_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,              -- "cool-rooftop"
  label TEXT NOT NULL,                    -- "Cool Rooftop"
  category TEXT NOT NULL,                 -- vibe | amenity | good_for | food_drink | accessibility
  is_official BOOLEAN DEFAULT FALSE,      -- Admin-created vs community
  is_active BOOLEAN DEFAULT TRUE,         -- Can be deactivated
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User adds tag to venue
CREATE TABLE IF NOT EXISTS venue_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES venue_tag_definitions(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (venue_id, tag_id, added_by)
);

-- Upvotes/downvotes on tags
CREATE TABLE IF NOT EXISTS venue_tag_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_tag_id UUID NOT NULL REFERENCES venue_tags(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (venue_tag_id, user_id)
);

-- New tag suggestions (moderation queue)
CREATE TABLE IF NOT EXISTS venue_tag_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  suggested_label TEXT NOT NULL,
  suggested_category TEXT NOT NULL,
  suggested_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_venue_tags_venue ON venue_tags(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_tags_tag ON venue_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_venue_tags_added_by ON venue_tags(added_by);
CREATE INDEX IF NOT EXISTS idx_venue_tag_votes_tag ON venue_tag_votes(venue_tag_id);
CREATE INDEX IF NOT EXISTS idx_venue_tag_votes_user ON venue_tag_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_venue_tag_suggestions_venue ON venue_tag_suggestions(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_tag_suggestions_status ON venue_tag_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_venue_tag_definitions_category ON venue_tag_definitions(category);
CREATE INDEX IF NOT EXISTS idx_venue_tag_definitions_active ON venue_tag_definitions(is_active);

-- Materialized view for fast tag queries with scores
CREATE MATERIALIZED VIEW IF NOT EXISTS venue_tag_summary AS
SELECT
  vt.venue_id,
  vtd.id AS tag_id,
  vtd.slug AS tag_slug,
  vtd.label AS tag_label,
  vtd.category AS tag_category,
  vtd.is_official,
  COUNT(DISTINCT vt.id) AS add_count,
  COALESCE(SUM(CASE WHEN vtv.vote_type = 'up' THEN 1 ELSE 0 END), 0) AS upvote_count,
  COALESCE(SUM(CASE WHEN vtv.vote_type = 'down' THEN 1 ELSE 0 END), 0) AS downvote_count,
  COUNT(DISTINCT vt.id) +
    COALESCE(SUM(CASE WHEN vtv.vote_type = 'up' THEN 1 ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN vtv.vote_type = 'down' THEN 1 ELSE 0 END), 0) AS score
FROM venue_tags vt
JOIN venue_tag_definitions vtd ON vtd.id = vt.tag_id
LEFT JOIN venue_tag_votes vtv ON vtv.venue_tag_id = vt.id
WHERE vtd.is_active = TRUE
GROUP BY vt.venue_id, vtd.id, vtd.slug, vtd.label, vtd.category, vtd.is_official;

-- Index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_venue_tag_summary_pk ON venue_tag_summary(venue_id, tag_id);
CREATE INDEX IF NOT EXISTS idx_venue_tag_summary_venue ON venue_tag_summary(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_tag_summary_score ON venue_tag_summary(venue_id, score DESC);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_venue_tag_summary()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY venue_tag_summary;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers to refresh summary on changes
DROP TRIGGER IF EXISTS refresh_venue_tags_on_tag ON venue_tags;
CREATE TRIGGER refresh_venue_tags_on_tag
AFTER INSERT OR DELETE ON venue_tags
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_venue_tag_summary();

DROP TRIGGER IF EXISTS refresh_venue_tags_on_vote ON venue_tag_votes;
CREATE TRIGGER refresh_venue_tags_on_vote
AFTER INSERT OR UPDATE OR DELETE ON venue_tag_votes
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_venue_tag_summary();

-- RLS Policies

-- Enable RLS
ALTER TABLE venue_tag_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_tag_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_tag_suggestions ENABLE ROW LEVEL SECURITY;

-- Tag definitions: Everyone can read active tags
CREATE POLICY "Anyone can read active tag definitions"
ON venue_tag_definitions FOR SELECT
USING (is_active = TRUE);

-- Tag definitions: Only admins can manage
CREATE POLICY "Admins can manage tag definitions"
ON venue_tag_definitions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
  )
);

-- Venue tags: Everyone can read
CREATE POLICY "Anyone can read venue tags"
ON venue_tags FOR SELECT
USING (TRUE);

-- Venue tags: Authenticated users can add
CREATE POLICY "Users can add tags"
ON venue_tags FOR INSERT
WITH CHECK (
  auth.uid() = added_by
);

-- Venue tags: Users can remove their own tags
CREATE POLICY "Users can remove their own tags"
ON venue_tags FOR DELETE
USING (
  auth.uid() = added_by
);

-- Tag votes: Everyone can read
CREATE POLICY "Anyone can read votes"
ON venue_tag_votes FOR SELECT
USING (TRUE);

-- Tag votes: Authenticated users can vote
CREATE POLICY "Users can vote"
ON venue_tag_votes FOR INSERT
WITH CHECK (
  auth.uid() = user_id
);

-- Tag votes: Users can update their own votes
CREATE POLICY "Users can update their votes"
ON venue_tag_votes FOR UPDATE
USING (auth.uid() = user_id);

-- Tag votes: Users can remove their own votes
CREATE POLICY "Users can remove their votes"
ON venue_tag_votes FOR DELETE
USING (auth.uid() = user_id);

-- Tag suggestions: Everyone can read approved suggestions
CREATE POLICY "Anyone can read approved suggestions"
ON venue_tag_suggestions FOR SELECT
USING (
  status = 'approved'
  OR auth.uid() = suggested_by
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
  )
);

-- Tag suggestions: Authenticated users can suggest
CREATE POLICY "Users can suggest tags"
ON venue_tag_suggestions FOR INSERT
WITH CHECK (
  auth.uid() = suggested_by
);

-- Tag suggestions: Admins can manage
CREATE POLICY "Admins can manage suggestions"
ON venue_tag_suggestions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
  )
);

-- Seed initial tag definitions
INSERT INTO venue_tag_definitions (slug, label, category, is_official, is_active) VALUES
-- Vibes
('cool-rooftop', 'Cool Rooftop', 'vibe', TRUE, TRUE),
('chill-vibes', 'Chill Vibes', 'vibe', TRUE, TRUE),
('hidden-gem', 'Hidden Gem', 'vibe', TRUE, TRUE),
('locals-hangout', 'Locals Hangout', 'vibe', TRUE, TRUE),
('trendy-spot', 'Trendy Spot', 'vibe', TRUE, TRUE),
('cozy-atmosphere', 'Cozy Atmosphere', 'vibe', TRUE, TRUE),
('lively-energy', 'Lively Energy', 'vibe', TRUE, TRUE),
('romantic-ambiance', 'Romantic Ambiance', 'vibe', TRUE, TRUE),
('artsy-vibe', 'Artsy Vibe', 'vibe', TRUE, TRUE),

-- Good For
('great-for-dates', 'Great for Dates', 'good_for', TRUE, TRUE),
('making-friends', 'Making Friends', 'good_for', TRUE, TRUE),
('first-dates', 'First Dates', 'good_for', TRUE, TRUE),
('group-hangs', 'Group Hangs', 'good_for', TRUE, TRUE),
('solo-friendly', 'Solo Friendly', 'good_for', TRUE, TRUE),
('work-meetings', 'Work Meetings', 'good_for', TRUE, TRUE),
('birthday-parties', 'Birthday Parties', 'good_for', TRUE, TRUE),
('catching-up', 'Catching Up', 'good_for', TRUE, TRUE),
('people-watching', 'People Watching', 'good_for', TRUE, TRUE),

-- Food/Drink
('great-cocktails', 'Great Cocktails', 'food_drink', TRUE, TRUE),
('craft-beer-selection', 'Craft Beer Selection', 'food_drink', TRUE, TRUE),
('natural-wine', 'Natural Wine', 'food_drink', TRUE, TRUE),
('late-night-food', 'Late Night Food', 'food_drink', TRUE, TRUE),
('happy-hour-deals', 'Happy Hour Deals', 'food_drink', TRUE, TRUE),
('good-coffee', 'Good Coffee', 'food_drink', TRUE, TRUE),
('brunch-spot', 'Brunch Spot', 'food_drink', TRUE, TRUE),

-- Accessibility
('wheelchair-accessible', 'Wheelchair Accessible', 'accessibility', TRUE, TRUE),
('quiet-space-available', 'Quiet Space Available', 'accessibility', TRUE, TRUE),
('gender-neutral-restrooms', 'Gender Neutral Restrooms', 'accessibility', TRUE, TRUE),
('outdoor-seating', 'Outdoor Seating', 'amenity', TRUE, TRUE),
('dog-friendly', 'Dog Friendly', 'amenity', TRUE, TRUE),
('free-wifi', 'Free WiFi', 'amenity', TRUE, TRUE),
('parking-available', 'Parking Available', 'amenity', TRUE, TRUE),
('late-night', 'Open Late', 'amenity', TRUE, TRUE)

ON CONFLICT (slug) DO NOTHING;

-- Grant access to the materialized view
GRANT SELECT ON venue_tag_summary TO anon, authenticated;
