-- Register Rhizome as an open calls source.
--
-- Rhizome (rhizome.org) is the 30-year-old international hub for new media
-- art, affiliated with the New Museum. Their community bulletin board is a
-- moderated, globally respected aggregator of grants, residencies, commissions,
-- open calls, and exhibition opportunities in the born-digital / tech art world.
--
-- Assigned to the arts-atlanta portal (open calls content pillar).
-- Crawl frequency: weekly (new listings post continuously).

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'Rhizome (New Media Art Opportunities)',
  'open-calls-rhizome',
  'scrape',
  'https://rhizome.org/community/?type=opportunity',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
