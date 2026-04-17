-- Register Artenda as an open calls source for the Arts portal.
--
-- Artenda (artenda.net) is a multi-discipline open calls aggregator covering
-- competitions, exhibition proposals, artist residencies, public art RFPs,
-- project grants, and stipends/fellowships. It has notably strong public-art
-- coverage with municipal RFPs and RFQs — a category underserved by most
-- other aggregators we crawl.
--
-- Free-tier access: 15 results per category × 6 categories = up to 90 open
-- calls per crawl run. No pagination is accessible without a subscription.
-- Weekly cadence is appropriate given this volume.

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'Artenda (Multi-Discipline Open Calls)',
  'open-calls-artenda',
  'scrape',
  'https://artenda.net/art-open-call-opportunity',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
