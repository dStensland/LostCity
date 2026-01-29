-- Migration 082: Add Mobilize.us Organizations
-- Activism and civic engagement organizations that post events on Mobilize.us
-- Excludes individual political campaigns

-- ============================================================================
-- EVENT PRODUCERS (Organizations)
-- ============================================================================

-- DeKalb County Democrats
INSERT INTO event_producers (
    id, name, slug, org_type, website, categories, city, description
) VALUES (
    'dekalb-county-democrats',
    'DeKalb County Democrats',
    'dekalb-county-democrats',
    'political_party',
    'https://www.mobilize.us/dekalbdems/',
    ARRAY['community', 'other'],
    'Atlanta',
    'DeKalb County Democratic Party - civic engagement, voter registration, and community events'
) ON CONFLICT (id) DO NOTHING;

-- Democratic Party of Georgia
INSERT INTO event_producers (
    id, name, slug, org_type, website, categories, city, description
) VALUES (
    'democratic-party-of-georgia',
    'Democratic Party of Georgia',
    'democratic-party-of-georgia',
    'political_party',
    'https://www.mobilize.us/georgiademocrats/',
    ARRAY['community', 'other'],
    'Atlanta',
    'Georgia Democratic Party - statewide civic engagement and voter mobilization'
) ON CONFLICT (id) DO NOTHING;

-- Indivisible Cobb
INSERT INTO event_producers (
    id, name, slug, org_type, website, categories, city, description
) VALUES (
    'indivisible-cobb',
    'Indivisible Cobb',
    'indivisible-cobb',
    'advocacy_org',
    'https://www.mobilize.us/indivisiblecobb/',
    ARRAY['community', 'other'],
    'Marietta',
    'Cobb County chapter of Indivisible - progressive grassroots activism and civic engagement'
) ON CONFLICT (id) DO NOTHING;

-- Indivisible Cherokee United
INSERT INTO event_producers (
    id, name, slug, org_type, website, categories, city, description
) VALUES (
    'indivisible-cherokee-united',
    'Indivisible Cherokee United',
    'indivisible-cherokee-united',
    'advocacy_org',
    'https://www.mobilize.us/indivisiblecherokeeunited/',
    ARRAY['community', 'other'],
    'Woodstock',
    'Cherokee County chapter of Indivisible - progressive grassroots activism'
) ON CONFLICT (id) DO NOTHING;

-- Indivisible Georgia District 10
INSERT INTO event_producers (
    id, name, slug, org_type, website, categories, city, description
) VALUES (
    'indivisible-ga10',
    'Indivisible Georgia District 10',
    'indivisible-ga10',
    'advocacy_org',
    'https://www.mobilize.us/indivisiblega10/',
    ARRAY['community', 'other'],
    'Athens',
    'Georgia Congressional District 10 chapter of Indivisible - Athens area progressive activism'
) ON CONFLICT (id) DO NOTHING;

-- HRC in Georgia (Human Rights Campaign)
INSERT INTO event_producers (
    id, name, slug, org_type, website, categories, city, description
) VALUES (
    'hrc-georgia',
    'HRC in Georgia',
    'hrc-georgia',
    'advocacy_org',
    'https://www.mobilize.us/hrcingeorgia/',
    ARRAY['community', 'other'],
    'Atlanta',
    'Human Rights Campaign Georgia - LGBTQ+ advocacy, civic engagement, and community events'
) ON CONFLICT (id) DO NOTHING;

-- 50501 Georgia
INSERT INTO event_producers (
    id, name, slug, org_type, website, categories, city, description
) VALUES (
    '50501-georgia',
    '50501 Georgia',
    '50501-georgia',
    'advocacy_org',
    'https://www.mobilize.us/50501georgia/',
    ARRAY['community', 'other'],
    'Atlanta',
    '50501 Georgia - immigration justice and community advocacy'
) ON CONFLICT (id) DO NOTHING;

-- Necessary Trouble
INSERT INTO event_producers (
    id, name, slug, org_type, website, categories, city, description
) VALUES (
    'necessary-trouble',
    'Necessary Trouble',
    'necessary-trouble',
    'mutual_aid',
    'https://www.mobilize.us/necessarytrouble/',
    ARRAY['community', 'food_drink'],
    'Atlanta',
    'Necessary Trouble - mutual aid, food security, and community organizing in Atlanta'
) ON CONFLICT (id) DO NOTHING;

-- VoteRiders
INSERT INTO event_producers (
    id, name, slug, org_type, website, categories, city, description
) VALUES (
    'voteriders',
    'VoteRiders',
    'voteriders',
    'advocacy_org',
    'https://www.mobilize.us/voteriders/',
    ARRAY['community', 'other'],
    'Atlanta',
    'VoteRiders - voter ID assistance and education to ensure every citizen can vote'
) ON CONFLICT (id) DO NOTHING;

