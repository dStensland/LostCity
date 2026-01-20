-- ============================================
-- MIGRATION 021: Piedmont Fitness Centers & Metro Atlanta Locations
-- ============================================
-- Adds Piedmont fitness centers and key metro Atlanta hospital locations as spots/venues

-- ===============================
-- FITNESS CENTERS
-- ===============================

-- Piedmont Atlanta Fitness Center
INSERT INTO venues (name, slug, address, city, state, zip, neighborhood, lat, lng, spot_type, website, phone)
VALUES (
    'Piedmont Atlanta Fitness Center',
    'piedmont-atlanta-fitness-center',
    '2001 Peachtree Road NE, Suite 100',
    'Atlanta',
    'GA',
    '30309',
    'Buckhead',
    33.8126,
    -84.3857,
    'fitness_center',
    'https://www.piedmont.org/locations/fitness-centers/atlanta-fitness-center',
    '404.605.1966'
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    website = EXCLUDED.website,
    phone = EXCLUDED.phone;

-- Piedmont Newnan Fitness Center
INSERT INTO venues (name, slug, address, city, state, zip, lat, lng, spot_type, website, phone)
VALUES (
    'Piedmont Newnan Fitness Center',
    'piedmont-newnan-fitness-center',
    '26 West Court Square',
    'Newnan',
    'GA',
    '30265',
    33.3807,
    -84.7997,
    'fitness_center',
    'https://www.piedmont.org/locations/fitness-centers/newnan-fitness-center',
    '770.254.3550'
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    website = EXCLUDED.website,
    phone = EXCLUDED.phone;

-- Piedmont Wellness Center Fayetteville (update existing or insert)
INSERT INTO venues (name, slug, address, city, state, zip, lat, lng, spot_type, website, phone)
VALUES (
    'Piedmont Wellness Center Fayetteville',
    'piedmont-wellness-fayetteville',
    '200 Trilith Parkway',
    'Fayetteville',
    'GA',
    '30214',
    33.4318,
    -84.4549,
    'fitness_center',
    'https://www.piedmontwellnesscenter.com/',
    '678.604.6275'
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    website = EXCLUDED.website,
    phone = EXCLUDED.phone;

-- ===============================
-- METRO ATLANTA HOSPITALS
-- ===============================

-- Piedmont Atlanta Hospital (main campus)
INSERT INTO venues (name, slug, address, city, state, zip, neighborhood, lat, lng, spot_type, website)
VALUES (
    'Piedmont Atlanta Hospital',
    'piedmont-atlanta-hospital',
    '1968 Peachtree Road NW',
    'Atlanta',
    'GA',
    '30309',
    'Buckhead',
    33.8126,
    -84.3857,
    'hospital',
    'https://www.piedmont.org/locations/piedmont-atlanta'
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    website = EXCLUDED.website;

-- Piedmont Fayette Hospital
INSERT INTO venues (name, slug, address, city, state, zip, lat, lng, spot_type, website)
VALUES (
    'Piedmont Fayette Hospital',
    'piedmont-fayette-hospital',
    '1255 Highway 54 West',
    'Fayetteville',
    'GA',
    '30214',
    33.4497,
    -84.4824,
    'hospital',
    'https://www.piedmont.org/locations/piedmont-fayette'
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    website = EXCLUDED.website;

-- Piedmont Henry Hospital
INSERT INTO venues (name, slug, address, city, state, zip, lat, lng, spot_type, website)
VALUES (
    'Piedmont Henry Hospital',
    'piedmont-henry-hospital',
    '1133 Eagles Landing Parkway',
    'Stockbridge',
    'GA',
    '30281',
    33.5176,
    -84.2234,
    'hospital',
    'https://www.piedmont.org/locations/piedmont-henry-hospital'
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    website = EXCLUDED.website;

-- Piedmont Newnan Hospital
INSERT INTO venues (name, slug, address, city, state, zip, lat, lng, spot_type, website)
VALUES (
    'Piedmont Newnan Hospital',
    'piedmont-newnan-hospital',
    '745 Poplar Road',
    'Newnan',
    'GA',
    '30265',
    33.3907,
    -84.7706,
    'hospital',
    'https://www.piedmont.org/locations/piedmont-newnan'
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    website = EXCLUDED.website;

-- Piedmont Rockdale Hospital
INSERT INTO venues (name, slug, address, city, state, zip, lat, lng, spot_type, website)
VALUES (
    'Piedmont Rockdale Hospital',
    'piedmont-rockdale-hospital',
    '1412 Milstead Avenue NE',
    'Conyers',
    'GA',
    '30012',
    33.6745,
    -84.0035,
    'hospital',
    'https://www.piedmont.org/locations/piedmont-rockdale'
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    website = EXCLUDED.website;

-- Piedmont Newton Hospital
INSERT INTO venues (name, slug, address, city, state, zip, lat, lng, spot_type, website)
VALUES (
    'Piedmont Newton Hospital',
    'piedmont-newton-hospital',
    '5126 Hospital Drive NE',
    'Covington',
    'GA',
    '30014',
    33.6073,
    -83.8365,
    'hospital',
    'https://www.piedmont.org/locations/piedmont-newton'
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    website = EXCLUDED.website;

-- Piedmont Eastside Medical Center
INSERT INTO venues (name, slug, address, city, state, zip, lat, lng, spot_type, website)
VALUES (
    'Piedmont Eastside Medical Center',
    'piedmont-eastside-medical-center',
    '1700 Medical Way',
    'Snellville',
    'GA',
    '30078',
    33.8576,
    -84.0199,
    'hospital',
    'https://www.piedmont.org/locations/piedmont-eastside-medical-center'
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    website = EXCLUDED.website;

-- Piedmont Walton Hospital
INSERT INTO venues (name, slug, address, city, state, zip, lat, lng, spot_type, website)
VALUES (
    'Piedmont Walton Hospital',
    'piedmont-walton-hospital',
    '2151 West Spring Street',
    'Monroe',
    'GA',
    '30655',
    33.7948,
    -83.7282,
    'hospital',
    'https://www.piedmont.org/locations/piedmont-walton'
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    website = EXCLUDED.website;
