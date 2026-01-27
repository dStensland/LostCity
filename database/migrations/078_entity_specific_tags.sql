-- Migration: Entity-Specific Tags with Tag Groups
-- Adds entity_type to tag definitions, renames category to tag_group
-- Reseeds with curated tags for venues, events, and orgs

-- Step 1: Add entity_type column
ALTER TABLE venue_tag_definitions
ADD COLUMN IF NOT EXISTS entity_type TEXT DEFAULT 'venue'
CHECK (entity_type IN ('venue', 'event', 'org'));

-- Step 2: Rename category to tag_group
ALTER TABLE venue_tag_definitions
RENAME COLUMN category TO tag_group;

-- Step 3: Update the suggestions table too
ALTER TABLE venue_tag_suggestions
RENAME COLUMN suggested_category TO suggested_tag_group;

-- Step 4: Drop and recreate the materialized view with new column names
DROP MATERIALIZED VIEW IF EXISTS venue_tag_summary;

CREATE MATERIALIZED VIEW venue_tag_summary AS
SELECT
  vt.venue_id,
  vtd.id AS tag_id,
  vtd.slug AS tag_slug,
  vtd.label AS tag_label,
  vtd.tag_group,
  vtd.entity_type,
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
WHERE vtd.is_active = TRUE AND vtd.entity_type = 'venue'
GROUP BY vt.venue_id, vtd.id, vtd.slug, vtd.label, vtd.tag_group, vtd.entity_type, vtd.is_official;

-- Recreate indexes on materialized view
CREATE UNIQUE INDEX idx_venue_tag_summary_pk ON venue_tag_summary(venue_id, tag_id);
CREATE INDEX idx_venue_tag_summary_venue ON venue_tag_summary(venue_id);
CREATE INDEX idx_venue_tag_summary_score ON venue_tag_summary(venue_id, score DESC);

-- Step 5: Add index for entity_type lookups
CREATE INDEX IF NOT EXISTS idx_venue_tag_definitions_entity_type ON venue_tag_definitions(entity_type);

-- Step 6: Clear existing tags and reseed
DELETE FROM venue_tags;
DELETE FROM venue_tag_definitions;

-- ===================
-- VENUE TAGS
-- ===================

INSERT INTO venue_tag_definitions (slug, label, tag_group, entity_type, is_official, is_active) VALUES
-- Vibes
('hidden-gem', 'Hidden Gem', 'vibes', 'venue', TRUE, TRUE),
('neighborhood-spot', 'Neighborhood Spot', 'vibes', 'venue', TRUE, TRUE),
('cozy', 'Cozy', 'vibes', 'venue', TRUE, TRUE),
('lively', 'Lively', 'vibes', 'venue', TRUE, TRUE),
('romantic', 'Romantic', 'vibes', 'venue', TRUE, TRUE),
('unpretentious', 'Unpretentious', 'vibes', 'venue', TRUE, TRUE),

-- Amenities
('dog-friendly', 'Dog Friendly', 'amenities', 'venue', TRUE, TRUE),
('free-wifi', 'Free WiFi', 'amenities', 'venue', TRUE, TRUE),
('open-late', 'Open Late', 'amenities', 'venue', TRUE, TRUE),
('patio', 'Patio', 'amenities', 'venue', TRUE, TRUE),
('parking', 'Parking', 'amenities', 'venue', TRUE, TRUE),
('walk-ins-ok', 'Walk-Ins OK', 'amenities', 'venue', TRUE, TRUE),

-- Good For
('dates', 'Dates', 'good_for', 'venue', TRUE, TRUE),
('groups', 'Groups', 'good_for', 'venue', TRUE, TRUE),
('solo', 'Solo', 'good_for', 'venue', TRUE, TRUE),
('working', 'Working', 'good_for', 'venue', TRUE, TRUE),
('catching-up', 'Catching Up', 'good_for', 'venue', TRUE, TRUE),
('meeting-people', 'Meeting People', 'good_for', 'venue', TRUE, TRUE),

-- Accessibility
('wheelchair-accessible', 'Wheelchair Accessible', 'accessibility', 'venue', TRUE, TRUE),
('gender-neutral-restrooms', 'Gender Neutral Restrooms', 'accessibility', 'venue', TRUE, TRUE),
('quiet-space', 'Quiet Space', 'accessibility', 'venue', TRUE, TRUE),

-- Heads Up
('sketchy', 'Sketchy', 'heads_up', 'venue', TRUE, TRUE),
('hard-to-find', 'Hard to Find', 'heads_up', 'venue', TRUE, TRUE),
('no-parking', 'No Parking', 'heads_up', 'venue', TRUE, TRUE),
('loud', 'Loud', 'heads_up', 'venue', TRUE, TRUE),
('crowded', 'Crowded', 'heads_up', 'venue', TRUE, TRUE),
('slow-service', 'Slow Service', 'heads_up', 'venue', TRUE, TRUE),
('overpriced', 'Overpriced', 'heads_up', 'venue', TRUE, TRUE),
('cash-only', 'Cash Only', 'heads_up', 'venue', TRUE, TRUE),
('tourist-trap', 'Tourist Trap', 'heads_up', 'venue', TRUE, TRUE);

-- ===================
-- EVENT TAGS
-- ===================

