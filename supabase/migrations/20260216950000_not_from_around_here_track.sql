-- ============================================
-- MIGRATION: "Not From Around Here" Explore Track
-- ============================================
-- International cuisine and iconic regional US food found in Atlanta.
-- Buford Highway corridor, global kitchens, and the best borrowed recipes.

-- 1. Insert the track
INSERT INTO explore_tracks (slug, name, quote, quote_source, quote_portrait_url, description, sort_order, is_active)
VALUES (
  'not-from-around-here',
  'Not From Around Here',
  'Half the world moved to Atlanta and brought their family recipes. Lucky us.',
  'Atlanta food lovers',
  NULL,
  'Atlanta''s global palate — from Buford Highway''s legendary corridor to Neapolitan pizza, hand-pulled noodles, and cuisines from every corner of the world.',
  19,
  true
)
ON CONFLICT (slug) DO NOTHING;

-- 2. Link venues to the track
-- Uses subqueries to find venue IDs by slug, skipping any that don't exist.

-- Featured venues (is_featured = true)
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'The gateway to Atlanta''s international food scene. Aisles of ingredients from six continents and a food court that rivals any in the world.',
  true,
  1,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'buford-highway-farmers-market'
ON CONFLICT DO NOTHING;

INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'Giovanni Di Palma''s wood-fired Neapolitan pies are the real deal — the kind of pizza that makes you close your eyes on the first bite.',
  true,
  2,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'antico-pizza'
ON CONFLICT DO NOTHING;

INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'James Beard-winning Indian street food in Decatur. Meenu Lukka brought the flavors of Mumbai to downtown Decatur and changed everything.',
  true,
  3,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'chai-pani'
ON CONFLICT DO NOTHING;

-- Regular venues (is_featured = false)
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'Ethiopian comfort food on Marietta Blvd. Order the kitfo and eat with your hands — the way it''s meant to be.',
  false,
  4,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'desta-ethiopian'
ON CONFLICT DO NOTHING;

INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'Doraville''s finest Korean BBQ. The banchan alone is worth the drive.',
  false,
  5,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'woo-nam-jeong'
ON CONFLICT DO NOTHING;

INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'The pho that launched a thousand Buford Highway pilgrimages. Cash only, no frills, pure perfection.',
  false,
  6,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'pho-dai-loi-2'
ON CONFLICT DO NOTHING;

INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'Hand-pulled noodles made to order in a strip mall on Buford Highway. This is the real Xi''an experience.',
  false,
  7,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'xian-gourmet-house'
ON CONFLICT DO NOTHING;

INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'Persian-inspired cooking in Inman Park that turns kebabs and stews into an art form.',
  false,
  8,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'delbar'
ON CONFLICT DO NOTHING;

INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'French-Vietnamese elegance in Buckhead. The shaking beef and summer rolls transport you to Saigon.',
  false,
  9,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'le-colonial'
ON CONFLICT DO NOTHING;

INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'Filipino kamayan feasts — no utensils, just good people gathered around a communal spread.',
  false,
  10,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'kamayan-atl'
ON CONFLICT DO NOTHING;

INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'Persian classics done right in Sandy Springs. The koobideh is legendary.',
  false,
  11,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'rumis-kitchen'
ON CONFLICT DO NOTHING;

INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'Korean-Southern BBQ fusion that shouldn''t work but absolutely does. The brisket with gochujang glaze is otherworldly.',
  false,
  12,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'heirloom-market-bbq'
ON CONFLICT DO NOTHING;

INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'Doraville''s late-night taco king. The al pastor and lengua are as authentic as it gets this side of Mexico City.',
  false,
  13,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'el-rey-del-taco'
ON CONFLICT DO NOTHING;

INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'Inman Park''s modern Mexican kitchen — elevated tacos and mezcal in a space that feels like a celebration.',
  false,
  14,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'communidad-taqueria'
ON CONFLICT DO NOTHING;

INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'Japanese omakase artistry on the Westside. Intimate, seasonal, and worth every penny.',
  false,
  15,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'hayakawa'
ON CONFLICT DO NOTHING;

INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'Lao and Vietnamese cooking in a Duluth strip mall that''s become a pilgrimage destination for food lovers.',
  false,
  16,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'snackboxe-bistro'
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. Create new venues that don't exist yet
-- ============================================

