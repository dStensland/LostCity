-- 264_network_sources_wave2.sql
-- Wave 2 of network sources: 7 more independent Atlanta publications.
-- Expands coverage in civic, neighborhoods, food, and development beats.

INSERT INTO network_sources (portal_id, name, slug, feed_url, website_url, description, categories) VALUES
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'SaportaReport',
    'saporta-report',
    'https://saportareport.com/feed/',
    'https://saportareport.com',
    'Maria Saporta''s independent civic journalism covering Atlanta business, politics, and community development.',
    ARRAY['news', 'civic', 'politics']
  ),
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'Atlanta Civic Circle',
    'atlanta-civic-circle',
    'https://atlantaciviccircle.org/feed/',
    'https://atlantaciviccircle.org',
    'Nonprofit civic journalism covering local government, housing policy, transit, and elections in metro Atlanta.',
    ARRAY['civic', 'politics', 'community']
  ),
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'Urbanize Atlanta',
    'urbanize-atlanta',
    'https://atlanta.urbanize.city/rss.xml',
    'https://atlanta.urbanize.city',
    'Architecture, urban planning, and real estate development news from Decatur to West End and beyond.',
    ARRAY['news', 'neighborhoods']
  ),
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'What Now Atlanta',
    'what-now-atlanta',
    'https://whatnow.com/atlanta/feed/',
    'https://whatnow.com/atlanta/',
    'The latest restaurant, retail, and real estate openings and closings across Atlanta.',
    ARRAY['food', 'restaurants', 'neighborhoods']
  ),
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'Decaturish',
    'decaturish',
    'https://www.decaturish.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc',
    'https://www.decaturish.com',
    'Hyperlocal independent news covering Decatur, DeKalb County, and surrounding neighborhoods.',
    ARRAY['news', 'neighborhoods', 'community']
  ),
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'Eater Atlanta',
    'eater-atlanta',
    'https://atlanta.eater.com/rss/index.xml',
    'https://atlanta.eater.com',
    'Food news, restaurant reviews, and dining guides for Atlanta.',
    ARRAY['food', 'restaurants', 'culture']
  ),
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'Hypepotamus',
    'hypepotamus',
    'https://hypepotamus.com/feed/',
    'https://hypepotamus.com',
    'Atlanta and Southeast startup news, founder spotlights, and tech ecosystem coverage.',
    ARRAY['news', 'culture']
  );
