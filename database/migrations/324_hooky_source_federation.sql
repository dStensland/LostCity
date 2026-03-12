-- ============================================
-- MIGRATION 324: Hooky Family Portal — Source Federation
-- ============================================
-- Hooky uses federation_scope = 'explicit_only' (set in migration 322).
-- This migration subscribes Hooky to all existing Atlanta sources that
-- produce family-relevant content, so we don't duplicate crawlers.
--
-- Audit methodology:
--   Each source below was reviewed in crawlers/sources/ and categorized:
--   FEDERATE  — Already produces family content; include as-is.
--   EXTEND    — Produces some family content; note age-tagging gap separately.
--   SKIP      — Nightlife/adults-only/bars; never include.
--
-- Hooky's portal filters (migration 322) already exclude:
--   - category = 'nightlife'
--   - exclude_adult = true
-- So even mixed sources (museums with adults-only nights) are safe to
-- federate — the portal-level filter gates the feed.
--
-- Source groups:
--   A. Museums & Attractions (core family destinations)
--   B. Libraries (4 county systems)
--   C. Parks & Recreation (4 county systems + Atlanta DPR/ACTIVENet)
--   D. Family-focused arts & enrichment
--   E. Outdoor / nature
--   F. Aggregators with family URL coverage (Eventbrite, Meetup)
--   G. SKIP — bars, nightlife, adult venues (documented, not federated)
-- ============================================

DO $$
DECLARE
  hooky_id     UUID;
  atlanta_id   UUID;
  src          RECORD;
  -- All source slugs Hooky should subscribe to.
  -- Format matches the `slug` column in the sources table.
  family_source_slugs TEXT[] := ARRAY[

    -- -------------------------------------------------------
    -- A. MUSEUMS & ATTRACTIONS
    --    All produce family category events as primary output.
    --    Mixed sources (e.g. Fernbank After Dark = adults-only)
    --    are safe: portal exclude_adult filter handles it.
    -- -------------------------------------------------------
    'fernbank',                  -- Fernbank Museum of Natural History, kids programs, camps
    'georgia-aquarium',          -- Aquarium, camps, family events (default category=family)
    'zoo-atlanta',               -- Zoo, seasonal family events (default category=family)
    'childrens-museum',          -- Children's Museum of Atlanta — pure family
    'high-museum',               -- Art museum, family Sundays, kids workshops
    'atlanta-botanical',         -- Botanical Garden, family events, Garden Lights
    'fernbank-science-center',   -- Free planetarium & observatory (DeKalb Schools)
    'lego-discovery-center',     -- LEGO workshops, pure family/kids
    'carlos-museum',             -- Emory's Michael C. Carlos Museum, family programs
    'atlanta-history-center',    -- History Center, family programs & events
    'puppetry-arts',             -- Center for Puppetry Arts — kids shows, workshops
    'theatre-for-young-audiences', -- Alliance Theatre's dedicated family programming
    'stone-mountain-park',       -- State park, family festivals, seasonal events
    'six-flags',                 -- Theme park seasonal events (Fright Fest, Holiday)
    'sky-zone-atlanta',          -- Trampoline park, toddler time, glow events
    'illuminarium',              -- Immersive venue, family-friendly experiences
    'fun-spot-atlanta',          -- Amusement park, family events

    -- -------------------------------------------------------
    -- B. LIBRARIES (4 metro county systems)
    --    Pure family content: storytimes, book clubs, kids programs,
    --    computer classes, author talks. No adult-filtering needed.
    -- -------------------------------------------------------
    'fulton-library',            -- Atlanta-Fulton Public Library (BiblioCommons API)
    'dekalb-library',            -- DeKalb County Public Library (Communico)
    'gwinnett-library',          -- Gwinnett County Public Library (Communico)
    'cobb-library',              -- Cobb County Public Library

    -- -------------------------------------------------------
    -- C. PARKS & RECREATION
    --    All produce camps, youth sports, swim lessons, rec programs.
    --    Mixed adult programs (senior fitness, adult leagues) are fine —
    --    age_min/age_max filtering handles per-kid relevance.
    -- -------------------------------------------------------
    'atlanta-dpr',               -- Atlanta DPR ACTIVENet: camps, swim, youth sports
    'atlanta-parks-rec',         -- Atlanta.gov parks calendar: park events
    'cobb-parks-rec',            -- Cobb County Rec1: camps, gymnastics, aquatics
    'dekalb-parks-rec',          -- DeKalb ACTIVENet: camps, swim, fitness, youth
    'gwinnett-parks-rec',        -- Gwinnett Rec1: camps, aquatics, sports, nature
    'decatur-recreation',        -- City of Decatur rec center programs
    'piedmont-park',             -- Piedmont Park Conservancy events

    -- -------------------------------------------------------
    -- D. FAMILY-FOCUSED ARTS & ENRICHMENT
    --    Primary output is family/learning/community events.
    -- -------------------------------------------------------
    'alliance-theatre',          -- Alliance Theatre mainstage (incl. family shows)
    'aurora-theatre',            -- Aurora Theatre Lawrenceville (family productions)
    'callanwolde',               -- Callanwolde Fine Arts Center (classes, events)
    'spruill-center-for-the-arts', -- Spruill Arts: pottery, glass, kids workshops
    'home-depot-kids-workshops', -- Free first-Saturday kids workshops (ages 5-12)
    'chastain-arts',             -- Chastain Arts Center — community arts programs
    'marcus-jcc',                -- Marcus JCC: camps, enrichment, family programs
    'gigis-playhouse-atlanta',   -- GiGi's Playhouse: Down syndrome family programs

    -- -------------------------------------------------------
    -- E. OUTDOOR / NATURE
    --    Family-friendly outdoor events with volunteer/nature angle.
    --    Trees Atlanta and Park Pride already federated to HelpATL;
    --    Hooky subscribes separately for the family outdoor use case.
    -- -------------------------------------------------------
    'trees-atlanta',             -- Tree plantings, BeltLine walks, nature programs
    'park-pride',                -- Park workdays, greenspace events, family-friendly
    'chattahoochee-nature',      -- Chattahoochee Nature Center programs & events
    'atlanta-beltline',          -- BeltLine community events, runs, art walks
    'south-river-forest',        -- South River Forest conservancy events

    -- -------------------------------------------------------
    -- F. AGGREGATORS WITH FAMILY URL COVERAGE
    --    Eventbrite already crawls family-activities + kids-activities +
    --    camps-and-retreats URLs (confirmed in crawlers/sources/eventbrite.py).
    --    Meetup surfaces family/outdoor/hiking groups.
    --    Both produce category=family events for Atlanta.
    -- -------------------------------------------------------
    'eventbrite',                -- Covers /family-activities/, /kids-activities/, /camps-and-retreats/
    'meetup'                     -- Family/kids Meetup groups in Atlanta

    -- -------------------------------------------------------
    -- SKIP — confirmed adults-only / nightlife / bars:
    --
    -- All bar/nightlife venues: marys-bar, blakes-on-park, elmyr,
    --   dark-horse-tavern, northside-tavern, the-porter, manuels-tavern,
    --   moes-and-joes, star-community-bar, wrecking-bar, halfway-crooks,
    --   lore-atlanta, midway-pub, terminal-west, the-masquerade, etc.
    --
    -- Comedy (adult): laughing-skull, helium-comedy, punchline, dads-garage
    --
    -- Nightlife aggregators: resident-advisor
    --
    -- Piedmont-classes: owned by piedmont portal, not atlanta.
    --   Contains maternity/CPR/wellness — some Hooky-adjacent but
    --   portal ownership conflict means skip for now.
    --
    -- Ticketmaster: too broad, adults-only concerts dominate; the
    --   portal-level category filter (exclude nightlife) would help,
    --   but Eventbrite provides cleaner family coverage.
    -- -------------------------------------------------------
  ];

