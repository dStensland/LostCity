-- Migration: Add event_tags and org_tags tables
-- Extends the tagging system to support events and organizations

-- Event tags table (mirrors venue_tags structure)
CREATE TABLE IF NOT EXISTS event_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES venue_tag_definitions(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id, tag_id, added_by)
);

-- Organization tags table
CREATE TABLE IF NOT EXISTS org_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES producers(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES venue_tag_definitions(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, tag_id, added_by)
);

-- Event tag votes
CREATE TABLE IF NOT EXISTS event_tag_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_tag_id UUID NOT NULL REFERENCES event_tags(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_tag_id, user_id)
);

-- Organization tag votes
CREATE TABLE IF NOT EXISTS org_tag_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_tag_id UUID NOT NULL REFERENCES org_tags(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_tag_id, user_id)
);

-- Indexes for event_tags
CREATE INDEX IF NOT EXISTS idx_event_tags_event ON event_tags(event_id);
CREATE INDEX IF NOT EXISTS idx_event_tags_tag ON event_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_event_tags_added_by ON event_tags(added_by);
CREATE INDEX IF NOT EXISTS idx_event_tag_votes_tag ON event_tag_votes(event_tag_id);
CREATE INDEX IF NOT EXISTS idx_event_tag_votes_user ON event_tag_votes(user_id);

-- Indexes for org_tags
CREATE INDEX IF NOT EXISTS idx_org_tags_org ON org_tags(org_id);
CREATE INDEX IF NOT EXISTS idx_org_tags_tag ON org_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_org_tags_added_by ON org_tags(added_by);
CREATE INDEX IF NOT EXISTS idx_org_tag_votes_tag ON org_tag_votes(org_tag_id);
CREATE INDEX IF NOT EXISTS idx_org_tag_votes_user ON org_tag_votes(user_id);

-- Materialized view for event tags (mirrors venue_tag_summary)
CREATE MATERIALIZED VIEW IF NOT EXISTS event_tag_summary AS
SELECT
  et.event_id,
  vtd.id AS tag_id,
  vtd.slug AS tag_slug,
  vtd.label AS tag_label,
  vtd.tag_group,
  vtd.entity_type,
  vtd.is_official,
  COUNT(DISTINCT et.id) AS add_count,
  COALESCE(SUM(CASE WHEN etv.vote_type = 'up' THEN 1 ELSE 0 END), 0) AS upvote_count,
  COALESCE(SUM(CASE WHEN etv.vote_type = 'down' THEN 1 ELSE 0 END), 0) AS downvote_count,
  COUNT(DISTINCT et.id) +
    COALESCE(SUM(CASE WHEN etv.vote_type = 'up' THEN 1 ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN etv.vote_type = 'down' THEN 1 ELSE 0 END), 0) AS score
FROM event_tags et
JOIN venue_tag_definitions vtd ON vtd.id = et.tag_id
LEFT JOIN event_tag_votes etv ON etv.event_tag_id = et.id
WHERE vtd.is_active = TRUE AND vtd.entity_type = 'event'
GROUP BY et.event_id, vtd.id, vtd.slug, vtd.label, vtd.tag_group, vtd.entity_type, vtd.is_official;

-- Indexes for event_tag_summary
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_tag_summary_pk ON event_tag_summary(event_id, tag_id);
CREATE INDEX IF NOT EXISTS idx_event_tag_summary_event ON event_tag_summary(event_id);
CREATE INDEX IF NOT EXISTS idx_event_tag_summary_score ON event_tag_summary(event_id, score DESC);

-- Materialized view for org tags
CREATE MATERIALIZED VIEW IF NOT EXISTS org_tag_summary AS
SELECT
  ot.org_id,
  vtd.id AS tag_id,
  vtd.slug AS tag_slug,
  vtd.label AS tag_label,
  vtd.tag_group,
  vtd.entity_type,
  vtd.is_official,
  COUNT(DISTINCT ot.id) AS add_count,
  COALESCE(SUM(CASE WHEN otv.vote_type = 'up' THEN 1 ELSE 0 END), 0) AS upvote_count,
  COALESCE(SUM(CASE WHEN otv.vote_type = 'down' THEN 1 ELSE 0 END), 0) AS downvote_count,
  COUNT(DISTINCT ot.id) +
    COALESCE(SUM(CASE WHEN otv.vote_type = 'up' THEN 1 ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN otv.vote_type = 'down' THEN 1 ELSE 0 END), 0) AS score
FROM org_tags ot
JOIN venue_tag_definitions vtd ON vtd.id = ot.tag_id
LEFT JOIN org_tag_votes otv ON otv.org_tag_id = ot.id
WHERE vtd.is_active = TRUE AND vtd.entity_type = 'org'
GROUP BY ot.org_id, vtd.id, vtd.slug, vtd.label, vtd.tag_group, vtd.entity_type, vtd.is_official;

-- Indexes for org_tag_summary
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_tag_summary_pk ON org_tag_summary(org_id, tag_id);
CREATE INDEX IF NOT EXISTS idx_org_tag_summary_org ON org_tag_summary(org_id);
CREATE INDEX IF NOT EXISTS idx_org_tag_summary_score ON org_tag_summary(org_id, score DESC);

-- RLS policies for event_tags
ALTER TABLE event_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view event tags"
  ON event_tags FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can add event tags"
  ON event_tags FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = added_by);

CREATE POLICY "Users can remove their own event tags"
  ON event_tags FOR DELETE
  TO authenticated
  USING (auth.uid() = added_by);

-- RLS policies for org_tags
ALTER TABLE org_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view org tags"
  ON org_tags FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can add org tags"
  ON org_tags FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = added_by);

CREATE POLICY "Users can remove their own org tags"
  ON org_tags FOR DELETE
  TO authenticated
  USING (auth.uid() = added_by);

-- RLS policies for event_tag_votes
ALTER TABLE event_tag_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view event tag votes"
  ON event_tag_votes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can vote on event tags"
  ON event_tag_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can change their event tag votes"
  ON event_tag_votes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can remove their event tag votes"
  ON event_tag_votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS policies for org_tag_votes
ALTER TABLE org_tag_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view org tag votes"
  ON org_tag_votes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can vote on org tags"
  ON org_tag_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can change their org tag votes"
  ON org_tag_votes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can remove their org tag votes"
  ON org_tag_votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Grant access to materialized views
GRANT SELECT ON event_tag_summary TO anon, authenticated;
GRANT SELECT ON org_tag_summary TO anon, authenticated;

-- Comment
COMMENT ON TABLE event_tags IS 'User-added tags on events';
COMMENT ON TABLE org_tags IS 'User-added tags on organizations/producers';
