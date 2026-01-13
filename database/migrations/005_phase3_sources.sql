-- ============================================
-- MIGRATION 005: Phase 3 Major Venues
-- ============================================
-- Adds event sources from Phase 3:
-- Major venues not covered by Ticketmaster
-- 1. Eddie's Attic (legendary acoustic venue)
-- 2. Smith's Olde Bar (Midtown live music)
-- 3. City Winery Atlanta (dinner + shows)
-- 4. Laughing Skull Lounge (comedy club)
-- 5. Punchline Comedy Club (national touring acts)
-- 6. Atlanta Ballet (professional ballet)
-- 7. Atlanta Opera (professional opera)
-- 8. Center for Puppetry Arts (family performances)

-- Eddie's Attic
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'eddies-attic',
    'Eddie''s Attic',
    'https://eddiesattic.com',
    'website',
    true,
    'daily'
)
ON CONFLICT (slug) DO NOTHING;

-- Smith's Olde Bar
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'smiths-olde-bar',
    'Smith''s Olde Bar',
    'https://smithsoldebar.com',
    'website',
    true,
    'daily'
)
ON CONFLICT (slug) DO NOTHING;

-- City Winery Atlanta
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'city-winery-atlanta',
    'City Winery Atlanta',
    'https://citywinery.com/atlanta',
    'website',
    true,
    'daily'
)
ON CONFLICT (slug) DO NOTHING;

-- Laughing Skull Lounge
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'laughing-skull',
    'Laughing Skull Lounge',
    'https://laughingskulllounge.com',
    'website',
    true,
    'daily'
)
ON CONFLICT (slug) DO NOTHING;

-- Punchline Comedy Club
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'punchline',
    'Punchline Comedy Club',
    'https://punchline.com',
    'website',
    true,
    'daily'
)
ON CONFLICT (slug) DO NOTHING;

-- Atlanta Ballet
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'atlanta-ballet',
    'Atlanta Ballet',
    'https://atlantaballet.com',
    'website',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

-- Atlanta Opera
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'atlanta-opera',
    'Atlanta Opera',
    'https://www.atlantaopera.org',
    'website',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

-- Center for Puppetry Arts
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'puppetry-arts',
    'Center for Puppetry Arts',
    'https://puppet.org',
    'website',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

-- Add venues (crawlers will also create via get_or_create_venue)

INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'eddies-attic',
    'Eddie''s Attic',
    '515-B N McDonough St',
    'Decatur',
    'Decatur',
    'GA',
    '30030',
    'music_venue',
    'https://eddiesattic.com'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'smiths-olde-bar',
    'Smith''s Olde Bar',
    '1578 Piedmont Ave NE',
    'Midtown',
    'Atlanta',
    'GA',
    '30324',
    'music_venue',
    'https://smithsoldebar.com'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'city-winery-atlanta',
    'City Winery Atlanta',
    '650 North Ave NE',
    'Ponce City Market',
    'Atlanta',
    'GA',
    '30308',
    'music_venue',
    'https://citywinery.com/atlanta'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'laughing-skull-lounge',
    'Laughing Skull Lounge',
    '878 Peachtree St NE',
    'Midtown',
    'Atlanta',
    'GA',
    '30309',
    'comedy_club',
    'https://laughingskulllounge.com'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'punchline-comedy-club',
    'Punchline Comedy Club',
    '3652 Roswell Rd NE',
    'Buckhead',
    'Atlanta',
    'GA',
    '30342',
    'comedy_club',
    'https://punchline.com'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'cobb-energy-centre',
    'Cobb Energy Performing Arts Centre',
    '2800 Cobb Galleria Pkwy',
    'Galleria',
    'Atlanta',
    'GA',
    '30339',
    'performing_arts',
    'https://www.cobbenergycentre.com'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'center-for-puppetry-arts',
    'Center for Puppetry Arts',
    '1404 Spring St NW',
    'Midtown',
    'Atlanta',
    'GA',
    '30309',
    'museum',
    'https://puppet.org'
)
ON CONFLICT (slug) DO NOTHING;
