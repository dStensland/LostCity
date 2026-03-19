-- ============================================
-- MIGRATION 520: Add YMCA and Callanwolde to Lost Youth (atlanta-families) portal
-- ============================================
-- Subscribes the atlanta-families portal to two high-value family sources
-- that were not previously subscribed:
--
--   YMCA (source_id 298, slug: ymca-atlanta)
--     - 22 branches across metro Atlanta
--     - Swim lessons, youth sports, camps, fitness classes
--     - Owner: stays with current owner portal (probably atlanta or a
--       support hub) — YMCA events should appear in BOTH Atlanta and
--       Family portals. We only add a subscription, not change ownership.
--     - Rationale: YMCA is one of the most important family program
--       providers in Atlanta. Spring break = peak YMCA camp season.
--
--   Callanwolde Fine Arts Center (source_id 809, slug: callanwolde)
--     - 1,300+ events/programs per year: arts classes, summer camps,
--       concerts, community events
--     - Owner: stays with current owner (atlanta)
--     - Already listed in migration 324 (hooky source federation list)
--       but may not have been subscribed if source_id 809 was not active
--       at that time, or if the 324 DO block skipped inactive sources.
--     - Rationale: Callanwolde is a cornerstone of Atlanta's family arts
--       education. Classes and camps belong in the family feed.
--
-- Portal identity note:
--   Slug: 'atlanta-families' (canonical name, post-migration 515)
--   ID:   840edaab-ab97-4f15-9dca-fe8dd2101ec3
--
-- These sources remain owned by their current portals. The subscription
-- grants the family portal read access without changing the data ownership
-- or attribution chain.

DO $$
DECLARE
  family_portal_id UUID;
  src              RECORD;
  new_source_slugs TEXT[] := ARRAY[
    'ymca-atlanta',
    'callanwolde'
  ];
BEGIN
  SELECT id INTO family_portal_id
  FROM portals
  WHERE slug = 'atlanta-families';

  IF family_portal_id IS NULL THEN
    RAISE EXCEPTION 'atlanta-families portal not found. Run migrations 322 and 515 first.';
  END IF;

  -- Ensure source_sharing_rules exist for each source.
  -- Most sources already have sharing rules from earlier migrations,
  -- but we guard with ON CONFLICT DO NOTHING.
  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  SELECT s.id, s.owner_portal_id, 'all'
  FROM sources s
  WHERE s.slug = ANY(new_source_slugs)
    AND s.is_active = true
    AND s.owner_portal_id IS NOT NULL
  ON CONFLICT (source_id) DO NOTHING;

  -- Subscribe atlanta-families to each source.
  -- Uses ON CONFLICT DO UPDATE so the migration is idempotent if run again.
  INSERT INTO source_subscriptions (
    subscriber_portal_id,
    source_id,
    subscription_scope,
    is_active
  )
  SELECT
    family_portal_id,
    s.id,
    'all',
    true
  FROM sources s
  WHERE s.slug = ANY(new_source_slugs)
    AND s.is_active = true
  ON CONFLICT (subscriber_portal_id, source_id)
  DO UPDATE SET
    subscription_scope = 'all',
    is_active          = true;

  -- Log which sources were processed and flag any that are missing/inactive
  FOR src IN
    SELECT s.id, s.slug, s.name, s.is_active
    FROM sources s
    WHERE s.slug = ANY(new_source_slugs)
  LOOP
    IF src.is_active THEN
      RAISE NOTICE 'Subscribed atlanta-families to source: % (%)', src.slug, src.name;
    ELSE
      RAISE NOTICE 'SKIPPED (inactive): % (%)', src.slug, src.name;
    END IF;
  END LOOP;

  -- Flag any requested slugs not found in the database at all
  FOR src IN
    SELECT unnest(new_source_slugs) AS slug
    EXCEPT
    SELECT slug FROM sources WHERE slug = ANY(new_source_slugs)
  LOOP
    RAISE NOTICE 'NOT FOUND in sources table: %', src.slug;
  END LOOP;

END $$;

-- Refresh the portal_source_access materialized view so the family
-- portal feed immediately picks up the newly subscribed sources.
-- CONCURRENTLY avoids locking the view for reads during refresh.
REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;

-- Verification query (run after migration to confirm):
-- SELECT s.slug, s.name, s.is_active, ss.subscription_scope
-- FROM source_subscriptions ss
-- JOIN sources s ON ss.source_id = s.id
-- WHERE ss.subscriber_portal_id = (SELECT id FROM portals WHERE slug = 'atlanta-families')
--   AND s.slug IN ('ymca-atlanta', 'callanwolde')
-- ORDER BY s.slug;
