-- TransArtists: world's largest artist residency database (~480 active open calls,
-- 80+ countries). Operated by DutchCulture (Dutch center for international arts
-- cooperation). Primary content type: residencies. All calls are international scope.
INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'TransArtists (International Residencies)',
  'open-calls-transartists',
  'scrape',
  'https://www.transartists.org/en/transartists-calls',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
