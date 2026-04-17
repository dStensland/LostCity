-- Register Artquest as a source for the Arts portal open calls board.
--
-- Artquest (artquest.org.uk/opportunities/) is run by University of the Arts
-- London and curates open calls, residencies, grants, fellowships, and
-- commissions for UK and international artists.
--
-- It is an aggregator, not a primary source, so confidence_tier on ingested
-- calls is "aggregated".  All calls carry metadata.scope = "international" to
-- enable the two-section board layout (local/regional vs national/international).
--
-- The index page renders all active listings statically; no Playwright required.

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'Artquest (Open Calls)',
  'open-calls-artquest',
  'scrape',
  'https://www.artquest.org.uk/opportunities/',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url       = EXCLUDED.url;
