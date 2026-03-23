-- ============================================================
-- MIGRATION: Exhibition Coverage — Source Registration
-- ============================================================
-- Phase 1.1: Reactivate MOCA GA and SCAD FASH crawlers
-- Phase 2: Register sources for ~40 gallery/museum venues
--          to be crawled by generic_venue_crawler.py
--
-- All sources owned by Atlanta portal, shared with all, subscribed by Atlanta.
-- Integration method = 'requests' (generic crawler uses HTTP).
-- Crawl frequency = 'weekly' (galleries change slowly).

DO $$
DECLARE
  atlanta_id  UUID;
  src_id      INTEGER;
BEGIN
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';

  IF atlanta_id IS NULL THEN
    RAISE NOTICE 'Atlanta portal not found. Skipping.';
    RETURN;
  END IF;

  -- ---------------------------------------------------------------
  -- Phase 1.1: Reactivate existing crawlers
  -- ---------------------------------------------------------------

  UPDATE sources SET is_active = true WHERE slug = 'moca-ga';
  RAISE NOTICE 'Reactivated moca-ga';

  UPDATE sources SET is_active = true WHERE slug = 'scad-fash';
  RAISE NOTICE 'Reactivated scad-fash';

  -- ---------------------------------------------------------------
  -- Phase 2: Register new sources for galleries with websites
  -- These will be crawled by generic_venue_crawler.py which handles
  -- LLM-based exhibition detection and routing.
  -- ---------------------------------------------------------------

  -- High-priority galleries --

  INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, integration_method, owner_portal_id)
  VALUES
    ('alan-avery-art-company', 'Alan Avery Art Company', 'https://alanaveryartcompany.com', 'venue', 'weekly', true, 'requests', atlanta_id),
    ('besharat-gallery', 'Besharat Gallery', 'https://besharatgallery.com', 'venue', 'weekly', true, 'requests', atlanta_id),
    ('besharat-contemporary', 'Besharat Contemporary', 'https://besharatcontemporary.com', 'venue', 'weekly', true, 'requests', atlanta_id),
    ('echo-contemporary', 'Echo Contemporary', 'https://echocontemporary.com', 'venue', 'weekly', true, 'requests', atlanta_id),
    ('get-this-gallery', 'Get This Gallery', 'https://getthisgallery.com', 'venue', 'weekly', true, 'requests', atlanta_id),
    ('hathaway-contemporary', 'Hathaway Contemporary', 'https://hathawaygallery.com', 'venue', 'weekly', true, 'requests', atlanta_id),
    ('zucot-gallery', 'ZuCot Gallery', 'https://zucotgallery.com', 'venue', 'weekly', true, 'requests', atlanta_id),
    ('atlanta-center-photography', 'Atlanta Center for Photography', 'https://atlantaphotography.org', 'venue', 'weekly', true, 'requests', atlanta_id),
    ('tew-galleries', 'Tew Galleries', 'https://tewgalleries.com', 'venue', 'weekly', true, 'requests', atlanta_id),
    ('spalding-nix-fine-art', 'Spalding Nix Fine Art', 'https://spaldingnixfineart.com', 'venue', 'weekly', true, 'requests', atlanta_id),
    ('one-contemporary', 'One Contemporary', 'https://onecontemporarygallery.com', 'venue', 'weekly', true, 'requests', atlanta_id),
    ('day-night-projects', 'Day & Night Projects', 'https://daynightprojects.art', 'venue', 'weekly', true, 'requests', atlanta_id),
    ('mint-gallery', 'Mint Gallery', 'https://mementoatl.com', 'venue', 'weekly', true, 'requests', atlanta_id)
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = true,
    integration_method = EXCLUDED.integration_method,
    owner_portal_id = atlanta_id;

  RAISE NOTICE 'Registered 13 gallery sources';

  -- Museums with websites --

  INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, integration_method, owner_portal_id)
  VALUES
    ('apex-museum', 'APEX Museum', 'https://apexmuseum.org', 'venue', 'weekly', true, 'requests', atlanta_id),
    ('exhibition-hub-atlanta', 'Exhibition Hub Atlanta', 'https://exhibitionhub.com', 'venue', 'weekly', true, 'requests', atlanta_id),
    ('trap-music-museum', 'Trap Music Museum', 'https://trapmusicmuseum.com', 'venue', 'weekly', true, 'requests', atlanta_id),
    ('dekalb-history-center', 'DeKalb History Center', 'https://dekalbhistory.org', 'venue', 'weekly', true, 'requests', atlanta_id),
    ('millennium-gate', 'Millennium Gate Museum', 'https://thegatemuseum.org', 'venue', 'weekly', true, 'requests', atlanta_id),
    ('museum-of-illusions-atlanta', 'Museum of Illusions Atlanta', 'https://museumofillusions.us/atlanta/', 'venue', 'weekly', true, 'requests', atlanta_id),
    ('atlanta-monetary-museum', 'Atlanta Monetary Museum', 'https://atlantafed.org', 'venue', 'monthly', true, 'requests', atlanta_id)
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = true,
    integration_method = EXCLUDED.integration_method,
    owner_portal_id = atlanta_id;

  RAISE NOTICE 'Registered 7 museum sources';

  -- University galleries --

  INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, integration_method, owner_portal_id)
  VALUES
    ('emory-visual-arts-gallery', 'Emory Visual Arts Gallery', 'https://arts.emory.edu', 'venue', 'weekly', true, 'requests', atlanta_id),
    ('ernest-welch-gallery-gsu', 'Ernest G. Welch Gallery GSU', 'https://art.gsu.edu/gallery/', 'venue', 'weekly', true, 'requests', atlanta_id)
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = true,
    integration_method = EXCLUDED.integration_method,
    owner_portal_id = atlanta_id;

  RAISE NOTICE 'Registered 2 university gallery sources';

  -- Arts centers/studios --

  INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, integration_method, owner_portal_id)
  VALUES
    ('atlanta-clay-works', 'Atlanta Clay Works', 'https://atlclayworks.org', 'venue', 'weekly', true, 'requests', atlanta_id),
    ('chastain-arts-center', 'Chastain Arts Center', 'https://ocaatlanta.com/chastain-arts-center', 'venue', 'weekly', true, 'requests', atlanta_id),
    ('windmill-arts', 'Windmill Arts', 'https://windmillarts.org', 'venue', 'weekly', true, 'requests', atlanta_id),
    ('the-bakery-atlanta', 'The Bakery Atlanta', 'https://thebakeryatlanta.com', 'venue', 'weekly', true, 'requests', atlanta_id)
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = true,
    integration_method = EXCLUDED.integration_method,
    owner_portal_id = atlanta_id;

  RAISE NOTICE 'Registered 4 arts center sources';

  -- ---------------------------------------------------------------
  -- Create sharing rules and subscriptions for all new sources
  -- ---------------------------------------------------------------

  -- Sharing rules: all new sources shared with all portals
  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  SELECT s.id, atlanta_id, 'all'
  FROM sources s
  WHERE s.slug IN (
    'alan-avery-art-company', 'besharat-gallery', 'besharat-contemporary',
    'echo-contemporary', 'get-this-gallery', 'hathaway-contemporary',
    'zucot-gallery', 'atlanta-center-photography', 'tew-galleries',
    'spalding-nix-fine-art', 'one-contemporary', 'day-night-projects', 'mint-gallery',
    'apex-museum', 'exhibition-hub-atlanta', 'trap-music-museum',
    'dekalb-history-center', 'millennium-gate', 'museum-of-illusions-atlanta',
    'atlanta-monetary-museum',
    'emory-visual-arts-gallery', 'ernest-welch-gallery-gsu',
    'atlanta-clay-works', 'chastain-arts-center', 'windmill-arts', 'the-bakery-atlanta'
  )
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = atlanta_id,
    share_scope = 'all';

  RAISE NOTICE 'Created sharing rules for new sources';

  -- Subscribe Atlanta to all new sources
  INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
  SELECT atlanta_id, s.id, 'all', true
  FROM sources s
  WHERE s.slug IN (
    'alan-avery-art-company', 'besharat-gallery', 'besharat-contemporary',
    'echo-contemporary', 'get-this-gallery', 'hathaway-contemporary',
    'zucot-gallery', 'atlanta-center-photography', 'tew-galleries',
    'spalding-nix-fine-art', 'one-contemporary', 'day-night-projects', 'mint-gallery',
    'apex-museum', 'exhibition-hub-atlanta', 'trap-music-museum',
    'dekalb-history-center', 'millennium-gate', 'museum-of-illusions-atlanta',
    'atlanta-monetary-museum',
    'emory-visual-arts-gallery', 'ernest-welch-gallery-gsu',
    'atlanta-clay-works', 'chastain-arts-center', 'windmill-arts', 'the-bakery-atlanta'
  )
  ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
    subscription_scope = 'all',
    is_active = true;

  RAISE NOTICE 'Subscribed Atlanta to new sources';

END $$;

-- Refresh materialized view
REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
