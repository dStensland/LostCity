-- Migration 173: Community Needs Tags
-- Extends tag voting system to accessibility/dietary/family needs across all entities
-- Reference: PRD 004 Section 7 - Community Tags

-- Step 1: Rename venue_tag_definitions to tag_definitions
ALTER TABLE IF EXISTS venue_tag_definitions RENAME TO tag_definitions;

-- Step 2: Add entity_types array column (which entities this tag applies to)
ALTER TABLE tag_definitions
ADD COLUMN IF NOT EXISTS entity_types TEXT[] DEFAULT ARRAY['venue']::TEXT[];

-- Update existing tags to set entity_types based on entity_type column
UPDATE tag_definitions
SET entity_types = ARRAY[entity_type]::TEXT[]
WHERE entity_types = ARRAY['venue']::TEXT[];

-- Step 3: Create unified entity_tag_votes table
CREATE TABLE IF NOT EXISTS entity_tag_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('venue', 'event', 'series', 'festival')),
  entity_id INTEGER NOT NULL,  -- References venue/event/series/festival id
  tag_definition_id UUID NOT NULL REFERENCES tag_definitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('confirm', 'deny')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (entity_type, entity_id, tag_definition_id, user_id)
);

-- Indexes for entity_tag_votes
CREATE INDEX IF NOT EXISTS idx_entity_tag_votes_entity ON entity_tag_votes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_tag_votes_tag ON entity_tag_votes(tag_definition_id);
CREATE INDEX IF NOT EXISTS idx_entity_tag_votes_user ON entity_tag_votes(user_id);

-- Step 4: Insert needs tag definitions
-- These tags are critical for accessibility, dietary, and family needs

-- Accessibility tags
INSERT INTO tag_definitions (slug, label, tag_group, entity_types, is_official, is_active) VALUES
('wheelchair-accessible', 'Wheelchair Accessible', 'accessibility', ARRAY['venue','event','series','festival'], TRUE, TRUE),
('elevator-access', 'Elevator Access', 'accessibility', ARRAY['venue','event'], TRUE, TRUE),
('hearing-loop', 'Hearing Loop', 'accessibility', ARRAY['venue','event'], TRUE, TRUE),
('asl-interpreted', 'ASL Interpreted', 'accessibility', ARRAY['event','series'], TRUE, TRUE),
('sensory-friendly', 'Sensory Friendly', 'accessibility', ARRAY['venue','event','festival'], TRUE, TRUE),
('service-animals-welcome', 'Service Animals Welcome', 'accessibility', ARRAY['venue','event','festival'], TRUE, TRUE),
('accessible-parking', 'Accessible Parking', 'accessibility', ARRAY['venue'], TRUE, TRUE),
('accessible-restroom', 'Accessible Restroom', 'accessibility', ARRAY['venue'], TRUE, TRUE)
ON CONFLICT (slug) DO UPDATE SET
  tag_group = EXCLUDED.tag_group,
  entity_types = EXCLUDED.entity_types;

-- Dietary tags
INSERT INTO tag_definitions (slug, label, tag_group, entity_types, is_official, is_active) VALUES
('gluten-free-options', 'Gluten-Free Options', 'dietary', ARRAY['venue','festival'], TRUE, TRUE),
('vegan-options', 'Vegan Options', 'dietary', ARRAY['venue','festival'], TRUE, TRUE),
('vegetarian-options', 'Vegetarian Options', 'dietary', ARRAY['venue','festival'], TRUE, TRUE),
('halal', 'Halal', 'dietary', ARRAY['venue','festival'], TRUE, TRUE),
('kosher', 'Kosher', 'dietary', ARRAY['venue','festival'], TRUE, TRUE),
('nut-free', 'Nut-Free', 'dietary', ARRAY['venue','festival'], TRUE, TRUE),
('dairy-free', 'Dairy-Free', 'dietary', ARRAY['venue','festival'], TRUE, TRUE),
('allergy-friendly-menu', 'Allergy-Friendly Menu', 'dietary', ARRAY['venue','festival'], TRUE, TRUE)
ON CONFLICT (slug) DO UPDATE SET
  tag_group = EXCLUDED.tag_group,
  entity_types = EXCLUDED.entity_types;

-- Family tags
INSERT INTO tag_definitions (slug, label, tag_group, entity_types, is_official, is_active) VALUES
('stroller-friendly', 'Stroller Friendly', 'family', ARRAY['venue','event','festival'], TRUE, TRUE),
('kid-friendly', 'Kid Friendly', 'family', ARRAY['venue','event','festival'], TRUE, TRUE),
('changing-table', 'Changing Table', 'family', ARRAY['venue'], TRUE, TRUE),
('nursing-room', 'Nursing Room', 'family', ARRAY['venue'], TRUE, TRUE),
('play-area', 'Play Area', 'family', ARRAY['venue'], TRUE, TRUE)
ON CONFLICT (slug) DO UPDATE SET
  tag_group = EXCLUDED.tag_group,
  entity_types = EXCLUDED.entity_types;

