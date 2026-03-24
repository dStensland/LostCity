-- Register Dancing Opportunities as an open calls source.
--
-- dancingopportunities.com is the world's largest dance open calls aggregator,
-- covering auditions, residencies, and performance open calls internationally.
-- Content is Europe-heavy but includes US and global opportunities.
--
-- Assigned to the arts-atlanta portal (open calls content pillar).
-- Crawl frequency: weekly (new listings post continuously).

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'Dancing Opportunities (Dance Open Calls)',
  'open-calls-dancing-opportunities',
  'scrape',
  'https://dancingopportunities.com',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
