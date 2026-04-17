-- Register Forecast Public Art as an open-calls source for the Arts portal.
--
-- Forecast Public Art (St. Paul, MN) maintains a curated rolling list of
-- ~30–35 public art opportunities: RFQs, commissions, grants, fellowships,
-- and residencies, organized into four regional tabs (Eastern U.S.,
-- Minnesota/Midwest, Western U.S., International).
--
-- The page is static WordPress (Avada theme), server-rendered. No JS required.
-- Crawl frequency: weekly — the page is updated on a rolling basis, not monthly.
--
-- Confidence tier: aggregated (Forecast curates other orgs' calls).
-- Scope: national (all U.S. regions + international tab).
--
-- Crawler: crawlers/sources/open_calls_forecast.py
-- Table:   open_calls (not events)

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'Forecast Public Art (Artist Opportunities)',
  'open-calls-forecast',
  'scrape',
  'https://forecastpublicart.org/consulting/artist-support/artist-opportunities/',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
