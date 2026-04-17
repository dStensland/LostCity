-- Ensure ZAPP source row is present and active.
-- The canonical source was first seeded in 20260324900004_zapp_source.sql.
-- This migration corrects the name and URL to match the open_calls_zapp crawler.
INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'ZAPP (Art Fairs & Craft Shows)',
  'open-calls-zapp',
  'scrape',
  'https://www.zapplication.org',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = true,
  url = EXCLUDED.url;
