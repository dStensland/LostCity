-- ============================================
-- MIGRATION 298: HelpATL Cause Channels and New Source Registration
-- ============================================
-- 1. Extend channel_type CHECK to include 'cause'
-- 2. Register new civic/volunteer sources under HelpATL ownership
-- 3. Share all new sources with Atlanta (subscriptions)
-- 4. Seed 9 cause-based interest channels on HelpATL
-- 5. Wire channel rules: tag (cause tag), source (specific sources), geo (ATL metro)
-- 6. Refresh portal_source_access materialized view

-- ---------------------------------------------------------------
-- 1. Extend channel_type CHECK constraint to include 'cause'
-- ---------------------------------------------------------------

-- Drop old constraint if it exists (name may vary; search pg_constraint)
DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'interest_channels'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%channel_type%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE interest_channels DROP CONSTRAINT IF EXISTS %I', con_name);
  END IF;
END $$;

ALTER TABLE interest_channels
  ADD CONSTRAINT interest_channels_channel_type_check
  CHECK (channel_type IN (
    'jurisdiction',
    'institution',
    'topic',
    'community',
    'intent',
    'cause'
  ));

-- ---------------------------------------------------------------
-- 2. Register new sources + update existing ones under HelpATL
-- ---------------------------------------------------------------

DO $$
DECLARE
  atlanta_id  UUID;
  helpatl_id  UUID;
  src         RECORD;
  new_source_slugs TEXT[] := ARRAY[
    'dekalb-county-schools-board',
    'mobilize-us',
    'marta-board',
    'lifeline-animal-project',
    'atlanta-humane-society',
    'furkids',
    'trees-atlanta',
    'keep-atlanta-beautiful',
    'artsatl',
    -- Ensure existing civic sources are active and owned by HelpATL
    'hands-on-atlanta',
    'park-pride'
  ];

  -- Cause channels: (slug, name, description, sort_order)
  cause_channels RECORD;

  -- Source-to-channel mappings for source rules
  src_channel RECORD;

