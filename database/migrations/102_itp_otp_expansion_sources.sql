-- Migration: Add ITP/OTP Expansion Sources (Sessions 4-12)
-- 31 new crawlers from the 12-session geographic expansion plan

-- ===== ITP Neighborhoods: Southside Extended (Session 4) =====
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES
    ('pittsburgh-yards', 'Pittsburgh Yards', 'https://pittsburghyards.com', 'website', true, 'daily'),
    ('ormewood-park-neighborhood', 'Ormewood Park Civic Association', 'https://ormewoodpark.org', 'website', true, 'daily'),
    ('peoplestown-neighborhood', 'Peoplestown Neighborhood', 'https://www.peoplestown.org', 'website', true, 'daily'),
    ('mechanicsville-neighborhood', 'Mechanicsville Neighborhood (NPU-V)', 'https://www.atlantaga.gov/government/departments/city-planning/office-of-zoning-development/neighborhood-planning-unit/npu-v', 'website', true, 'daily')
ON CONFLICT (slug) DO NOTHING;

-- ===== ITP Neighborhoods: Northside (Session 5) =====
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES
    ('virginia-highland-civic', 'Virginia-Highland Civic Association', 'https://vahi.org', 'website', true, 'daily'),
    ('morningside-civic', 'Morningside Lenox Park Association', 'https://mlpa.org', 'website', true, 'daily'),
    ('ansley-park-civic', 'Ansley Park Civic Association', 'https://ansleypark.org', 'website', true, 'daily'),
    ('piedmont-heights-civic', 'Piedmont Heights Civic Association', 'https://piedmontheights.org', 'website', true, 'daily')
ON CONFLICT (slug) DO NOTHING;

-- ===== ITP Commercial Corridors (Session 6) =====
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES
    ('atlantic-station', 'Atlantic Station', 'https://atlanticstation.com', 'website', true, 'daily'),
    ('lindbergh-city-center', 'Lindbergh City Center', 'https://lindberghcitycenter.com', 'website', true, 'daily'),
    ('cheshire-bridge-district', 'Cheshire Bridge District', 'https://cheshirebridge.com', 'website', true, 'daily')
ON CONFLICT (slug) DO NOTHING;

-- ===== ITP Historic/Cultural Districts (Session 7) =====
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES
    ('hammonds-house', 'Hammonds House Museum', 'https://hammondshouse.org', 'website', true, 'daily'),
    ('castleberry-art-stroll', 'Castleberry Hill Art Stroll', 'https://castleberryhill.org', 'website', true, 'daily'),
    ('west-end-neighborhood', 'Historic West End Neighborhood', 'https://historicwestend.com', 'website', true, 'daily')
ON CONFLICT (slug) DO NOTHING;

-- ===== ITP Gap Cleanup (Session 8) =====
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES
    ('music-midtown', 'Music Midtown Festival', 'https://www.musicmidtown.com', 'website', true, 'daily'),
    ('east-lake-neighborhood', 'East Lake Neighborhood', 'https://eastlakefoundation.org', 'website', true, 'daily'),
    ('vine-city-neighborhood', 'Vine City Neighborhood (NPU-L)', 'https://www.atlantaga.gov/government/departments/city-planning/office-of-zoning-development/neighborhood-planning-unit/npu-l', 'website', true, 'daily')
ON CONFLICT (slug) DO NOTHING;

-- ===== OTP: North Fulton - Alpharetta, Roswell (Session 9) =====
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES
    ('alpharetta-city', 'City of Alpharetta', 'https://www.alpharetta.ga.us', 'website', true, 'daily'),
    ('roswell-city', 'City of Roswell', 'https://www.roswellgov.com', 'website', true, 'daily'),
    ('canton-street-roswell', 'Canton Street Roswell', 'https://www.visitroswellga.com/canton-street', 'website', true, 'daily'),
    ('variant-brewing', 'Variant Brewing', 'https://variantbrewing.com', 'website', true, 'daily')
ON CONFLICT (slug) DO NOTHING;

-- ===== OTP: Gwinnett - Johns Creek, Duluth (Session 10) =====
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES
    ('duluth-city', 'City of Duluth', 'https://www.duluthga.gov', 'website', true, 'daily'),
    ('hudgens-center', 'Hudgens Center for Art & Learning', 'https://thehudgens.org', 'website', true, 'daily'),
    ('downtown-duluth', 'Downtown Duluth', 'https://exploreduluth.org', 'website', true, 'daily')
ON CONFLICT (slug) DO NOTHING;

-- ===== OTP: East Gwinnett - Lawrenceville, Snellville (Session 11) =====
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES
    ('lawrenceville-city', 'City of Lawrenceville', 'https://www.lawrencevillega.org', 'website', true, 'daily'),
    ('snellville-city', 'City of Snellville', 'https://www.snellville.org', 'website', true, 'daily'),
    ('snellville-farmers-market', 'Snellville Farmers Market', 'https://snellvillefarmersmarket.com', 'website', true, 'daily')
ON CONFLICT (slug) DO NOTHING;

-- ===== OTP: Cobb - Kennesaw, Acworth (Session 12) =====
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES
    ('kennesaw-city', 'City of Kennesaw', 'https://www.kennesaw-ga.gov', 'website', true, 'daily'),
    ('acworth-city', 'City of Acworth', 'https://acworth-ga.gov', 'website', true, 'daily'),
    ('caffeine-octane', 'Caffeine and Octane', 'https://www.caffeine-and-octane.com', 'website', true, 'daily'),
    ('southern-museum', 'Southern Museum of Civil War and Locomotive History', 'https://www.southernmuseum.org', 'website', true, 'daily')
ON CONFLICT (slug) DO NOTHING;
