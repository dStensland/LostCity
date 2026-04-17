-- United States Artists Fellowship Awards source registration
--
-- United States Artists awards $50,000 unrestricted fellowships annually across
-- ten disciplines. NOMINATION-ONLY — no public application portal or deadline.
-- The crawler creates an informational record documenting the nomination process.
-- Crawler: crawlers/sources/open_calls_usa_fellowships.py

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'United States Artists Fellowships (Open Calls)',
  'open-calls-usa-fellowships',
  'scrape',
  'https://www.unitedstatesartists.org/programs/usa-fellowship',
  true,
  'monthly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
