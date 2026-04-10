-- Add place records for notable Atlanta venues missing from the database.
-- These are discoverable destinations even without active event crawlers.

-- Star Bar — Edgewood Ave punk/alt institution
INSERT INTO places (name, slug, address, neighborhood, city, state, zip, lat, lng, place_type, website)
SELECT 'Star Bar', 'star-bar', '437 Moreland Ave NE', 'Little Five Points', 'Atlanta', 'GA', '30307',
       33.7614, -84.3485, 'bar', 'https://www.starbaratl.com'
WHERE NOT EXISTS (SELECT 1 FROM places WHERE slug = 'star-bar');

-- Tongue & Groove — Buckhead live music/dance club
INSERT INTO places (name, slug, address, neighborhood, city, state, zip, lat, lng, place_type, website)
SELECT 'Tongue & Groove', 'tongue-and-groove', '3055 Peachtree Rd NE', 'Buckhead', 'Atlanta', 'GA', '30305',
       33.8407, -84.3627, 'nightclub', 'https://www.tongueandgrooveatl.com'
WHERE NOT EXISTS (SELECT 1 FROM places WHERE slug = 'tongue-and-groove');

-- AMC North Point Mall 12 — major Alpharetta multiplex
INSERT INTO places (name, slug, address, neighborhood, city, state, zip, lat, lng, place_type, website)
SELECT 'AMC North Point Mall 12', 'amc-north-point', '1000 North Point Cir', 'North Point', 'Alpharetta', 'GA', '30022',
       34.0557, -84.2755, 'cinema', 'https://www.amctheatres.com/movie-theatres/atlanta/amc-north-point-mall-12'
WHERE NOT EXISTS (SELECT 1 FROM places WHERE slug = 'amc-north-point');

-- Crimson Moon Cafe — Dahlonega folk/acoustic room
INSERT INTO places (name, slug, address, neighborhood, city, state, zip, lat, lng, place_type, website)
SELECT 'Crimson Moon Cafe', 'crimson-moon-cafe', '24 N Park St', 'Downtown Dahlonega', 'Dahlonega', 'GA', '30533',
       34.5329, -83.9851, 'music_venue', 'https://www.thecrimsonmoon.com'
WHERE NOT EXISTS (SELECT 1 FROM places WHERE slug = 'crimson-moon-cafe');

-- Push Push Theater — Decatur experimental theater
INSERT INTO places (name, slug, address, neighborhood, city, state, zip, lat, lng, place_type, website)
SELECT 'PushPush Theater', 'pushpush-theater', '4036 Flowers Rd', 'Doraville', 'Atlanta', 'GA', '30360',
       33.9039, -84.2804, 'theater', 'https://www.pushpushtheater.com'
WHERE NOT EXISTS (SELECT 1 FROM places WHERE slug = 'pushpush-theater');