-- Step 5: Migrate existing venue_tag_votes to entity_tag_votes
-- Only if venue_tag_votes exists and hasn't been migrated yet
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'venue_tag_votes') THEN
    -- Migrate venue tags to entity_tag_votes
    INSERT INTO entity_tag_votes (entity_type, entity_id, tag_definition_id, user_id, vote, created_at)
    SELECT
      'venue' as entity_type,
      vt.venue_id as entity_id,
      vt.tag_id as tag_definition_id,
      vtv.user_id,
      CASE
        WHEN vtv.vote_type = 'up' THEN 'confirm'
        WHEN vtv.vote_type = 'down' THEN 'deny'
        ELSE 'confirm'
      END as vote,
      vtv.created_at
    FROM venue_tag_votes vtv
    JOIN venue_tags vt ON vt.id = vtv.venue_tag_id
    ON CONFLICT (entity_type, entity_id, tag_definition_id, user_id) DO NOTHING;
  END IF;
END $$;

-- Step 6: Migrate existing event_tag_votes to entity_tag_votes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_tag_votes') THEN
    -- Migrate event tags to entity_tag_votes
    INSERT INTO entity_tag_votes (entity_type, entity_id, tag_definition_id, user_id, vote, created_at)
    SELECT
      'event' as entity_type,
      et.event_id as entity_id,
      et.tag_id as tag_definition_id,
      etv.user_id,
      CASE
        WHEN etv.vote_type = 'up' THEN 'confirm'
        WHEN etv.vote_type = 'down' THEN 'deny'
        ELSE 'confirm'
      END as vote,
      etv.created_at
    FROM event_tag_votes etv
    JOIN event_tags et ON et.id = etv.event_tag_id
    ON CONFLICT (entity_type, entity_id, tag_definition_id, user_id) DO NOTHING;
  END IF;
END $$;

-- Step 7: Create materialized view for tag vote summaries
DROP MATERIALIZED VIEW IF EXISTS entity_tag_summary;

CREATE MATERIALIZED VIEW entity_tag_summary AS
SELECT
  etv.entity_type,
  etv.entity_id,
  td.id AS tag_id,
  td.slug AS tag_slug,
  td.label AS tag_label,
  td.tag_group,
  td.entity_types,
  td.is_official,
  COUNT(*) FILTER (WHERE etv.vote = 'confirm') AS confirm_count,
  COUNT(*) FILTER (WHERE etv.vote = 'deny') AS deny_count,
  COUNT(*) FILTER (WHERE etv.vote = 'confirm') - COUNT(*) FILTER (WHERE etv.vote = 'deny') AS score
FROM entity_tag_votes etv
JOIN tag_definitions td ON td.id = etv.tag_definition_id
WHERE td.is_active = TRUE
  AND td.entity_types @> ARRAY[etv.entity_type]
GROUP BY etv.entity_type, etv.entity_id, td.id, td.slug, td.label, td.tag_group, td.entity_types, td.is_official;

-- Indexes on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_tag_summary_pk ON entity_tag_summary(entity_type, entity_id, tag_id);
CREATE INDEX IF NOT EXISTS idx_entity_tag_summary_entity ON entity_tag_summary(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_tag_summary_score ON entity_tag_summary(entity_type, entity_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_entity_tag_summary_tag_group ON entity_tag_summary(tag_group);

-- Step 8: RLS policies for entity_tag_votes
ALTER TABLE entity_tag_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view entity tag votes" ON entity_tag_votes;
CREATE POLICY "Anyone can view entity tag votes"
  ON entity_tag_votes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can vote on entity tags" ON entity_tag_votes;
CREATE POLICY "Authenticated users can vote on entity tags"
  ON entity_tag_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their entity tag votes" ON entity_tag_votes;
CREATE POLICY "Users can update their entity tag votes"
  ON entity_tag_votes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their entity tag votes" ON entity_tag_votes;
CREATE POLICY "Users can delete their entity tag votes"
  ON entity_tag_votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Step 9: Grant access to materialized view
GRANT SELECT ON entity_tag_summary TO anon, authenticated;

-- Step 10: Add trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_entity_tag_votes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_entity_tag_votes_updated_at ON entity_tag_votes;
CREATE TRIGGER trigger_entity_tag_votes_updated_at
  BEFORE UPDATE ON entity_tag_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_entity_tag_votes_updated_at();

-- Step 11: Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_entity_tag_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY entity_tag_summary;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE entity_tag_votes IS 'Community tag votes across all entity types (venues, events, series, festivals)';
COMMENT ON MATERIALIZED VIEW entity_tag_summary IS 'Aggregated tag vote counts per entity. Refresh every 5 minutes via cron.';
COMMENT ON COLUMN entity_tag_votes.vote IS 'confirm = upvote/agree, deny = downvote/disagree';
