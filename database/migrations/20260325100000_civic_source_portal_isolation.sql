-- ============================================================================
-- MIGRATION: Civic Source Portal Isolation
-- ============================================================================
-- Problem: ~30 civic/government/activism sources still have
--   owner_portal_id = atlanta OR owner_portal_id IS NULL.
--   Their events get portal_id = atlanta_uuid and pollute Atlanta's feed
--   with city council meetings, school board hearings, NPU meetings,
--   Mobilize activism events, etc.
--
-- Fix: Move pure civic sources to HelpATL ownership, backfill events.portal_id,
--   set sharing rules. Sources that produce community events alongside meetings
--   (city calendars, cultural affairs, health walks) stay in Atlanta.
--
-- This is a data-layer fix. The feed route uses portal_id = X for scoping,
-- so correcting events.portal_id is sufficient.
-- ============================================================================

DO $$
DECLARE
  atlanta_id UUID;
  helpatl_id UUID;
  src RECORD;
  moved_count INTEGER := 0;
  event_count INTEGER := 0;

  -- -----------------------------------------------------------------------
  -- TIER 1: Pure civic/government — move to helpatl, NO Atlanta subscription
  -- These never answer "what should I go do tonight?"
  -- -----------------------------------------------------------------------
  pure_civic_slugs TEXT[] := ARRAY[
    -- City/county government
    'atlanta-city-council',
    'marta-board',
    'georgia-elections',

    -- Activism aggregators
    'mobilize-api',
    'mobilize',
    'eventbrite-civic',

    -- Activism orgs (some already helpatl-owned but may have stale events)
    'indivisible-atl',
    'civic-innovation-atl',
    'georgia-equality',

    -- School boards NOT already in helpatl
    'cherokee-county-schools-board',
    'clayton-county-schools-board',
    'cobb-county-schools-board',
    'dekalb-county-schools-board',
    'gwinnett-county-schools-board',

    -- Neighborhood civic associations (primary output = meetings)
    'ansley-park-civic',
    'morningside-civic',
    'piedmont-heights-civic',
    'virginia-highland-civic',
    'mechanicsville-neighborhood',
    'ormewood-park-neighborhood',
    'vine-city-neighborhood',
    'east-lake-neighborhood',
    'peoplestown-neighborhood',
    'reynoldstown-rcil',
    'summerhill-neighborhood',

    -- Individual Mobilize org sources
    'mobilize-voteriders',
    'mobilize-50501-georgia',
    'mobilize-dekalb-dems',
    'mobilize-ga-dems',
    'mobilize-hrc-georgia',
    'mobilize-indivisible-atl',
    'mobilize-indivisible-cherokee',
    'mobilize-indivisible-cobb',
    'mobilize-indivisible-ga10',
    'mobilize-necessary-trouble',

    -- Other civic orgs
    'fly-on-a-wall',
    'aarp-georgia',
    'empowerline',
    'c4-atlanta',
    'atlanta-mission'

    -- NOTE: NOT moving these — they produce community events alongside meetings:
    -- college-park-city, decatur-city, atlanta-cultural-affairs, roswell-cultural-arts,
    -- fulton-board-health, ga-dph, ga-dept-labor, health-walks-atlanta
  ];

BEGIN
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';
  SELECT id INTO helpatl_id FROM portals WHERE slug = 'helpatl';

  IF atlanta_id IS NULL OR helpatl_id IS NULL THEN
    RAISE NOTICE 'Atlanta or HelpATL portal not found. Skipping.';
    RETURN;
  END IF;

  -- =======================================================================
  -- STEP 1: Transfer source ownership to HelpATL (pure civic)
  -- =======================================================================
  UPDATE sources
  SET owner_portal_id = helpatl_id
  WHERE slug = ANY(pure_civic_slugs)
    AND (owner_portal_id = atlanta_id OR owner_portal_id IS NULL);

  GET DIAGNOSTICS moved_count = ROW_COUNT;
  RAISE NOTICE 'Step 1: Transferred % civic sources to HelpATL', moved_count;

  -- =======================================================================
  -- STEP 2: Backfill events.portal_id for ALL helpatl-owned sources
  --   Catches events from sources that were already helpatl-owned but have
  --   stale portal_id = atlanta on their events (e.g. crawled after source
  --   migration but before the DB trigger could run, or trigger missed).
  -- =======================================================================
  UPDATE events e
  SET portal_id = helpatl_id
  FROM sources s
  WHERE e.source_id = s.id
    AND s.owner_portal_id = helpatl_id
    AND (e.portal_id = atlanta_id OR e.portal_id IS NULL)
    AND e.start_date >= CURRENT_DATE - INTERVAL '30 days';

  GET DIAGNOSTICS event_count = ROW_COUNT;
  RAISE NOTICE 'Step 2: Re-attributed % events to HelpATL portal_id', event_count;

  -- =======================================================================
  -- STEP 3: Set up sharing rules (owner = helpatl, scope = all)
  -- =======================================================================
  FOR src IN
    SELECT id FROM sources
    WHERE slug = ANY(pure_civic_slugs)
      AND owner_portal_id = helpatl_id
  LOOP
    INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
    VALUES (src.id, helpatl_id, 'all')
    ON CONFLICT (source_id)
    DO UPDATE SET
      owner_portal_id = helpatl_id,
      share_scope = 'all';
  END LOOP;

  RAISE NOTICE 'Step 3: Sharing rules upserted';

  -- =======================================================================
  -- STEP 4: Remove Atlanta subscriptions for pure civic sources
  --   These should NOT appear in Atlanta's feed at all.
  -- =======================================================================
  UPDATE source_subscriptions ss
  SET is_active = false
  FROM sources s
  WHERE ss.source_id = s.id
    AND s.slug = ANY(pure_civic_slugs)
    AND ss.subscriber_portal_id = atlanta_id
    AND ss.is_active = true;

  GET DIAGNOSTICS moved_count = ROW_COUNT;
  RAISE NOTICE 'Step 4: Deactivated % Atlanta subscriptions to pure civic sources', moved_count;

  -- =======================================================================
  -- STEP 5: Ensure HelpATL subscribes to its own sources
  -- =======================================================================
  FOR src IN
    SELECT id FROM sources
    WHERE slug = ANY(pure_civic_slugs)
      AND owner_portal_id = helpatl_id
  LOOP
    INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
    VALUES (helpatl_id, src.id, 'all', true)
    ON CONFLICT (subscriber_portal_id, source_id)
    DO UPDATE SET
      subscription_scope = 'all',
      is_active = true;
  END LOOP;

  RAISE NOTICE 'Step 5: HelpATL self-subscriptions ensured';

END $$;

-- =======================================================================
-- STEP 6: Refresh materialized view so queries pick up new access graph
-- =======================================================================
REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
