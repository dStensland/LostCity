-- Migration 509: remove the generic "opportunities" family from federation
--
-- Runtime taxonomy now uses concrete families like `open_calls` and
-- `volunteer_opportunities`, so the federation storage layer should not keep
-- materializing a phantom umbrella family.

UPDATE source_sharing_rules
SET shared_entity_families = array_remove(shared_entity_families, 'opportunities')
WHERE shared_entity_families @> ARRAY['opportunities']::TEXT[];

UPDATE source_subscriptions
SET subscribed_entity_families = array_remove(subscribed_entity_families, 'opportunities')
WHERE subscribed_entity_families @> ARRAY['opportunities']::TEXT[];

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
    ('venue_occasions')
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
