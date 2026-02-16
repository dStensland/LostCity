-- Venue highlights: Tier 1 + Tier 2 venues
-- Curated insider details, specific facts, no generic tourism copy
-- Uses slug lookup with NOT EXISTS guards for idempotent inserts

-- ============================================================
-- TIER 1: ICONIC & UNIQUE TO ATLANTA
-- ============================================================

-- 9 Mile Station (PCM rooftop)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'viewpoint', 'PCM Rooftop Skyline Panorama',
  'Fourth-floor open-air bar atop the old Sears warehouse. Unobstructed 270-degree views from Stone Mountain east to the Downtown skyline west. One of the few rooftops open year-round.',
  0
FROM venues v WHERE v.slug = '9-mile-station'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'PCM Rooftop Skyline Panorama');

-- Alliance Theatre
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Tony Award and Broadway Pipeline',
  'Won the 2007 Regional Theatre Tony — the only Southeast theater to hold the honor. Premiered "The Color Purple" (2004) and "Tuck Everlasting" before their Broadway runs.',
  0
FROM venues v WHERE v.slug = 'alliance-theatre'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Tony Award and Broadway Pipeline');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', '2018 Renovation''s Hidden Stage',
  'The 2018 renovation added a second, flexible black-box stage beneath the main theater. Audiences enter through a separate lobby — many regulars don''t know the lower theater exists.',
  1
FROM venues v WHERE v.slug = 'alliance-theatre'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = '2018 Renovation''s Hidden Stage');

-- Atlanta Symphony Hall
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', '4,542-Pipe Moller Concert Organ',
  'One of the largest concert organs in the Southeast. The 4,542-pipe Moller instrument was installed in 1972 and fills the 1,762-seat hall — you feel it in your chest more than hear it.',
  0
FROM venues v WHERE v.slug = 'atlanta-symphony-hall'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = '4,542-Pipe Moller Concert Organ');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Adjustable Acoustic Wall Panels',
  'The 2000 renovation added motorized acoustic panels and a custom canopy that can be tuned for symphony, choral, or amplified performances. The hall literally reshapes itself between shows.',
  1
FROM venues v WHERE v.slug = 'atlanta-symphony-hall'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Adjustable Acoustic Wall Panels');

-- CDC Museum
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'World''s Only Public Health Museum',
  'The David J. Sencer CDC Museum is the only museum on earth dedicated to public health. Houses artifacts from the 1918 flu pandemic, original smallpox eradication field kits, and the lab equipment used to identify the first HIV cases in 1984.',
  0
FROM venues v WHERE v.slug = 'cdc-museum'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'World''s Only Public Health Museum');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'The Iron Lung Display',
  'A fully intact 1950s iron lung sits in the polio exhibit — one of the machines that kept patients alive before the Salk vaccine. Visitors can peer inside the chamber. Free admission.',
  1
FROM venues v WHERE v.slug = 'cdc-museum'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'The Iron Lung Display');

-- Delta Flight Museum
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Walk Through a Boeing 747-400',
  'Ship 6301, Delta''s first 747, sits fully accessible inside Hangar 1. Climb into the cockpit, walk the upper deck, and sit in first class. The aircraft logged over 100 million miles before retirement.',
  0
FROM venues v WHERE v.slug = 'delta-flight-museum'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Walk Through a Boeing 747-400');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Original 1940s Maintenance Hangar',
  'The museum occupies Delta''s historic Hangar 2, built in 1940 when the airline moved its headquarters to Atlanta. Original steel truss system still holds the roof up. The flight simulator next door uses real 737 cockpit hardware.',
  1
FROM venues v WHERE v.slug = 'delta-flight-museum'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Original 1940s Maintenance Hangar');

-- Blind Willie's
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Live Blues Every Night Since 1986',
  'Named after Georgia-born blues legend Blind Willie McTell. Seven nights a week of live blues in a 100-capacity room with original exposed brick. The Sunday blues jam is the longest-running in the Southeast.',
  0
FROM venues v WHERE v.slug = 'blind-willies'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Live Blues Every Night Since 1986');

-- Also target the alternate slug
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Live Blues Every Night Since 1986',
  'Named after Georgia-born blues legend Blind Willie McTell. Seven nights a week of live blues in a 100-capacity room with original exposed brick. The Sunday blues jam is the longest-running in the Southeast.',
  0
FROM venues v WHERE v.slug = 'blind-willies-blues-club'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Live Blues Every Night Since 1986');

-- Atlanta Eagle
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Civil Rights Landmark Since 1987',
  'Atlanta''s oldest leather and Levi''s bar. The infamous 2009 police raid — 62 patrons illegally detained, officers fired, federal lawsuits won — became a turning point for LGBTQ rights in Georgia and reformed APD''s policies.',
  0
FROM venues v WHERE v.slug = 'atlanta-eagle'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Civil Rights Landmark Since 1987');

-- Brick Store Pub
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Secret Belgian Bar Upstairs',
  'Through an unmarked door on the second floor: an intimate wood-paneled room with 120+ Belgian and rare European beers. First-come seating only, no reservations. Locals have kept it semi-secret since 1997.',
  0
FROM venues v WHERE v.slug = 'brick-store-pub'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Secret Belgian Bar Upstairs');

