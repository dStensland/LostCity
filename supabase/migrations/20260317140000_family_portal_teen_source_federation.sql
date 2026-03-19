-- ============================================
-- Family Portal: Teen-Relevant Source Federation Audit
-- ============================================
-- Audit date: 2026-03-17
-- Audited 13 sources flagged as teen-relevant by plan-agent.
-- This migration adds the 4 entertainment destination-sources that
-- are active and NOT yet in the family portal's source_subscriptions.
--
-- AUDIT FINDINGS:
--
-- ALREADY FEDERATED (source_subscriptions exists):
--   pebble-tossers (1322)        — 24 upcoming events, clean
--   spruill-center-for-the-arts (808) — 349 upcoming events, clean
--   painted-duck (177)           — 16 upcoming events, ALL TAGGED '21+'
--     NOTE: Painted Duck events are adult leagues (bowling, bocce). They
--     carry the '21+' tag. The family portal's exclude_adult filter gates
--     these out of the feed — federation is harmless but produces no visible
--     teen content. Left as-is; not modified.
--   dads-garage-camps (1410)     — 18 upcoming events, clean (owned by family portal)
--   kid-chess (1402)             — 8 upcoming events, clean (owned by family portal)
--
-- ACTIVE, PRODUCING EVENTS → ADD TO FAMILY:
--   (none of the 4 entertainment venues produce events — they are destination-only
--    crawlers that return (0,0,0) intentionally. But federating them lets the
--    family portal discover their venue records and include them in destination
--    searches and "what to do with kids" contexts.)
--
-- ACTIVE, 0 EVENTS (destination-only crawlers — add for venue discoverability):
--   escape-game-atlanta (1572)   — No event calendar; venue record is the value.
--   andretti-indoor-karting-atlanta (1571) — No event calendar; venue record only.
--   round-1-arcade-alpharetta (1575) — No event calendar; venue record only.
--   topgolf-atlanta-midtown (1570) — No event calendar; venue record only.
--
-- CONTENT SAFETY:
--   All 4 entertainment venues are all-ages family destinations with no
--   adult content. No 21+ tags in any past events. Safe to federate.
--
-- INACTIVE / NO EVENTS — NOT FEDERATED:
--   sky-zone-atlanta (417)       — Inactive; crawled 2026-02-07; 0 events.
--   urban-air-atlanta (416)      — Inactive; crawled 2026-03-02; 0 events.
--   defy-atlanta (415)           — Inactive; crawled 2026-02-07; 0 events.
--   bgc-atlanta (954)            — Inactive; 0 events total.
--   (These sources are deactivated. Recommend crawler-dev investigation.)
--
-- MISSING FROM DB ENTIRELY:
--   andretti_karting slug variant — found as 'andretti-indoor-karting-atlanta'
--   round_1_arcade slug variant   — found as 'round-1-arcade-alpharetta'
--   topgolf_atlanta slug variant  — found as 'topgolf-atlanta-midtown'
--
-- TEEN PROGRAM COVERAGE NOTE:
--   Current family portal has 38 events with age_min >= 14. The gap is a
--   CRAWLER PROBLEM, not a federation problem. These entertainment venues
--   don't publish event calendars. Teen coverage requires:
--   (a) Reactivating urban-air, sky-zone, defy if they now have content
--   (b) Adding YMCA teen programs, Boys & Girls Club once crawlers are fixed
--   (c) Sourcing after-school program data (bgc-atlanta crawler needs fixing)
-- ============================================

DO $$
DECLARE
  family_id  UUID;
  src        RECORD;

  -- 4 entertainment destination-sources to add.
  -- All active, all-ages, destination-only crawlers (no event calendar).
  -- Federation gives the family portal access to their enriched venue records.
  new_slugs TEXT[] := ARRAY[
    'escape-game-atlanta',
    'andretti-indoor-karting-atlanta',
    'round-1-arcade-alpharetta',
    'topgolf-atlanta-midtown'
  ];

BEGIN
  SELECT id INTO family_id FROM portals WHERE slug = 'atlanta-families';

  IF family_id IS NULL THEN
    RAISE EXCEPTION 'atlanta-families portal not found.';
  END IF;

  -- 1. Ensure sharing rules exist for all 4 sources.
  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  SELECT s.id, s.owner_portal_id, 'all'
  FROM sources s
  WHERE s.slug = ANY(new_slugs)
    AND s.is_active = true
  ON CONFLICT (source_id) DO NOTHING;

  RAISE NOTICE 'Sharing rules ensured for % sources', (
    SELECT count(*) FROM sources WHERE slug = ANY(new_slugs) AND is_active = true
  );

  -- 2. Subscribe family portal to these sources.
  INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
  SELECT
    family_id,
    s.id,
    'all',
    true
  FROM sources s
  WHERE s.slug = ANY(new_slugs)
    AND s.is_active = true
  ON CONFLICT (subscriber_portal_id, source_id)
  DO UPDATE SET
    subscription_scope = 'all',
    is_active          = true;

  RAISE NOTICE 'Family portal subscribed to % entertainment destination sources', (
    SELECT count(*)
    FROM source_subscriptions ss
    JOIN sources s ON ss.source_id = s.id
    WHERE ss.subscriber_portal_id = family_id
      AND ss.is_active = true
      AND s.slug = ANY(new_slugs)
  );

  -- 3. Log any requested slugs not found.
  FOR src IN
    SELECT unnest(new_slugs) AS slug
    EXCEPT
    SELECT slug FROM sources WHERE slug = ANY(new_slugs)
  LOOP
    RAISE NOTICE 'MISSING from DB: %', src.slug;
  END LOOP;

  FOR src IN
    SELECT slug FROM sources
    WHERE slug = ANY(new_slugs) AND is_active = false
  LOOP
    RAISE NOTICE 'INACTIVE (not subscribed): %', src.slug;
  END LOOP;

END $$;

-- 4. Refresh portal_source_access materialized view.
REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;

-- ============================================
-- VERIFICATION QUERY (run post-migration):
-- ============================================
-- SELECT s.slug, s.name, s.is_active
-- FROM source_subscriptions ss
-- JOIN sources s ON ss.source_id = s.id
-- WHERE ss.subscriber_portal_id = (SELECT id FROM portals WHERE slug = 'atlanta-families')
--   AND ss.is_active = true
--   AND s.slug IN (
--     'escape-game-atlanta',
--     'andretti-indoor-karting-atlanta',
--     'round-1-arcade-alpharetta',
--     'topgolf-atlanta-midtown'
--   )
-- ORDER BY s.slug;
--
-- TEEN COVERAGE FOLLOW-UP (for crawler-dev):
-- SELECT s.slug, s.name, s.is_active, s.last_crawled_at
-- FROM sources s
-- WHERE s.slug IN ('sky-zone-atlanta', 'urban-air-atlanta', 'defy-atlanta', 'bgc-atlanta')
-- ORDER BY s.slug;
