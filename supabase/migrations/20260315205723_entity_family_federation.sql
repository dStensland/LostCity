-- Entity-family-aware federation for non-event content
--
-- Extends the source federation model so portals can subscribe to events from
-- a source without automatically inheriting every other entity family that
-- source may emit. Events continue to use the existing category-aware
-- portal_source_access view. Non-event families are surfaced through the new
-- portal_source_entity_access materialized view.

ALTER TABLE source_sharing_rules
ADD COLUMN IF NOT EXISTS shared_entity_families TEXT[] NOT NULL DEFAULT ARRAY['events'];

ALTER TABLE source_subscriptions
ADD COLUMN IF NOT EXISTS subscribed_entity_families TEXT[] NOT NULL DEFAULT ARRAY['events'];

COMMENT ON COLUMN source_sharing_rules.shared_entity_families IS
  'Entity families shared from this source. Events remain governed by share_scope/allowed_categories; non-event families require explicit inclusion.';

COMMENT ON COLUMN source_subscriptions.subscribed_entity_families IS
  'Entity families a portal receives from a subscribed source. Events remain governed by subscription_scope/subscribed_categories.';

UPDATE source_sharing_rules
SET shared_entity_families = ARRAY['events']
WHERE shared_entity_families IS NULL;

UPDATE source_subscriptions
SET subscribed_entity_families = ARRAY['events']
WHERE subscribed_entity_families IS NULL;

WITH portal_entity_defaults AS (
  SELECT
    id,
    CASE slug
      WHEN 'atlanta' THEN ARRAY[
        'events',
        'programs',
        'exhibitions',
        'open_calls',
        'volunteer_opportunities',
        'games',
        'destinations',
        'destination_details',
        'venue_specials',
        'editorial_mentions',
        'venue_occasions',
        'opportunities'
      ]::TEXT[]
      WHEN 'hooky' THEN ARRAY['events', 'programs']::TEXT[]
      WHEN 'arts-atlanta' THEN ARRAY['events', 'exhibitions', 'open_calls']::TEXT[]
      WHEN 'helpatl' THEN ARRAY['events', 'volunteer_opportunities', 'opportunities']::TEXT[]
      WHEN 'yonder' THEN ARRAY[
        'events',
        'destinations',
        'destination_details',
        'venue_specials',
        'editorial_mentions',
        'venue_occasions'
      ]::TEXT[]
      WHEN 'forth' THEN ARRAY['events', 'destinations', 'venue_specials']::TEXT[]
      ELSE ARRAY['events']::TEXT[]
    END AS families
  FROM portals
)
UPDATE source_sharing_rules AS rule
SET shared_entity_families = defaults.families
FROM portal_entity_defaults AS defaults
WHERE defaults.id = rule.owner_portal_id;

WITH portal_entity_defaults AS (
  SELECT
    id,
    CASE slug
      WHEN 'atlanta' THEN ARRAY[
        'events',
        'programs',
        'exhibitions',
        'open_calls',
        'volunteer_opportunities',
        'games',
        'destinations',
        'destination_details',
        'venue_specials',
        'editorial_mentions',
        'venue_occasions',
        'opportunities'
      ]::TEXT[]
      WHEN 'hooky' THEN ARRAY['events', 'programs']::TEXT[]
      WHEN 'arts-atlanta' THEN ARRAY['events', 'exhibitions', 'open_calls']::TEXT[]
      WHEN 'helpatl' THEN ARRAY['events', 'volunteer_opportunities', 'opportunities']::TEXT[]
      WHEN 'yonder' THEN ARRAY[
        'events',
        'destinations',
        'destination_details',
        'venue_specials',
        'editorial_mentions',
        'venue_occasions'
      ]::TEXT[]
      WHEN 'forth' THEN ARRAY['events', 'destinations', 'venue_specials']::TEXT[]
      ELSE ARRAY['events']::TEXT[]
    END AS families
  FROM portals
)
UPDATE source_subscriptions AS sub
SET subscribed_entity_families = defaults.families
FROM portal_entity_defaults AS defaults
WHERE defaults.id = sub.subscriber_portal_id;

DROP MATERIALIZED VIEW IF EXISTS portal_source_entity_access;

CREATE MATERIALIZED VIEW portal_source_entity_access AS
WITH entity_families(entity_family) AS (
  VALUES
    ('programs'),
    ('exhibitions'),
    ('open_calls'),
    ('volunteer_opportunities'),
    ('games'),
    ('destinations'),
    ('destination_details'),
    ('venue_specials'),
    ('editorial_mentions'),
    ('venue_occasions'),
    ('opportunities')
)
SELECT DISTINCT
  p.id AS portal_id,
  s.id AS source_id,
  s.name AS source_name,
  entity_families.entity_family,
  CASE
    WHEN s.owner_portal_id = p.id THEN 'owner'
    WHEN s.owner_portal_id IS NULL THEN 'global'
    ELSE 'subscription'
  END AS access_type
FROM portals AS p
CROSS JOIN sources AS s
CROSS JOIN entity_families
LEFT JOIN source_subscriptions AS sub
  ON sub.subscriber_portal_id = p.id
  AND sub.source_id = s.id
  AND sub.is_active = true
LEFT JOIN source_sharing_rules AS rule
  ON rule.source_id = s.id
WHERE
  s.is_active = true
  AND (
    s.owner_portal_id = p.id
    OR s.owner_portal_id IS NULL
    OR (
      sub.id IS NOT NULL
      AND COALESCE(rule.share_scope, 'none') != 'none'
      AND COALESCE(rule.shared_entity_families, ARRAY['events']::TEXT[]) @> ARRAY[entity_families.entity_family]::TEXT[]
      AND COALESCE(sub.subscribed_entity_families, ARRAY['events']::TEXT[]) @> ARRAY[entity_families.entity_family]::TEXT[]
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_source_entity_access_pk
  ON portal_source_entity_access(portal_id, source_id, entity_family);
CREATE INDEX IF NOT EXISTS idx_portal_source_entity_access_portal
  ON portal_source_entity_access(portal_id, entity_family);
CREATE INDEX IF NOT EXISTS idx_portal_source_entity_access_source
  ON portal_source_entity_access(source_id, entity_family);

COMMENT ON MATERIALIZED VIEW portal_source_entity_access IS
  'Pre-computed portal-to-source access for non-event entity families.';

CREATE OR REPLACE FUNCTION refresh_portal_source_access()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
  REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_entity_access;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_refresh_portal_source_access()
RETURNS trigger AS $$
BEGIN
  PERFORM refresh_portal_source_access();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