-- Update existing Indivisible ATL producer if it exists, or create it
INSERT INTO event_producers (
    id, name, slug, org_type, website, categories, city, description
) VALUES (
    'indivisible-atl',
    'Indivisible ATL',
    'indivisible-atl',
    'advocacy_org',
    'https://www.mobilize.us/indivisibleatl/',
    ARRAY['community', 'other'],
    'Atlanta',
    'Atlanta chapter of Indivisible - progressive grassroots activism and civic engagement'
) ON CONFLICT (id) DO UPDATE SET
    website = EXCLUDED.website,
    description = EXCLUDED.description;

-- ============================================================================
-- SOURCES (for crawling)
-- ============================================================================

-- DeKalb County Democrats
INSERT INTO sources (
    name, slug, url, source_type, crawl_frequency, is_active, producer_id
) VALUES (
    'DeKalb County Democrats (Mobilize)',
    'mobilize-dekalb-dems',
    'https://www.mobilize.us/dekalbdems/',
    'mobilize',
    'daily',
    true,
    'dekalb-county-democrats'
) ON CONFLICT (slug) DO NOTHING;

-- Democratic Party of Georgia
INSERT INTO sources (
    name, slug, url, source_type, crawl_frequency, is_active, producer_id
) VALUES (
    'Democratic Party of Georgia (Mobilize)',
    'mobilize-ga-dems',
    'https://www.mobilize.us/georgiademocrats/',
    'mobilize',
    'daily',
    true,
    'democratic-party-of-georgia'
) ON CONFLICT (slug) DO NOTHING;

-- Indivisible ATL (Mobilize version - separate from their own website)
INSERT INTO sources (
    name, slug, url, source_type, crawl_frequency, is_active, producer_id
) VALUES (
    'Indivisible ATL (Mobilize)',
    'mobilize-indivisible-atl',
    'https://www.mobilize.us/indivisibleatl/',
    'mobilize',
    'daily',
    true,
    'indivisible-atl'
) ON CONFLICT (slug) DO NOTHING;

-- Indivisible Cobb
INSERT INTO sources (
    name, slug, url, source_type, crawl_frequency, is_active, producer_id
) VALUES (
    'Indivisible Cobb (Mobilize)',
    'mobilize-indivisible-cobb',
    'https://www.mobilize.us/indivisiblecobb/',
    'mobilize',
    'daily',
    true,
    'indivisible-cobb'
) ON CONFLICT (slug) DO NOTHING;

-- Indivisible Cherokee United
INSERT INTO sources (
    name, slug, url, source_type, crawl_frequency, is_active, producer_id
) VALUES (
    'Indivisible Cherokee United (Mobilize)',
    'mobilize-indivisible-cherokee',
    'https://www.mobilize.us/indivisiblecherokeeunited/',
    'mobilize',
    'daily',
    true,
    'indivisible-cherokee-united'
) ON CONFLICT (slug) DO NOTHING;

-- Indivisible Georgia District 10
INSERT INTO sources (
    name, slug, url, source_type, crawl_frequency, is_active, producer_id
) VALUES (
    'Indivisible GA District 10 (Mobilize)',
    'mobilize-indivisible-ga10',
    'https://www.mobilize.us/indivisiblega10/',
    'mobilize',
    'daily',
    true,
    'indivisible-ga10'
) ON CONFLICT (slug) DO NOTHING;

-- HRC in Georgia
INSERT INTO sources (
    name, slug, url, source_type, crawl_frequency, is_active, producer_id
) VALUES (
    'HRC in Georgia (Mobilize)',
    'mobilize-hrc-georgia',
    'https://www.mobilize.us/hrcingeorgia/',
    'mobilize',
    'daily',
    true,
    'hrc-georgia'
) ON CONFLICT (slug) DO NOTHING;

-- 50501 Georgia
INSERT INTO sources (
    name, slug, url, source_type, crawl_frequency, is_active, producer_id
) VALUES (
    '50501 Georgia (Mobilize)',
    'mobilize-50501-georgia',
    'https://www.mobilize.us/50501georgia/',
    'mobilize',
    'daily',
    true,
    '50501-georgia'
) ON CONFLICT (slug) DO NOTHING;

-- Necessary Trouble
INSERT INTO sources (
    name, slug, url, source_type, crawl_frequency, is_active, producer_id
) VALUES (
    'Necessary Trouble (Mobilize)',
    'mobilize-necessary-trouble',
    'https://www.mobilize.us/necessarytrouble/',
    'mobilize',
    'daily',
    true,
    'necessary-trouble'
) ON CONFLICT (slug) DO NOTHING;

-- VoteRiders
INSERT INTO sources (
    name, slug, url, source_type, crawl_frequency, is_active, producer_id
) VALUES (
    'VoteRiders (Mobilize)',
    'mobilize-voteriders',
    'https://www.mobilize.us/voteriders/',
    'mobilize',
    'daily',
    true,
    'voteriders'
) ON CONFLICT (slug) DO NOTHING;
