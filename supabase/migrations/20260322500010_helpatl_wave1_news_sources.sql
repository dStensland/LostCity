-- 20260322500010_helpatl_wave1_news_sources.sql
-- Add wave-1 civic news sources for HelpATL.
--
-- Saporta Report, Urbanize Atlanta, Atlanta Community Press Collective, and
-- Decaturish are all created under the Atlanta portal so HelpATL inherits them
-- automatically via its parent_portal_id = Atlanta. Do NOT reassign portal_id
-- for any existing sources.
--
-- Also corrects the atlanta-civic-circle feed URL (was producing only 10 posts
-- due to misconfiguration) without touching its portal ownership.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Fix atlanta-civic-circle feed URL (ownership stays with HelpATL as set by
--    migration 20260311132101). Only update feed_url and ensure is_active.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE network_sources
SET
  feed_url   = 'https://atlantaciviccircle.org/feed/',
  is_active  = true,
  updated_at = now()
WHERE slug = 'atlanta-civic-circle';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Insert wave-1 sources under Atlanta portal.
--    HelpATL inherits them via parent_portal_id without a portal_id reassignment.
--    ON CONFLICT only updates feed_url and is_active — never portal_id.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO network_sources (portal_id, name, slug, feed_url, website_url, description, categories)
VALUES
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'Saporta Report',
    'saporta-report',
    'https://saportareport.com/feed/',
    'https://saportareport.com',
    'Atlanta civic journalism covering city government, economic development, education, and regional policy.',
    ARRAY['news', 'civic', 'community']
  ),
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'Urbanize Atlanta',
    'urbanize-atlanta',
    'https://atlanta.urbanize.city/rss.xml',
    'https://atlanta.urbanize.city',
    'Development, transit, housing, and urban planning coverage focused on metro Atlanta.',
    ARRAY['news', 'civic', 'community']
  ),
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'Atlanta Community Press Collective',
    'atlanta-community-press-collective',
    'https://atlpresscollective.com/feed/',
    'https://atlpresscollective.com',
    'Community-centered journalism covering Atlanta neighborhoods, politics, and civic life.',
    ARRAY['news', 'civic', 'politics']
  ),
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'Decaturish',
    'decaturish',
    'https://decaturish.com/search/?f=rss&t=article',
    'https://decaturish.com',
    'Hyperlocal news for Decatur and surrounding DeKalb County communities.',
    ARRAY['news', 'civic', 'community']
  )
ON CONFLICT (slug) DO UPDATE
SET
  feed_url   = EXCLUDED.feed_url,
  is_active  = true,
  updated_at = now();
-- Intentionally NOT updating portal_id on conflict — existing ownership is preserved.

COMMIT;