BEGIN
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';
  SELECT id INTO helpatl_id FROM portals WHERE slug = 'helpatl';

  IF atlanta_id IS NULL OR helpatl_id IS NULL THEN
    RAISE NOTICE 'Atlanta or HelpATL portal not found. Skipping.';
    RETURN;
  END IF;

  -- ---------------------------------------------------------------
  -- Insert / upsert new sources
  -- ---------------------------------------------------------------

  INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active,
                       integration_method, owner_portal_id)
  VALUES
    ('dekalb-county-schools-board', 'DeKalb County Schools Board',
     'https://simbli.eboardsolutions.com/SB_Meetings/SB_MeetingListing.aspx?S=36030443',
     'organization', 'weekly', true, 'scrape', helpatl_id),
    ('mobilize-us', 'Mobilize.us Atlanta',
     'https://api.mobilize.us/v1/events',
     'organization', 'daily', true, 'api', helpatl_id),
    ('marta-board', 'MARTA Board of Directors',
     'https://marta.legistar.com/Calendar.aspx',
     'organization', 'weekly', true, 'scrape', helpatl_id),
    ('lifeline-animal-project', 'LifeLine Animal Project',
     'https://lifelineanimal.org',
     'organization', 'weekly', true, 'scrape', helpatl_id),
    ('atlanta-humane-society', 'Atlanta Humane Society',
     'https://atlantahumane.org',
     'organization', 'weekly', true, 'scrape', helpatl_id),
    ('furkids', 'Furkids',
     'https://furkids.org',
     'organization', 'weekly', true, 'scrape', helpatl_id),
    ('trees-atlanta', 'Trees Atlanta',
     'https://treesatlanta.org',
     'organization', 'weekly', true, 'scrape', helpatl_id),
    ('keep-atlanta-beautiful', 'Keep Atlanta Beautiful',
     'https://keepatlantabeautiful.org',
     'organization', 'weekly', true, 'scrape', helpatl_id),
    ('artsatl', 'ArtsATL',
     'https://artsatl.org',
     'organization', 'weekly', true, 'scrape', helpatl_id)
  ON CONFLICT (slug) DO UPDATE SET
    owner_portal_id = helpatl_id,
    is_active       = true;

  -- Ensure pre-existing civic sources are active and HelpATL-owned
  UPDATE sources
  SET owner_portal_id = helpatl_id,
      is_active       = true
  WHERE slug = ANY(ARRAY['hands-on-atlanta', 'park-pride'])
    AND (owner_portal_id != helpatl_id OR is_active = false);

  RAISE NOTICE 'Sources registered/updated for HelpATL';

  -- ---------------------------------------------------------------
  -- 3. Sharing rules (HelpATL owns, share_scope = all)
  --    and Atlanta subscriptions for all new/updated HelpATL sources
  -- ---------------------------------------------------------------

  FOR src IN
    SELECT id FROM sources WHERE slug = ANY(new_source_slugs) AND is_active = true
  LOOP
    INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
    VALUES (src.id, helpatl_id, 'all')
    ON CONFLICT (source_id) DO UPDATE SET
      owner_portal_id = helpatl_id,
      share_scope     = 'all';

    INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
    VALUES (atlanta_id, src.id, 'all', true)
    ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
      subscription_scope = 'all',
      is_active          = true;
  END LOOP;

  RAISE NOTICE 'Sharing rules and Atlanta subscriptions created for HelpATL sources';

  -- ---------------------------------------------------------------
  -- 4. Seed 9 cause-based interest channels on HelpATL
  -- ---------------------------------------------------------------

  INSERT INTO interest_channels (portal_id, slug, name, channel_type, description, sort_order, is_active)
  VALUES
    (helpatl_id, 'food-security',    'Food Security',       'cause',
     'Food banks, meal programs, food drives, and food access advocacy.',          100, true),
    (helpatl_id, 'education',        'Education',           'cause',
     'Tutoring, mentoring, school boards, and education funding.',                 110, true),
    (helpatl_id, 'environment',      'Environment',         'cause',
     'Park cleanups, tree planting, conservation, and climate action.',            120, true),
    (helpatl_id, 'housing',          'Housing',             'cause',
     'Habitat builds, shelter volunteering, zoning hearings, and housing justice.',130, true),
    (helpatl_id, 'health-wellness',  'Health & Wellness',   'cause',
     'Health fairs, blood drives, public health, and healthcare advocacy.',        140, true),
    (helpatl_id, 'animals',          'Animals',             'cause',
     'Shelter volunteering, foster coordination, adoption events, and animal welfare.', 150, true),
    (helpatl_id, 'transit-mobility', 'Transit & Mobility',  'cause',
     'MARTA board meetings, bike/pedestrian safety, and transit advocacy.',        160, true),
    (helpatl_id, 'arts-culture',     'Arts & Culture',      'cause',
     'Arts education, community murals, cultural events, and arts funding.',       170, true),
    (helpatl_id, 'public-safety',    'Public Safety',       'cause',
     'Community watch, oversight boards, court watch, and justice reform.',        180, true)
  ON CONFLICT (portal_id, slug) WHERE portal_id IS NOT NULL
  DO UPDATE SET
    name        = EXCLUDED.name,
    channel_type = EXCLUDED.channel_type,
    description  = EXCLUDED.description,
    sort_order   = EXCLUDED.sort_order,
    is_active    = EXCLUDED.is_active,
    updated_at   = now();

  RAISE NOTICE 'Seeded 9 cause channels on HelpATL';

  -- ---------------------------------------------------------------
  -- 5a. TAG rules — one per cause channel matching its cause tag
  -- ---------------------------------------------------------------

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'tag', jsonb_build_object('tag', c.slug), 10, true
  FROM interest_channels c
  WHERE c.portal_id = helpatl_id
    AND c.slug IN (
      'food-security', 'education', 'environment', 'housing',
      'health-wellness', 'animals', 'transit-mobility', 'arts-culture', 'public-safety'
    )
    AND NOT EXISTS (
      SELECT 1 FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type  = 'tag'
        AND r.rule_payload ->> 'tag' = c.slug
    );

  RAISE NOTICE 'Tag rules inserted for cause channels';

  -- ---------------------------------------------------------------
  -- 5b. SOURCE rules — connect specific sources to relevant channels
  -- ---------------------------------------------------------------

  -- food-security ← atlanta-community-food-bank
  -- NOTE: hands-on-atlanta removed — HOA covers many causes, tag rules handle matching
  FOR src IN
    SELECT id, slug FROM sources
    WHERE slug IN ('atlanta-community-food-bank')
      AND is_active = true
  LOOP
    INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
    SELECT c.id, 'source', jsonb_build_object('source_id', src.id, 'source_slug', src.slug), 20, true
    FROM interest_channels c
    WHERE c.portal_id = helpatl_id AND c.slug = 'food-security'
      AND NOT EXISTS (
        SELECT 1 FROM interest_channel_rules r
        WHERE r.channel_id = c.id
          AND r.rule_type  = 'source'
          AND r.rule_payload ->> 'source_slug' = src.slug
      );
  END LOOP;

  -- environment ← park-pride, trees-atlanta, keep-atlanta-beautiful
  FOR src IN
    SELECT id, slug FROM sources
    WHERE slug IN ('park-pride', 'trees-atlanta', 'keep-atlanta-beautiful')
      AND is_active = true
  LOOP
    INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
    SELECT c.id, 'source', jsonb_build_object('source_id', src.id, 'source_slug', src.slug), 20, true
    FROM interest_channels c
    WHERE c.portal_id = helpatl_id AND c.slug = 'environment'
      AND NOT EXISTS (
        SELECT 1 FROM interest_channel_rules r
        WHERE r.channel_id = c.id
          AND r.rule_type  = 'source'
          AND r.rule_payload ->> 'source_slug' = src.slug
      );
  END LOOP;

  -- animals ← lifeline-animal-project, atlanta-humane-society, furkids
  FOR src IN
    SELECT id, slug FROM sources
    WHERE slug IN ('lifeline-animal-project', 'atlanta-humane-society', 'furkids')
      AND is_active = true
  LOOP
    INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
    SELECT c.id, 'source', jsonb_build_object('source_id', src.id, 'source_slug', src.slug), 20, true
    FROM interest_channels c
    WHERE c.portal_id = helpatl_id AND c.slug = 'animals'
      AND NOT EXISTS (
        SELECT 1 FROM interest_channel_rules r
        WHERE r.channel_id = c.id
          AND r.rule_type  = 'source'
          AND r.rule_payload ->> 'source_slug' = src.slug
      );
  END LOOP;

  -- transit-mobility ← marta-board
  FOR src IN
    SELECT id, slug FROM sources
    WHERE slug = 'marta-board' AND is_active = true
  LOOP
    INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
    SELECT c.id, 'source', jsonb_build_object('source_id', src.id, 'source_slug', src.slug), 20, true
    FROM interest_channels c
    WHERE c.portal_id = helpatl_id AND c.slug = 'transit-mobility'
      AND NOT EXISTS (
        SELECT 1 FROM interest_channel_rules r
        WHERE r.channel_id = c.id
          AND r.rule_type  = 'source'
          AND r.rule_payload ->> 'source_slug' = src.slug
      );
  END LOOP;

  -- education ← dekalb-county-schools-board
  FOR src IN
    SELECT id, slug FROM sources
    WHERE slug = 'dekalb-county-schools-board' AND is_active = true
  LOOP
    INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
    SELECT c.id, 'source', jsonb_build_object('source_id', src.id, 'source_slug', src.slug), 20, true
    FROM interest_channels c
    WHERE c.portal_id = helpatl_id AND c.slug = 'education'
      AND NOT EXISTS (
        SELECT 1 FROM interest_channel_rules r
        WHERE r.channel_id = c.id
          AND r.rule_type  = 'source'
          AND r.rule_payload ->> 'source_slug' = src.slug
      );
  END LOOP;

  -- arts-culture ← artsatl
  FOR src IN
    SELECT id, slug FROM sources
    WHERE slug = 'artsatl' AND is_active = true
  LOOP
    INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
    SELECT c.id, 'source', jsonb_build_object('source_id', src.id, 'source_slug', src.slug), 20, true
    FROM interest_channels c
    WHERE c.portal_id = helpatl_id AND c.slug = 'arts-culture'
      AND NOT EXISTS (
        SELECT 1 FROM interest_channel_rules r
        WHERE r.channel_id = c.id
          AND r.rule_type  = 'source'
          AND r.rule_payload ->> 'source_slug' = src.slug
      );
  END LOOP;

  RAISE NOTICE 'Source rules inserted for cause channels';

  -- ---------------------------------------------------------------
  -- 5c. GEO rules — REMOVED
  --     Geo rules were acting as a catch-all (all ATL events matched every channel).
  --     All HelpATL sources are already geo-scoped at crawl time.
  --     Tag and source rules are the correct matching mechanism.
  -- ---------------------------------------------------------------

END $$;

-- ---------------------------------------------------------------
-- 6. Refresh materialized view so all portals see updated access
-- ---------------------------------------------------------------
REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
