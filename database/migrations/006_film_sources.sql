-- ============================================
-- MIGRATION 006: Film Sources
-- ============================================
-- Adds film-related event sources:
-- Cinemas:
-- 1. Plaza Theatre (historic indie cinema)
-- 2. Tara Theatre (art house cinema)
-- 3. Landmark Midtown Art Cinema
-- Film Festivals:
-- 4. Atlanta Film Festival
-- 5. Out on Film (LGBTQ film festival)
-- 6. Atlanta Jewish Film Festival (AJFF)

-- Plaza Theatre
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'plaza-theatre',
    'Plaza Theatre',
    'https://plazaatlanta.com',
    'website',
    true,
    'daily'
)
ON CONFLICT (slug) DO NOTHING;

-- Tara Theatre
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'tara-theatre',
    'Tara Theatre',
    'https://www.taraatlanta.com',
    'website',
    true,
    'daily'
)
ON CONFLICT (slug) DO NOTHING;

-- Landmark Midtown Art Cinema
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'landmark-midtown',
    'Landmark Midtown Art Cinema',
    'https://www.landmarktheatres.com/atlanta/midtown-art-cinema',
    'website',
    true,
    'daily'
)
ON CONFLICT (slug) DO NOTHING;

-- Atlanta Film Festival
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'atlanta-film-festival',
    'Atlanta Film Festival',
    'https://www.atlantafilmfestival.com',
    'website',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

-- Out on Film
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'out-on-film',
    'Out on Film',
    'https://outonfilm.org',
    'website',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

-- Atlanta Jewish Film Festival
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'ajff',
    'Atlanta Jewish Film Festival',
    'https://www.ajff.org',
    'website',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

-- Add cinema venues

INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'plaza-theatre',
    'Plaza Theatre',
    '1049 Ponce De Leon Ave NE',
    'Poncey-Highland',
    'Atlanta',
    'GA',
    '30306',
    'cinema',
    'https://plazaatlanta.com'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'tara-theatre',
    'Tara Theatre',
    '2345 Cheshire Bridge Rd NE',
    'Cheshire Bridge',
    'Atlanta',
    'GA',
    '30324',
    'cinema',
    'https://www.taraatlanta.com'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'landmark-midtown-art-cinema',
    'Landmark Midtown Art Cinema',
    '931 Monroe Drive NE',
    'Midtown',
    'Atlanta',
    'GA',
    '30308',
    'cinema',
    'https://www.landmarktheatres.com/atlanta/midtown-art-cinema'
)
ON CONFLICT (slug) DO NOTHING;

-- Festival venues (virtual/multi-location)
INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'atlanta-film-festival',
    'Atlanta Film Festival',
    '535 Means St NW',
    'Midtown',
    'Atlanta',
    'GA',
    '30318',
    'festival',
    'https://www.atlantafilmfestival.com'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'out-on-film',
    'Out on Film Festival',
    '931 Monroe Drive NE',
    'Midtown',
    'Atlanta',
    'GA',
    '30308',
    'festival',
    'https://outonfilm.org'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'atlanta-jewish-film-festival',
    'Atlanta Jewish Film Festival',
    '1440 Spring St NW',
    'Midtown',
    'Atlanta',
    'GA',
    '30309',
    'festival',
    'https://www.ajff.org'
)
ON CONFLICT (slug) DO NOTHING;
