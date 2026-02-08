-- Migration 140: Add sources and venues for smaller events from gap research
--
-- New sources: MJCCA, Limelight Theater, Georgia Craft Brewers Guild
-- New venue: Marcus Jewish Community Center of Atlanta

-- =============================================
-- NEW VENUE: Marcus JCC
-- =============================================

INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, website, image_url)
VALUES (
  'Marcus Jewish Community Center of Atlanta',
  'marcus-jewish-community-center',
  '5342 Tilly Mill Rd, Dunwoody, GA 30338',
  'Dunwoody',
  'Atlanta',
  'GA',
  '30338',
  33.9326,
  -84.3046,
  'community_center',
  'https://www.atlantajcc.org',
  NULL
)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- NEW SOURCES
-- =============================================

INSERT INTO sources (slug, name, url, source_type, is_active, owner_portal_id)
VALUES
  ('mjcca', 'Marcus Jewish Community Center of Atlanta', 'https://www.atlantajcc.org/events/', 'venue', true,
    (SELECT id FROM portals WHERE slug = 'atlanta' LIMIT 1)),
  ('limelight-theater', 'Limelight Theater', 'https://www.limelightatl.com/events', 'venue', true,
    (SELECT id FROM portals WHERE slug = 'atlanta' LIMIT 1)),
  ('georgia-craft-brewers-guild', 'Georgia Craft Brewers Guild', 'https://www.georgiacraftbrewersguild.org/events', 'organization', true,
    (SELECT id FROM portals WHERE slug = 'atlanta' LIMIT 1))
ON CONFLICT (slug) DO NOTHING;