INSERT INTO venue_tag_definitions (slug, label, tag_group, entity_type, is_official, is_active) VALUES
-- Audience
('21-plus', '21+', 'audience', 'event', TRUE, TRUE),
('all-ages', 'All Ages', 'audience', 'event', TRUE, TRUE),
('kid-friendly', 'Kid Friendly', 'audience', 'event', TRUE, TRUE),
('beginners-welcome', 'Beginners Welcome', 'audience', 'event', TRUE, TRUE),
('some-experience-needed', 'Some Experience Needed', 'audience', 'event', TRUE, TRUE),

-- Social
('date-night', 'Date Night', 'social', 'event', TRUE, TRUE),
('bring-friends', 'Bring Friends', 'social', 'event', TRUE, TRUE),
('good-solo', 'Good Solo', 'social', 'event', TRUE, TRUE),
('easy-to-meet-people', 'Easy to Meet People', 'social', 'event', TRUE, TRUE),
('regulars-scene', 'Regulars Scene', 'social', 'event', TRUE, TRUE),

-- Vibe
('casual', 'Casual', 'vibe', 'event', TRUE, TRUE),
('dressy', 'Dressy', 'vibe', 'event', TRUE, TRUE),
('high-energy', 'High Energy', 'vibe', 'event', TRUE, TRUE),
('chill', 'Chill', 'vibe', 'event', TRUE, TRUE),
('hands-on', 'Hands-On', 'vibe', 'event', TRUE, TRUE),
('competitive', 'Competitive', 'vibe', 'event', TRUE, TRUE),

-- Format
('drop-in', 'Drop-In', 'format', 'event', TRUE, TRUE),
('rsvp-required', 'RSVP Required', 'format', 'event', TRUE, TRUE),
('recurring', 'Recurring', 'format', 'event', TRUE, TRUE),
('one-time', 'One-Time', 'format', 'event', TRUE, TRUE),
('workshop', 'Workshop', 'format', 'event', TRUE, TRUE),

-- Practical
('easy-parking', 'Easy Parking', 'practical', 'event', TRUE, TRUE),
('outdoor', 'Outdoor', 'practical', 'event', TRUE, TRUE),
('standing', 'Standing', 'practical', 'event', TRUE, TRUE),
('seated', 'Seated', 'practical', 'event', TRUE, TRUE),
('food-available', 'Food Available', 'practical', 'event', TRUE, TRUE),
('event-cash-only', 'Cash Only', 'practical', 'event', TRUE, TRUE),
('byob', 'BYOB', 'practical', 'event', TRUE, TRUE),

-- Heads Up
('event-crowded', 'Crowded', 'heads_up', 'event', TRUE, TRUE),
('long-lines', 'Long Lines', 'heads_up', 'event', TRUE, TRUE),
('sells-out-fast', 'Sells Out Fast', 'heads_up', 'event', TRUE, TRUE),
('event-loud', 'Loud', 'heads_up', 'event', TRUE, TRUE),
('starts-late', 'Starts Late', 'heads_up', 'event', TRUE, TRUE),
('hard-to-park', 'Hard to Park', 'heads_up', 'event', TRUE, TRUE),
('sweaty', 'Sweaty', 'heads_up', 'event', TRUE, TRUE);

-- ===================
-- ORGANIZATION TAGS
-- ===================

INSERT INTO venue_tag_definitions (slug, label, tag_group, entity_type, is_official, is_active) VALUES
-- Values
('lgbtq-friendly', 'LGBTQ+ Friendly', 'values', 'org', TRUE, TRUE),
('family-friendly', 'Family Friendly', 'values', 'org', TRUE, TRUE),
('all-skill-levels', 'All Skill Levels', 'values', 'org', TRUE, TRUE),
('welcoming', 'Welcoming', 'values', 'org', TRUE, TRUE),

-- Structure
('volunteer-run', 'Volunteer-Run', 'structure', 'org', TRUE, TRUE),
('nonprofit', 'Nonprofit', 'structure', 'org', TRUE, TRUE),
('membership-available', 'Membership Available', 'structure', 'org', TRUE, TRUE),
('sliding-scale', 'Sliding Scale', 'structure', 'org', TRUE, TRUE),

-- Engagement
('volunteer-opportunities', 'Volunteer Opportunities', 'engagement', 'org', TRUE, TRUE),
('free-events', 'Free Events', 'engagement', 'org', TRUE, TRUE),
('open-to-public', 'Open to Public', 'engagement', 'org', TRUE, TRUE),
('meets-regularly', 'Meets Regularly', 'engagement', 'org', TRUE, TRUE),
('drop-ins-ok', 'Drop-Ins OK', 'engagement', 'org', TRUE, TRUE),
('new-faces-welcome', 'New Faces Welcome', 'engagement', 'org', TRUE, TRUE),

-- Heads Up
('cliquey', 'Cliquey', 'heads_up', 'org', TRUE, TRUE),
('disorganized', 'Disorganized', 'heads_up', 'org', TRUE, TRUE),
('hard-to-break-into', 'Hard to Break Into', 'heads_up', 'org', TRUE, TRUE),
('costs-money', 'Costs Money', 'heads_up', 'org', TRUE, TRUE);

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW venue_tag_summary;

-- Grant access
GRANT SELECT ON venue_tag_summary TO anon, authenticated;