INSERT INTO venues (name, slug, address, city, state, neighborhood, venue_type, short_description)
VALUES
  ('Glide Pizza', 'glide-pizza', '650 North Ave NE, Atlanta, GA 30308', 'Atlanta', 'GA', 'Poncey-Highland', 'restaurant', 'New York-style pizza by the slice and whole pies in Poncey-Highland.'),
  ('Nina & Rafi''s', 'nina-and-rafis', '1099 Hemphill Ave NW, Atlanta, GA 30318', 'Atlanta', 'GA', 'West Midtown', 'restaurant', 'Detroit-style pizza with thick, crispy-edged squares and creative toppings.'),
  ('Shoya Izakaya', 'shoya-izakaya', '6035 Peachtree Rd, Doraville, GA 30360', 'Atlanta', 'GA', 'Doraville', 'restaurant', 'Authentic Japanese izakaya on Buford Highway with yakitori, ramen, and late-night small plates.'),
  ('Abuela''s Colombian Restaurant', 'abuelas-colombian', '5151 Buford Hwy NE, Doraville, GA 30340', 'Atlanta', 'GA', 'Doraville', 'restaurant', 'Home-style Colombian cooking on Buford Highway — bandeja paisa, arepas, and empanadas.'),
  ('Lee''s Bakery', 'lees-bakery', '4005 Buford Hwy NE, Atlanta, GA 30345', 'Atlanta', 'GA', 'Chamblee', 'restaurant', 'Buford Highway institution for Vietnamese banh mi, pho, and pastries since the 1980s.'),
  ('Bon Ton', 'bon-ton', '674 Myrtle St NE, Atlanta, GA 30308', 'Atlanta', 'GA', 'Midtown', 'restaurant', 'Cajun-Vietnamese seafood restaurant and cocktail bar with boils, po-boys, and New Orleans tiki drinks.'),
  ('Negril Village ATL', 'negril-village-atl', '999 Chattahoochee Ave, Atlanta, GA 30318', 'Atlanta', 'GA', 'Westside', 'restaurant', 'Upscale Jamaican restaurant with oxtails, curry goat, ackee and saltfish, and a legendary Sunday brunch.'),
  ('Kyma', 'kyma', '3085 Piedmont Rd NE, Atlanta, GA 30305', 'Atlanta', 'GA', 'Buckhead', 'restaurant', 'Contemporary Greek seafood tavern in Buckhead with inventive Mediterranean dishes.'),
  ('Cafe Songhai', 'cafe-songhai', '3380 Holcomb Bridge Rd, Peachtree Corners, GA 30092', 'Atlanta', 'GA', 'Peachtree Corners', 'restaurant', 'Ghanaian and Nigerian restaurant serving egusi soup, jollof rice, kelewele, and Ivory Coast classics.'),
  ('La Semilla', 'la-semilla', '780 Memorial Dr SE, Atlanta, GA 30316', 'Atlanta', 'GA', 'Reynoldstown', 'restaurant', 'Plant-based modern Latin kitchen with Cuban and Caribbean-inspired plates, rum cocktails, and natural wines.'),
  ('JenChan''s', 'jenchans', '186 Carroll St SE, Atlanta, GA 30312', 'Atlanta', 'GA', 'Cabbagetown', 'restaurant', 'LGBTQ+-owned Chinese-American fusion in Cabbagetown — Chinese burritos, dim sum brunch, and mahjong nights.')
ON CONFLICT (slug) DO NOTHING;

-- 4. Link new venues to the track
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'The real New York slice, transplanted to Poncey-Highland. Thin crust, proper fold, late-night perfection.',
  false,
  17,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'glide-pizza'
ON CONFLICT DO NOTHING;

INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'Detroit-style pizza done right on the Westside. Thick, pillowy dough with those caramelized cheese edges.',
  false,
  18,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'nina-and-rafis'
ON CONFLICT DO NOTHING;

INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'A true izakaya experience on Buford Highway — yakitori smoke, cold beer, and the kind of late-night energy you''d find in a Tokyo side street.',
  false,
  19,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'shoya-izakaya'
ON CONFLICT DO NOTHING;

INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'Bandeja paisa the size of your head and arepas that taste like somebody''s actual abuela made them. Because she did.',
  false,
  20,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'abuelas-colombian'
ON CONFLICT DO NOTHING;

INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'The Buford Highway OG. Lee''s has been slinging banh mi and pho since the ''80s — the line out the door is earned.',
  false,
  21,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'lees-bakery'
ON CONFLICT DO NOTHING;

INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'Cajun boils and Vietnamese banh mi under one roof — because New Orleans and Saigon have more in common than you''d think.',
  false,
  22,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'bon-ton'
ON CONFLICT DO NOTHING;

INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'Oxtails, curry goat, and ackee and saltfish in a converted firehouse. The Sunday brunch with live reggae is an ATL institution.',
  false,
  23,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'negril-village-atl'
ON CONFLICT DO NOTHING;

INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'Buckhead''s Greek seafood destination. Whole grilled fish, octopus, and a Mediterranean wine list worth exploring.',
  false,
  24,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'kyma'
ON CONFLICT DO NOTHING;

INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'Egusi soup, jollof rice, and kelewele from Ghana, Nigeria, and the Ivory Coast. West Africa has arrived in Atlanta.',
  false,
  25,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'cafe-songhai'
ON CONFLICT DO NOTHING;

INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'Plant-based Latin cooking that''ll make you forget the meat. Cuban and Caribbean flavors, rum cocktails, and a Reynoldstown vibe.',
  false,
  26,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'la-semilla'
ON CONFLICT DO NOTHING;

INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'Chinese burritos, Mongolian beef cheesesteaks, and dim sum brunch in Cabbagetown. Jen and Emily''s fusion kitchen defies every category.',
  false,
  27,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'jenchans'
ON CONFLICT DO NOTHING;

-- 5. Link existing DB venues that weren't on the track yet
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'Decatur''s Thai stalwart. The curries and pad see ew have kept regulars coming back for decades.',
  false,
  28,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'surin-of-thailand-decatur'
ON CONFLICT DO NOTHING;

INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, is_featured, sort_order, status)
SELECT
  t.id,
  v.id,
  'Indonesian home cooking in a Chamblee strip mall — nasi goreng, rendang, and flavors most Atlantans have never tried.',
  false,
  29,
  'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'not-from-around-here' AND v.slug = 'java-saga'
ON CONFLICT DO NOTHING;
