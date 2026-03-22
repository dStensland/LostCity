-- ============================================
-- MIGRATION 20260322200000: Atlanta City Council IQM2 Source
-- ============================================
-- Registers the IQM2 RSS feed for Atlanta City Council and committee meetings.
-- Owned by HelpATL (the civic portal). Shared with Atlanta via subscription.
--
-- This source supplements the existing 'atlanta-city-meetings' Playwright crawler
-- by covering all 7 standing committees via the IQM2 calendar RSS feed (~163 meetings/year).
-- Content-hash deduplication prevents duplicates between the two sources.

DO $$
DECLARE
  helpatl_id UUID;
  atlanta_id  UUID;
  src_id      UUID;
BEGIN
  SELECT id INTO helpatl_id FROM portals WHERE slug = 'helpatl';
  SELECT id INTO atlanta_id  FROM portals WHERE slug = 'atlanta';

  IF helpatl_id IS NULL THEN
    RAISE EXCEPTION 'HelpATL portal not found. Cannot register Atlanta City Council source.';
  END IF;

  IF atlanta_id IS NULL THEN
    RAISE EXCEPTION 'Atlanta portal not found. Cannot register Atlanta subscription.';
  END IF;

  -- Register or update the source
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
  VALUES (
    'atlanta-city-council',
    'Atlanta City Council Meetings (IQM2)',
    'https://atlantacityga.iqm2.com/Services/RSS.aspx?Feed=Calendar',
    'organization',
    'daily',
    true,
    'scrape',
    helpatl_id
  )
  ON CONFLICT (slug) DO UPDATE SET
    name               = EXCLUDED.name,
    url                = EXCLUDED.url,
    source_type        = EXCLUDED.source_type,
    crawl_frequency    = EXCLUDED.crawl_frequency,
    is_active          = EXCLUDED.is_active,
    integration_method = EXCLUDED.integration_method,
    owner_portal_id    = EXCLUDED.owner_portal_id;

  SELECT id INTO src_id FROM sources WHERE slug = 'atlanta-city-council';

  -- Sharing rule: HelpATL owns, shared with all portals
  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  VALUES (src_id, helpatl_id, 'all')
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = EXCLUDED.owner_portal_id,
    share_scope     = EXCLUDED.share_scope;

  -- Atlanta portal subscription
  INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
  VALUES (atlanta_id, src_id, 'all', true)
  ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
    subscription_scope = EXCLUDED.subscription_scope,
    is_active          = EXCLUDED.is_active;

  RAISE NOTICE 'Atlanta City Council IQM2 source registered (id: %)', src_id;
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
