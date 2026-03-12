-- Wave 3 network feed sources: high-quality Atlanta publications
-- Adds 6 new RSS sources to expand the "Today in Atlanta" news digest

INSERT INTO network_sources (portal_id, name, slug, feed_url, website_url, description, categories)
VALUES
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'ArtsATL',
    'artsatl',
    'https://artsatl.org/feed/',
    'https://artsatl.org',
    'Atlanta''s nonprofit arts journalism covering visual art, theater, dance, music, and film',
    ARRAY['arts', 'culture']
  ),
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'Atlanta Magazine',
    'atlanta-magazine',
    'https://www.atlantamagazine.com/feed/',
    'https://www.atlantamagazine.com',
    'Long-running city magazine covering food, culture, neighborhoods, and Atlanta life',
    ARRAY['food', 'culture', 'news']
  ),
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'The Atlanta Voice',
    'the-atlanta-voice',
    'https://theatlantavoice.com/feed/',
    'https://theatlantavoice.com',
    'Black-owned newspaper covering Atlanta''s Black community, politics, and culture since 1966',
    ARRAY['news', 'community', 'culture']
  ),
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'Global Atlanta',
    'global-atlanta',
    'https://www.globalatlanta.com/feed/',
    'https://www.globalatlanta.com',
    'International affairs and multicultural community coverage for metro Atlanta',
    ARRAY['culture', 'community', 'news']
  ),
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'Reporter Newspapers',
    'reporter-newspapers',
    'https://reporternewspapers.net/feed/',
    'https://reporternewspapers.net',
    'Hyperlocal news for Buckhead, Brookhaven, and Dunwoody neighborhoods',
    ARRAY['news', 'neighborhoods']
  ),
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'Atlanta Parent',
    'atlanta-parent',
    'https://www.atlantaparent.com/feed/',
    'https://www.atlantaparent.com',
    'Family activities, camps, education, and parenting resources in metro Atlanta',
    ARRAY['community', 'culture']
  )
ON CONFLICT DO NOTHING;