-- 529
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'EAV''s Punk Ground Zero',
  'Operating since 1999 in a converted house on Flat Shoals. This 150-capacity room launched Mastodon, Black Lips, and Deerhunter. 200+ shows a year — Atlanta''s most prolific indie venue per square foot.',
  0
FROM venues v WHERE v.slug = '529'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'EAV''s Punk Ground Zero');

-- Buckhead Theatre
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Restored 1931 Art Deco Cinema',
  'Originally the Buckhead Grand movie palace. The 2010 renovation preserved the Depression-era marquee, terrazzo floors, Moorish ceiling, and decorative plasterwork while converting the 1,150-seat space into a concert hall.',
  0
FROM venues v WHERE v.slug = 'buckhead-theatre'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Restored 1931 Art Deco Cinema');

-- Atlanta Monetary Museum
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Free Museum Inside the Federal Reserve',
  'Walk through a vault replica, see $1 million in real currency, and watch worn bills get shredded live. They give you a bag of shredded money to take home. Most Atlantans don''t know this exists.',
  0
FROM venues v WHERE v.slug = 'atlanta-monetary-museum'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Free Museum Inside the Federal Reserve');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Counterfeit Detection Lab',
  'Exhibits include historical currency from the 1800s and a hands-on counterfeit detection station where you learn to spot fakes using the same techniques Secret Service agents use. Security screening required to enter — you''re inside the Fed.',
  1
FROM venues v WHERE v.slug = 'atlanta-monetary-museum'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Counterfeit Detection Lab');

-- ============================================================
-- TIER 2: STRONG CANDIDATES
-- ============================================================

-- Argosy
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Converted 1950s Service Station',
  'This EAV gastropub occupies a restored mid-century filling station. The original garage door openings now frame the patio, and the industrial steel canopy that once sheltered gas pumps covers outdoor seating.',
  0
FROM venues v WHERE v.slug = 'argosy'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Converted 1950s Service Station');

-- Center Stage
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Where Nirvana Played in 1991',
  'This 1,050-capacity Midtown hall hosted Nirvana, R.E.M., and Smashing Pumpkins during their breakthrough years. The exposed-brick interior and wraparound balcony create sightlines where nobody is more than 80 feet from the stage.',
  0
FROM venues v WHERE v.slug = 'center-stage-atlanta'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Where Nirvana Played in 1991');

-- City Winery Atlanta
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Working Winery Inside PCM',
  'An actual winery producing wine on-site inside the old Sears building. Visible fermentation tanks and a barrel room behind the 300-seat music hall. Full dinner service during shows — table seating, not standing.',
  0
FROM venues v WHERE v.slug = 'city-winery-atlanta'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Working Winery Inside PCM');

-- Basement Atlanta
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Literally Beneath the Stadium',
  'Built into the foundation of Mercedes-Benz Stadium. The 8,000-capacity space uses the stadium''s exposed concrete infrastructure as its walls. On game days the bass from above and below merge into something physical.',
  0
FROM venues v WHERE v.slug = 'basement-atlanta'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Literally Beneath the Stadium');

-- Believe Music Hall
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Converted 1940s Industrial Warehouse',
  'A former industrial warehouse with 30-foot ceilings, exposed steel trusses, and raw concrete floors transformed into Atlanta''s premier electronic music venue. The 3,200-capacity room''s volume is the point — the sound system fills every cubic foot.',
  0
FROM venues v WHERE v.slug = 'believe-music-hall'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Converted 1940s Industrial Warehouse');

-- Blue Heron Nature Preserve
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'nature', 'Hidden 30-Acre Forest in Buckhead',
  'Wedged between two residential neighborhoods, this preserve protects rare piedmont wetlands and three miles of trails. Great blue herons nest here annually. Saved from developers by neighbors in 1992 — one of the last intact urban forests inside I-285.',
  0
FROM venues v WHERE v.slug = 'blue-heron-nature-preserve'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Hidden 30-Acre Forest in Buckhead');

-- Chattahoochee Nature Center
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'nature', '1,400-Foot Wetland Boardwalk',
  '127 acres with a boardwalk floating over freshwater wetlands, a raptor rehabilitation aviary, and river otter exhibits. One of the few metro spots with canoe access directly from a nature preserve into the Chattahoochee.',
  0
FROM venues v WHERE v.slug = 'chattahoochee-nature-center'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = '1,400-Foot Wetland Boardwalk');

-- Aisle 5
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Shotgun Listening Room',
  'A narrow converted storefront with original hardwood floors and pressed tin ceiling. The shotgun layout means even at 250 capacity, nobody is more than 40 feet from the stage. Singer-songwriters request this room specifically.',
  0
FROM venues v WHERE v.slug = 'aisle-5'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Shotgun Listening Room');

-- Cobb Energy Centre
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Atlanta Opera''s $145M Home',
  'The first major performing arts facility built in metro Atlanta in four decades when it opened in 2007. The 2,750-seat hall was designed specifically for opera acoustics with European-style box seats — a rarity in multi-use Southern venues.',
  0
FROM venues v WHERE v.slug = 'cobb-energy-performing-arts-centre'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Atlanta Opera''s $145M Home');