BEGIN
  SELECT id INTO hooky_id   FROM portals WHERE slug = 'hooky';
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';

  IF hooky_id IS NULL THEN
    RAISE EXCEPTION 'Hooky portal not found. Run migration 322 first.';
  END IF;

  IF atlanta_id IS NULL THEN
    RAISE EXCEPTION 'Atlanta portal not found.';
  END IF;

  -- -------------------------------------------------------
  -- 1. Ensure sharing rules exist for all family sources.
  --    Most Atlanta sources already have sharing rules from
  --    migration 295 (FORTH federation), but we use ON CONFLICT
  --    DO NOTHING to be safe.
  -- -------------------------------------------------------
  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  SELECT s.id, s.owner_portal_id, 'all'
  FROM sources s
  WHERE s.slug = ANY(family_source_slugs)
    AND s.is_active = true
  ON CONFLICT (source_id) DO NOTHING;

  RAISE NOTICE 'Sharing rules ensured for % active family sources',
    (SELECT count(*) FROM sources WHERE slug = ANY(family_source_slugs) AND is_active = true);

  -- -------------------------------------------------------
  -- 2. Subscribe Hooky to all active family sources.
  --    Uses ON CONFLICT DO UPDATE to be idempotent.
  -- -------------------------------------------------------
  INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
  SELECT
    hooky_id,
    s.id,
    'all',
    true
  FROM sources s
  WHERE s.slug = ANY(family_source_slugs)
    AND s.is_active = true
  ON CONFLICT (subscriber_portal_id, source_id)
  DO UPDATE SET
    subscription_scope = 'all',
    is_active          = true;

  RAISE NOTICE 'Hooky subscribed to % active family sources',
    (SELECT count(*)
     FROM source_subscriptions ss
     JOIN sources s ON ss.source_id = s.id
     WHERE ss.subscriber_portal_id = hooky_id
       AND ss.is_active = true
       AND s.slug = ANY(family_source_slugs));

  -- -------------------------------------------------------
  -- 3. Log any requested slugs that don't exist yet.
  --    Helps catch typos or sources not yet registered.
  -- -------------------------------------------------------
  RAISE NOTICE 'Sources in list but NOT found in DB (inactive or unregistered):';
  FOR src IN
    SELECT unnest(family_source_slugs) AS slug
    EXCEPT
    SELECT slug FROM sources WHERE slug = ANY(family_source_slugs)
  LOOP
    RAISE NOTICE '  MISSING: %', src.slug;
  END LOOP;

  -- Also note any that exist but are inactive
  FOR src IN
    SELECT slug FROM sources
    WHERE slug = ANY(family_source_slugs)
      AND is_active = false
  LOOP
    RAISE NOTICE '  INACTIVE (not subscribed): %', src.slug;
  END LOOP;

END $$;

-- -------------------------------------------------------
-- 4. Refresh portal_source_access materialized view
--    so Hooky's feed immediately sees the federated sources.
-- -------------------------------------------------------
REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;

-- -------------------------------------------------------
-- 5. Verification query (run to confirm post-migration)
-- -------------------------------------------------------
-- SELECT s.slug, s.name, s.is_active
-- FROM source_subscriptions ss
-- JOIN sources s ON ss.source_id = s.id
-- WHERE ss.subscriber_portal_id = (SELECT id FROM portals WHERE slug = 'hooky')
--   AND ss.is_active = true
-- ORDER BY s.slug;
