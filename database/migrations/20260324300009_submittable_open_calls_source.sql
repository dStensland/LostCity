-- Register Submittable as a source for the Arts portal open calls board.
--
-- Submittable (submittable.com) is the dominant submission management platform
-- for arts organizations. This crawler targets a curated list of arts org
-- subdomains ({org}.submittable.com/submit) and extracts their open calls
-- from the publicly accessible server-rendered HTML.
--
-- NOTE: discover.submittable.com is a WordPress editorial blog, NOT a listings
-- directory. Submittable's actual public discovery UI (app.submittable.com/discover)
-- is login-gated. This crawler uses the publicly accessible per-org /submit pages.
--
-- confidence_tier = "aggregated" because Submittable is a platform, not the
-- issuing organization. metadata.scope varies per call (regional/national/international).

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'Submittable (Open Calls)',
  'open-calls-submittable',
  'scrape',
  'https://discover.submittable.com/',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
