-- Portal Attribution Hardening Phase 2
-- Add portal_id to 3 additional tables (recommendations, entity_tag_votes, venue_claims)
-- and extend the audit view to cover all 10 attributed tables.

-- 1. recommendations: Track which portal a user recommendation originated from
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS portal_id UUID REFERENCES portals(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_recommendations_portal ON recommendations(portal_id) WHERE portal_id IS NOT NULL;

-- 2. entity_tag_votes: Track portal context for community tag votes
ALTER TABLE entity_tag_votes ADD COLUMN IF NOT EXISTS portal_id UUID REFERENCES portals(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_entity_tag_votes_portal ON entity_tag_votes(portal_id) WHERE portal_id IS NOT NULL;

-- 3. venue_claims: Track which portal a venue claim was submitted from
ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS portal_id UUID REFERENCES portals(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_venue_claims_portal ON venue_claims(portal_id) WHERE portal_id IS NOT NULL;

-- 4. Replace audit view to cover all 10 attributed tables
CREATE OR REPLACE VIEW portal_attribution_audit AS
SELECT 'inferred_preferences' AS table_name,
       COUNT(*) FILTER (WHERE portal_id IS NULL) AS missing_portal,
       COUNT(*) AS total,
       ROUND(100.0 * COUNT(*) FILTER (WHERE portal_id IS NULL) / GREATEST(COUNT(*), 1), 1) AS pct_missing
FROM inferred_preferences
WHERE created_at > NOW() - INTERVAL '7 days'

UNION ALL

SELECT 'event_rsvps',
       COUNT(*) FILTER (WHERE portal_id IS NULL),
       COUNT(*),
       ROUND(100.0 * COUNT(*) FILTER (WHERE portal_id IS NULL) / GREATEST(COUNT(*), 1), 1)
FROM event_rsvps
WHERE created_at > NOW() - INTERVAL '7 days'

UNION ALL

SELECT 'saved_items',
       COUNT(*) FILTER (WHERE portal_id IS NULL),
       COUNT(*),
       ROUND(100.0 * COUNT(*) FILTER (WHERE portal_id IS NULL) / GREATEST(COUNT(*), 1), 1)
FROM saved_items
WHERE created_at > NOW() - INTERVAL '7 days'

UNION ALL

SELECT 'follows',
       COUNT(*) FILTER (WHERE portal_id IS NULL),
       COUNT(*),
       ROUND(100.0 * COUNT(*) FILTER (WHERE portal_id IS NULL) / GREATEST(COUNT(*), 1), 1)
FROM follows
WHERE created_at > NOW() - INTERVAL '7 days'

UNION ALL

SELECT 'hidden_events',
       COUNT(*) FILTER (WHERE portal_id IS NULL),
       COUNT(*),
       ROUND(100.0 * COUNT(*) FILTER (WHERE portal_id IS NULL) / GREATEST(COUNT(*), 1), 1)
FROM hidden_events
WHERE created_at > NOW() - INTERVAL '7 days'

UNION ALL

SELECT 'activities',
       COUNT(*) FILTER (WHERE portal_id IS NULL),
       COUNT(*),
       ROUND(100.0 * COUNT(*) FILTER (WHERE portal_id IS NULL) / GREATEST(COUNT(*), 1), 1)
FROM activities
WHERE created_at > NOW() - INTERVAL '7 days'

UNION ALL

SELECT 'activity_reactions',
       COUNT(*) FILTER (WHERE portal_id IS NULL),
       COUNT(*),
       ROUND(100.0 * COUNT(*) FILTER (WHERE portal_id IS NULL) / GREATEST(COUNT(*), 1), 1)
FROM activity_reactions
WHERE created_at > NOW() - INTERVAL '7 days'

UNION ALL

SELECT 'recommendations',
       COUNT(*) FILTER (WHERE portal_id IS NULL),
       COUNT(*),
       ROUND(100.0 * COUNT(*) FILTER (WHERE portal_id IS NULL) / GREATEST(COUNT(*), 1), 1)
FROM recommendations
WHERE created_at > NOW() - INTERVAL '7 days'

UNION ALL

SELECT 'entity_tag_votes',
       COUNT(*) FILTER (WHERE portal_id IS NULL),
       COUNT(*),
       ROUND(100.0 * COUNT(*) FILTER (WHERE portal_id IS NULL) / GREATEST(COUNT(*), 1), 1)
FROM entity_tag_votes
WHERE created_at > NOW() - INTERVAL '7 days'

UNION ALL

SELECT 'venue_claims',
       COUNT(*) FILTER (WHERE portal_id IS NULL),
       COUNT(*),
       ROUND(100.0 * COUNT(*) FILTER (WHERE portal_id IS NULL) / GREATEST(COUNT(*), 1), 1)
FROM venue_claims
WHERE created_at > NOW() - INTERVAL '7 days';
