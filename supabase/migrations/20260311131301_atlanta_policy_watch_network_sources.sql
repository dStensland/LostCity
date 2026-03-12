-- 20260311131300_atlanta_policy_watch_network_sources.sql
-- Add first-wave statewide policy reporting sources to the Atlanta network feed.

INSERT INTO network_sources (portal_id, name, slug, feed_url, website_url, description, categories)
VALUES
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'Georgia Recorder',
    'georgia-recorder',
    'https://georgiarecorder.com/feed/',
    'https://georgiarecorder.com',
    'Statehouse, elections, courts, and executive-branch reporting across Georgia.',
    ARRAY['news', 'civic', 'politics']
  ),
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'Capitol Beat',
    'capitol-beat',
    'https://capitol-beat.org/feed/',
    'https://capitol-beat.org',
    'Georgia politics and government reporting focused on the legislature, statewide policy, and campaigns.',
    ARRAY['news', 'civic', 'politics']
  )
ON CONFLICT (slug) DO UPDATE
SET
  portal_id = EXCLUDED.portal_id,
  name = EXCLUDED.name,
  feed_url = EXCLUDED.feed_url,
  website_url = EXCLUDED.website_url,
  description = EXCLUDED.description,
  categories = EXCLUDED.categories,
  is_active = true,
  updated_at = now();
