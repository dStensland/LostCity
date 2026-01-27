-- Migration 077: Add Activism Organizations
-- ACLU Georgia, GLAHR, Atlanta Liberation Center, Indivisible ATL
-- These organizations host civic engagement, advocacy, and community organizing events

-- Add ACLU Georgia source
INSERT INTO sources (
    name,
    slug,
    url,
    source_type,
    crawl_schedule,
    is_active
) VALUES (
    'ACLU Georgia',
    'aclu-georgia',
    'https://www.acluga.org/events/',
    'organization',
    'weekly',
    true
) ON CONFLICT (slug) DO NOTHING;

-- Add GLAHR source
INSERT INTO sources (
    name,
    slug,
    url,
    source_type,
    crawl_schedule,
    is_active
) VALUES (
    'GLAHR - Georgia Latino Alliance for Human Rights',
    'glahr',
    'https://glahr.org/events/',
    'organization',
    'weekly',
    true
) ON CONFLICT (slug) DO NOTHING;

-- Add Atlanta Liberation Center source
INSERT INTO sources (
    name,
    slug,
    url,
    source_type,
    crawl_schedule,
    is_active
) VALUES (
    'Atlanta Liberation Center',
    'atlanta-liberation-center',
    'https://www.liberationatl.org/events',
    'organization',
    'weekly',
    true
) ON CONFLICT (slug) DO NOTHING;

-- Add Indivisible ATL source
INSERT INTO sources (
    name,
    slug,
    url,
    source_type,
    crawl_schedule,
    is_active
) VALUES (
    'Indivisible ATL',
    'indivisible-atl',
    'https://www.indivisibleatl.com/events',
    'organization',
    'weekly',
    true
) ON CONFLICT (slug) DO NOTHING;

-- Add ACLU Georgia venue (their office/event space)
INSERT INTO venues (
    name,
    slug,
    address,
    city,
    state,
    zip,
    neighborhood,
    venue_type,
    spot_type,
    website
) VALUES (
    'ACLU Georgia',
    'aclu-georgia',
    'PO Box 77208',
    'Atlanta',
    'GA',
    '30357',
    'Atlanta',
    'organization',
    'nonprofit',
    'https://www.acluga.org'
) ON CONFLICT (slug) DO NOTHING;

-- Add GLAHR venue
INSERT INTO venues (
    name,
    slug,
    address,
    city,
    state,
    zip,
    neighborhood,
    venue_type,
    spot_type,
    website,
    lat,
    lng
) VALUES (
    'GLAHR - Georgia Latino Alliance for Human Rights',
    'glahr',
    '2330 Cheshire Bridge Rd NE',
    'Atlanta',
    'GA',
    '30324',
    'Cheshire Bridge',
    'organization',
    'nonprofit',
    'https://glahr.org',
    33.8223,
    -84.3567
) ON CONFLICT (slug) DO NOTHING;

-- Add Atlanta Liberation Center venue (fixed location in Candler Park)
INSERT INTO venues (
    name,
    slug,
    address,
    city,
    state,
    zip,
    neighborhood,
    venue_type,
    spot_type,
    website,
    lat,
    lng
) VALUES (
    'Atlanta Liberation Center',
    'atlanta-liberation-center',
    '344 Candler Park Dr NE',
    'Atlanta',
    'GA',
    '30307',
    'Candler Park',
    'community_center',
    'nonprofit',
    'https://www.liberationatl.org',
    33.7621,
    -84.3428
) ON CONFLICT (slug) DO NOTHING;

-- Add Indivisible ATL venue (organization, no fixed venue)
INSERT INTO venues (
    name,
    slug,
    city,
    state,
    venue_type,
    spot_type,
    website
) VALUES (
    'Indivisible ATL',
    'indivisible-atl',
    'Atlanta',
    'GA',
    'organization',
    'nonprofit',
    'https://www.indivisibleatl.com'
) ON CONFLICT (slug) DO NOTHING;
