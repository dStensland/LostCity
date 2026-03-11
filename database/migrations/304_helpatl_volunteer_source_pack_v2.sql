-- ============================================
-- MIGRATION 304: HelpATL Volunteer Source Pack V2
-- ============================================
-- 1. Register and reactivate the volunteer backbone sources for HelpATL
-- 2. Register reserve commitment sources that matter strategically
-- 3. Share all volunteer v2 sources with Atlanta
-- 4. Strengthen cause-channel source rules for volunteer coverage
-- 5. Refresh portal_source_access materialized view

DO $$
DECLARE
  atlanta_id UUID;
  helpatl_id UUID;
  src RECORD;
  volunteer_source_slugs TEXT[] := ARRAY[
    'hands-on-atlanta',
    'united-way-atlanta',
    'atlanta-community-food-bank',
    'open-hand-atlanta',
    'trees-atlanta',
    'concrete-jungle',
    'habitat-for-humanity-atlanta',
    'chattahoochee-riverkeeper',
    'park-pride',
    'atlanta-mission',
    'big-brothers-big-sisters-atl',
    'everybody-wins-atlanta',
    'atlanta-casa',
    'laamistad'
  ];
BEGIN
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';
  SELECT id INTO helpatl_id FROM portals WHERE slug = 'helpatl';

  IF atlanta_id IS NULL OR helpatl_id IS NULL THEN
    RAISE NOTICE 'Atlanta or HelpATL portal not found. Skipping.';
    RETURN;
  END IF;

  INSERT INTO sources (
    slug,
    name,
    url,
    source_type,
    crawl_frequency,
    is_active,
    integration_method,
    owner_portal_id
  )
  VALUES
    ('hands-on-atlanta', 'Hands On Atlanta', 'https://www.handsonatlanta.org/volunteer', 'organization', 'daily', true, 'scrape', helpatl_id),
    ('united-way-atlanta', 'United Way of Greater Atlanta Volunteer', 'https://volunteer.unitedwayatlanta.org/', 'organization', 'daily', true, 'scrape', helpatl_id),
    ('atlanta-community-food-bank', 'Atlanta Community Food Bank', 'https://www.acfb.org/volunteer/', 'organization', 'daily', true, 'scrape', helpatl_id),
    ('open-hand-atlanta', 'Open Hand Atlanta', 'https://www.openhandatlanta.org/get-involved/volunteer/', 'organization', 'daily', true, 'scrape', helpatl_id),
    ('trees-atlanta', 'Trees Atlanta', 'https://www.treesatlanta.org/get-involved/volunteer-as-an-individual/', 'organization', 'weekly', true, 'scrape', helpatl_id),
    ('concrete-jungle', 'Concrete Jungle', 'https://concrete-jungle.org/volunteer/', 'organization', 'weekly', true, 'scrape', helpatl_id),
    ('habitat-for-humanity-atlanta', 'Atlanta Habitat for Humanity', 'https://www.atlantahabitat.org/volunteer/volunteer', 'organization', 'weekly', true, 'scrape', helpatl_id),
    ('chattahoochee-riverkeeper', 'Chattahoochee Riverkeeper', 'https://chattahoochee.org/volunteer', 'organization', 'weekly', true, 'scrape', helpatl_id),
    ('park-pride', 'Park Pride', 'https://parkpride.org/we-can-help/volunteer-program/', 'organization', 'weekly', true, 'scrape', helpatl_id),
    ('atlanta-mission', 'Atlanta Mission', 'https://atlantamission.org/get-involved/volunteer/', 'organization', 'weekly', true, 'scrape', helpatl_id),
    ('big-brothers-big-sisters-atl', 'Big Brothers Big Sisters of Metro Atlanta', 'https://bbbsatl.org/events/', 'organization', 'weekly', true, 'scrape', helpatl_id),
    ('everybody-wins-atlanta', 'Everybody Wins Atlanta', 'https://everybodywinsatlanta.org/events/', 'organization', 'weekly', true, 'scrape', helpatl_id),
    ('atlanta-casa', 'Atlanta CASA', 'https://atlantacasa.org/get-involved/become-a-volunteer/', 'organization', 'weekly', true, 'scrape', helpatl_id),
    ('laamistad', 'LaAmistad', 'https://laamistadinc.org/volunteer/', 'organization', 'weekly', true, 'scrape', helpatl_id)
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = true,
    integration_method = EXCLUDED.integration_method,
    owner_portal_id = helpatl_id;

  RAISE NOTICE 'HelpATL volunteer source pack v2 sources registered or reactivated';

  FOR src IN
    SELECT id FROM sources WHERE slug = ANY(volunteer_source_slugs) AND is_active = true
  LOOP
    INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
    VALUES (src.id, helpatl_id, 'all')
    ON CONFLICT (source_id) DO UPDATE SET
      owner_portal_id = helpatl_id,
      share_scope = 'all';

    INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
    VALUES (atlanta_id, src.id, 'all', true)
    ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
      subscription_scope = 'all',
      is_active = true;
  END LOOP;

  RAISE NOTICE 'Volunteer source sharing rules and Atlanta subscriptions ensured';

  -- Food Security
  FOR src IN
    SELECT id, slug FROM sources
    WHERE slug IN ('atlanta-community-food-bank', 'open-hand-atlanta', 'concrete-jungle')
      AND is_active = true
  LOOP
    INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
    SELECT c.id, 'source', jsonb_build_object('source_id', src.id, 'source_slug', src.slug), 20, true
    FROM interest_channels c
    WHERE c.portal_id = helpatl_id AND c.slug = 'food-security'
      AND NOT EXISTS (
        SELECT 1 FROM interest_channel_rules r
        WHERE r.channel_id = c.id
          AND r.rule_type = 'source'
          AND r.rule_payload ->> 'source_slug' = src.slug
      );
  END LOOP;

  -- Environment
  FOR src IN
    SELECT id, slug FROM sources
    WHERE slug IN ('trees-atlanta', 'park-pride', 'chattahoochee-riverkeeper')
      AND is_active = true
  LOOP
    INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
    SELECT c.id, 'source', jsonb_build_object('source_id', src.id, 'source_slug', src.slug), 20, true
    FROM interest_channels c
    WHERE c.portal_id = helpatl_id AND c.slug = 'environment'
      AND NOT EXISTS (
        SELECT 1 FROM interest_channel_rules r
        WHERE r.channel_id = c.id
          AND r.rule_type = 'source'
          AND r.rule_payload ->> 'source_slug' = src.slug
      );
  END LOOP;

  -- Housing
  FOR src IN
    SELECT id, slug FROM sources
    WHERE slug IN ('habitat-for-humanity-atlanta', 'atlanta-mission')
      AND is_active = true
  LOOP
    INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
    SELECT c.id, 'source', jsonb_build_object('source_id', src.id, 'source_slug', src.slug), 20, true
    FROM interest_channels c
    WHERE c.portal_id = helpatl_id AND c.slug = 'housing'
      AND NOT EXISTS (
        SELECT 1 FROM interest_channel_rules r
        WHERE r.channel_id = c.id
          AND r.rule_type = 'source'
          AND r.rule_payload ->> 'source_slug' = src.slug
      );
  END LOOP;

  -- Education / Mentorship
  FOR src IN
    SELECT id, slug FROM sources
    WHERE slug IN ('big-brothers-big-sisters-atl', 'everybody-wins-atlanta', 'laamistad')
      AND is_active = true
  LOOP
    INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
    SELECT c.id, 'source', jsonb_build_object('source_id', src.id, 'source_slug', src.slug), 20, true
    FROM interest_channels c
    WHERE c.portal_id = helpatl_id AND c.slug = 'education'
      AND NOT EXISTS (
        SELECT 1 FROM interest_channel_rules r
        WHERE r.channel_id = c.id
          AND r.rule_type = 'source'
          AND r.rule_payload ->> 'source_slug' = src.slug
      );
  END LOOP;

  -- Public Safety / court advocacy
  FOR src IN
    SELECT id, slug FROM sources
    WHERE slug = 'atlanta-casa'
      AND is_active = true
  LOOP
    INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
    SELECT c.id, 'source', jsonb_build_object('source_id', src.id, 'source_slug', src.slug), 20, true
    FROM interest_channels c
    WHERE c.portal_id = helpatl_id AND c.slug = 'public-safety'
      AND NOT EXISTS (
        SELECT 1 FROM interest_channel_rules r
        WHERE r.channel_id = c.id
          AND r.rule_type = 'source'
          AND r.rule_payload ->> 'source_slug' = src.slug
      );
  END LOOP;

  RAISE NOTICE 'Volunteer source rules wired to HelpATL cause channels';
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
