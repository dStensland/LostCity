-- ============================================
-- MIGRATION 20260315223000: Move Family ownership from hooky to atlanta-families
-- ============================================
-- Hooky is a retired Family slug. Atlanta Families is the canonical Family portal.
-- This migration moves source ownership, content attribution, subscriptions,
-- and Family interest channels onto atlanta-families, while merging duplicate
-- subscription rows that already exist for both portals.

DO $$
DECLARE
  hooky_id UUID;
  atlanta_families_id UUID;
BEGIN
  SELECT id INTO hooky_id
  FROM portals
  WHERE slug = 'hooky';

  SELECT id INTO atlanta_families_id
  FROM portals
  WHERE slug = 'atlanta-families';

  IF hooky_id IS NULL THEN
    RAISE EXCEPTION 'hooky portal not found';
  END IF;

  IF atlanta_families_id IS NULL THEN
    RAISE EXCEPTION 'atlanta-families portal not found';
  END IF;

  WITH overlapping_subscriptions AS (
    SELECT
      hooky.id AS hooky_subscription_id,
      family.id AS family_subscription_id,
      hooky.subscription_scope AS hooky_scope,
      family.subscription_scope AS family_scope,
      hooky.subscribed_categories AS hooky_categories,
      family.subscribed_categories AS family_categories,
      hooky.subscribed_entity_families AS hooky_entity_families,
      family.subscribed_entity_families AS family_entity_families
    FROM source_subscriptions AS hooky
    INNER JOIN source_subscriptions AS family
      ON family.source_id = hooky.source_id
     AND family.subscriber_portal_id = atlanta_families_id
    WHERE hooky.subscriber_portal_id = hooky_id
  ),
  merged_subscription_values AS (
    SELECT
      overlap_rows.hooky_subscription_id,
      overlap_rows.family_subscription_id,
      CASE
        WHEN overlap_rows.hooky_scope = 'all' OR overlap_rows.family_scope = 'all' THEN 'all'
        ELSE 'selected'
      END AS merged_scope,
      (
        SELECT CASE
          WHEN COUNT(value) = 0 THEN NULL
          ELSE ARRAY_AGG(DISTINCT value ORDER BY value)
        END
        FROM unnest(
          COALESCE(overlap_rows.family_categories, ARRAY[]::TEXT[])
          || COALESCE(overlap_rows.hooky_categories, ARRAY[]::TEXT[])
        ) AS value
      ) AS merged_categories,
      (
        SELECT CASE
          WHEN COUNT(value) = 0 THEN ARRAY['events']::TEXT[]
          ELSE ARRAY_AGG(DISTINCT value ORDER BY value)
        END
        FROM unnest(
          COALESCE(overlap_rows.family_entity_families, ARRAY[]::TEXT[])
          || COALESCE(overlap_rows.hooky_entity_families, ARRAY[]::TEXT[])
        ) AS value
      ) AS merged_entity_families
    FROM overlapping_subscriptions AS overlap_rows
  ),
  merged_subscriptions AS (
    UPDATE source_subscriptions AS family
    SET subscription_scope = merged.merged_scope,
        subscribed_categories = merged.merged_categories,
        subscribed_entity_families = merged.merged_entity_families
    FROM merged_subscription_values AS merged
    WHERE family.id = merged.family_subscription_id
    RETURNING merged.hooky_subscription_id
  )
  DELETE FROM source_subscriptions
  WHERE id IN (
    SELECT hooky_subscription_id
    FROM merged_subscriptions
  );

  UPDATE source_subscriptions
  SET subscriber_portal_id = atlanta_families_id
  WHERE subscriber_portal_id = hooky_id;

  UPDATE source_sharing_rules
  SET owner_portal_id = atlanta_families_id
  WHERE owner_portal_id = hooky_id;

  UPDATE sources
  SET owner_portal_id = atlanta_families_id
  WHERE owner_portal_id = hooky_id;

  UPDATE events
  SET portal_id = atlanta_families_id
  WHERE portal_id = hooky_id;

  UPDATE programs
  SET portal_id = atlanta_families_id
  WHERE portal_id = hooky_id;

  UPDATE interest_channels
  SET portal_id = atlanta_families_id,
      slug = regexp_replace(slug, '^hooky-', 'atlanta-families-')
  WHERE portal_id = hooky_id;
END $$;

REFRESH MATERIALIZED VIEW portal_source_access;
REFRESH MATERIALIZED VIEW portal_source_entity_access;
