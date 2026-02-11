-- Migration 180: Register new faith-based and civic volunteer sources
-- Purpose: Add 15 new Atlanta sources covering churches with community events,
--          volunteer organizations, and faith institutions with cultural programming.
-- These sources complement existing activism/civic engagement crawlers.

BEGIN;

INSERT INTO sources (slug, name, url, source_type, is_active, owner_portal_id)
VALUES
  ('all-saints-episcopal', 'All Saints'' Episcopal Church', 'https://www.allsaintsatlanta.org/events/', 'church', true,
    (SELECT id FROM portals WHERE slug = 'atlanta' LIMIT 1)),
  ('atlanta-community-food-bank', 'Atlanta Community Food Bank', 'https://www.acfb.org/volunteer', 'organization', true,
    (SELECT id FROM portals WHERE slug = 'atlanta' LIMIT 1)),
  ('baps-mandir', 'BAPS Shri Swaminarayan Mandir', 'https://www.baps.org/atlanta', 'church', true,
    (SELECT id FROM portals WHERE slug = 'atlanta' LIMIT 1)),
  ('cathedral-st-philip', 'Cathedral of St. Philip', 'https://www.cathedralofstphilip.org/concerts/', 'church', true,
    (SELECT id FROM portals WHERE slug = 'atlanta' LIMIT 1)),
  ('central-presbyterian', 'Central Presbyterian Church', 'https://www.cpcatlanta.org/music/', 'church', true,
    (SELECT id FROM portals WHERE slug = 'atlanta' LIMIT 1)),
  ('chabad-intown', 'Chabad Intown', 'https://www.chabadintownatl.com/events', 'church', true,
    (SELECT id FROM portals WHERE slug = 'atlanta' LIMIT 1)),
  ('city-of-refuge', 'City of Refuge', 'https://www.cityofrefugeatl.org/events/', 'organization', true,
    (SELECT id FROM portals WHERE slug = 'atlanta' LIMIT 1)),
  ('ebenezer-church', 'Ebenezer Baptist Church', 'https://www.ebenezeratlanta.org/events/', 'church', true,
    (SELECT id FROM portals WHERE slug = 'atlanta' LIMIT 1)),
  ('habitat-for-humanity-atlanta', 'Atlanta Habitat for Humanity', 'https://www.atlantahabitat.org/volunteer/', 'organization', true,
    (SELECT id FROM portals WHERE slug = 'atlanta' LIMIT 1)),
  ('lost-n-found-youth', 'Lost-n-Found Youth', 'https://www.lnfy.org/events/', 'organization', true,
    (SELECT id FROM portals WHERE slug = 'atlanta' LIMIT 1)),
  ('new-birth', 'New Birth Missionary Baptist Church', 'https://www.newbirth.org/events/', 'church', true,
    (SELECT id FROM portals WHERE slug = 'atlanta' LIMIT 1)),
  ('open-hand-atlanta', 'Open Hand Atlanta', 'https://www.openhandatlanta.org/volunteer/', 'organization', true,
    (SELECT id FROM portals WHERE slug = 'atlanta' LIMIT 1)),
  ('park-pride', 'Park Pride', 'https://www.parkpride.org/events', 'organization', true,
    (SELECT id FROM portals WHERE slug = 'atlanta' LIMIT 1)),
  ('passion-city', 'Passion City Church', 'https://www.passioncitychurch.com/events/', 'church', true,
    (SELECT id FROM portals WHERE slug = 'atlanta' LIMIT 1)),
  ('st-lukes-episcopal', 'St. Luke''s Episcopal Church', 'https://www.stlukesatlanta.org/music-arts/', 'church', true,
    (SELECT id FROM portals WHERE slug = 'atlanta' LIMIT 1))
ON CONFLICT (slug) DO NOTHING;

COMMIT;
