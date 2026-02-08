-- Migration: Add All Star Monster Truck Tour crawler
-- Touring monster truck show that visits Jim R. Miller Park in Marietta

-- Insert source
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active) VALUES
('All Star Monster Truck Tour', 'all-star-monster-trucks', 'https://www.allstarmonster.com/events', 'organization', 'weekly', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  url = EXCLUDED.url,
  is_active = EXCLUDED.is_active;

-- Ensure Jim R. Miller Park venue exists
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, website) VALUES
('Jim R. Miller Park', 'jim-r-miller-park', '2245 Callaway Rd SW', 'Marietta', 'Marietta', 'GA', '30008', 33.9271, -84.5868, 'event_space', 'https://www.cobbcounty.org')
ON CONFLICT (slug) DO UPDATE SET
  address = EXCLUDED.address,
  neighborhood = EXCLUDED.neighborhood,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  zip = EXCLUDED.zip,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  venue_type = EXCLUDED.venue_type,
  website = EXCLUDED.website;
