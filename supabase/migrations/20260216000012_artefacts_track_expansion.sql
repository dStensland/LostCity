-- ============================================================================
-- Artefacts of the Lost City — Track Expansion to 79 venues
-- Adds suburban Atlanta artifacts + strong ITP additions
-- ============================================================================

-- Safety: ensure parent_venue_id exists (may have been missed in migration 10)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS parent_venue_id bigint REFERENCES venues(id);
CREATE INDEX IF NOT EXISTS idx_venues_parent ON venues(parent_venue_id);

-- ============================================================================
-- 1. NEW ARTIFACT VENUES (children of parent venues)
-- ============================================================================

-- Monster Mansion Monsters -> Six Flags Over Georgia
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT 'Monster Mansion Monsters', 'monster-mansion-monsters', 'artifact', 'Austell', 'GA', 'Austell',
  33.7677, -84.5514,
  '107 hand-built animatronic monsters inside a fake Southern plantation mansion at Six Flags Over Georgia. Created in 1981 by Disney legend Al "Big Al" Bertino — the same man who designed Country Bear Jamboree and helped build the Haunted Mansion. The star: Mizzy Scarlett, the monster hostess named after Scarlett O''Hara. The villain: the Boateater, a brute who threatens to eat your ride vehicle — designer Phil Mendez joked he modeled it on his mother-in-law. Originally "Tales of the Okefenokee" (1967), redesigned by Sid and Marty Krofft (1968), then reimagined by Bertino with 107 animatronics across 9 scenes on a 700-foot flume. The monsters were inspired by Bertino''s granddaughter pretending to be a monster.',
  '107 animatronics by a Disney legend. The star is Mizzy Scarlett, named after Scarlett O''Hara.',
  true, 'hidden_gems',
  (SELECT id FROM venues WHERE name ILIKE '%Six Flags Over Georgia%' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'monster-mansion-monsters');

-- Riverview Carousel -> Six Flags Over Georgia
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT 'Riverview Carousel', 'riverview-carousel', 'artifact', 'Austell', 'GA', 'Austell',
  33.7680, -84.5510,
  'One of only three five-abreast carousels left in the world — and on the National Register of Historic Places. Built in 1908 by Philadelphia Toboggan Coasters. Al Capone, President Harding, and William Randolph Hearst all rode it at Chicago''s Riverview Park before it closed in 1967. Six Flags rescued it, spent 26,000 man-hours restoring it, and installed it on a Georgia hilltop in 1972. 70 hand-carved wooden horses. 40 tons. 118 years old.',
  'On the National Register. Built 1908. Al Capone rode it in Chicago. 70 hand-carved horses.',
  true, 'landmarks_attractions',
  (SELECT id FROM venues WHERE name ILIKE '%Six Flags Over Georgia%' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'riverview-carousel');

-- Stone Mountain Confederate Carving -> Stone Mountain Park
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT 'Stone Mountain Confederate Carving', 'stone-mountain-carving', 'artifact', 'Stone Mountain', 'GA', 'Stone Mountain',
  33.8120, -84.1452,
  'The largest bas-relief sculpture in the world — three Confederate figures on horseback (Davis, Lee, Jackson) carved into the north face of Stone Mountain. The carving measures 3 acres: 90 feet tall, 190 feet wide. Started by Gutzon Borglum (who later carved Mount Rushmore) in 1916, abandoned, restarted, and not completed until 1972 — a 57-year saga. The mountain itself is an 825-foot granite monadnock, the largest exposed mass of granite in the world.',
  'World''s largest bas-relief. 3 acres of granite carving. Took 57 years to finish.',
  true, 'landmarks_attractions',
  (SELECT id FROM venues WHERE slug = 'stone-mountain-park' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'stone-mountain-carving');

-- Lion of Atlanta -> Oakland Cemetery
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT 'The Lion of Atlanta', 'lion-of-atlanta', 'artifact', 'Atlanta', 'GA', 'Grant Park',
  33.7485, -84.3712,
  'A dying marble lion draped over a Confederate flag, guarding the mass grave of approximately 3,000 unknown Confederate soldiers at Oakland Cemetery. Carved from a single block of Georgia marble in 1894 by T.M. Brady, it was inspired by the Lion of Lucerne in Switzerland. The lion''s eyes are closed, its paw rests on a cannon barrel, and a broken sword lies beneath it. One of the most photographed monuments in the South.',
  'Marble lion guarding 3,000 unknown soldiers. Carved from a single block of Georgia marble.',
  true, 'landmarks_attractions',
  (SELECT id FROM venues WHERE slug = 'oakland-cemetery' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'lion-of-atlanta');

-- Margaret Mitchell's Grave -> Oakland Cemetery
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT 'Margaret Mitchell''s Grave', 'margaret-mitchells-grave', 'artifact', 'Atlanta', 'GA', 'Grant Park',
  33.7489, -84.3708,
  'The most visited grave in Atlanta. Margaret Munnerlyn Mitchell, who wrote Gone with the Wind, is buried under a modest headstone at Oakland Cemetery beside her husband John Marsh. She was struck by a car on Peachtree Street at age 48 in 1949. Fans leave pens, flowers, and miniature books on the grave. She is buried as "Margaret Mitchell Marsh" — she never legally changed her name.',
  'Atlanta''s most visited grave. Fans still leave pens and miniature books.',
  true, 'hidden_gems',
  (SELECT id FROM venues WHERE slug = 'oakland-cemetery' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'margaret-mitchells-grave');

-- ============================================================================
-- 2. NEW STANDALONE VENUES (suburban & ITP)
-- ============================================================================

-- The General Locomotive — Kennesaw
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'The General Locomotive', 'the-general-locomotive', 'artifact', 'Kennesaw', 'GA', 'Kennesaw',
  34.0234, -84.6155,
  'The actual Civil War locomotive stolen by Union spy James Andrews and his raiders on April 12, 1862, in the Great Locomotive Chase — one of the most dramatic episodes of the war. Confederate conductor William Fuller chased the stolen train for 87 miles on foot, by handcar, and finally by locomotive. The General now sits inside the Southern Museum of Civil War and Locomotive History. Disney made a movie about it. Buster Keaton made a better one.',
  'The actual Civil War locomotive from the Great Locomotive Chase. Stolen in 1862.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'the-general-locomotive');

-- Waffle House Museum — Avondale Estates
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Waffle House Museum', 'waffle-house-museum', 'artifact', 'Avondale Estates', 'GA', 'Avondale Estates',
  33.7711, -84.2676,
  'The original Waffle House, opened September 5, 1955, by Joe Rogers Sr. and Tom Forkner. Now a museum preserving the original counter, stools, jukebox, and grill exactly as they were. The menu on the wall still shows 10-cent coffee. Waffle House went on to open 2,000+ locations across 25 states. FEMA uses the "Waffle House Index" — if Waffle House closes, the disaster is catastrophic. This is where it all started.',
  'Original Waffle House #1. The counter, stools, and 10-cent coffee menu preserved.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'waffle-house-museum');

-- Roswell Mill Ruins — Roswell
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Roswell Mill Ruins', 'roswell-mill-ruins', 'artifact', 'Roswell', 'GA', 'Roswell',
  34.0215, -84.3614,
  'Stone ruins of the Roswell Manufacturing Company cotton mill, burned by Sherman''s troops on July 7, 1864. The real story is darker: Sherman declared the 400+ women and children working in the mill to be traitors and ordered them deported to Indiana. Most never returned. The mill dam on Vickery Creek and the stone walls remain, accessible via a hiking trail through the woods. One of the best-preserved Civil War industrial ruins in Georgia.',
  'Sherman burned the mill and deported the women to Indiana. The stone ruins remain.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'roswell-mill-ruins');

-- Southeastern Railway Museum — Duluth
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Southeastern Railway Museum', 'southeastern-railway-museum', 'artifact', 'Duluth', 'GA', 'Duluth',
  34.0021, -84.1379,
  'Georgia''s official transportation history museum, housing 90+ pieces of rolling stock — steam locomotives, Pullman sleeper cars, cabooses, and a private railcar used by President Warren G. Harding. You can climb inside many of the cars. The museum sits on a 35-acre site with operating track for train rides. The crown jewel: a beautifully restored 1911 Pullman private car with mahogany paneling and stained glass.',
  '90+ vintage trains and railcars. You can climb inside a 1911 Pullman with stained glass.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'southeastern-railway-museum');

-- Kennesaw Mountain Battlefield Cannons — Kennesaw
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Kennesaw Mountain Battlefield Cannons', 'kennesaw-mountain-cannons', 'artifact', 'Kennesaw', 'GA', 'Kennesaw',
  33.9830, -84.5784,
  'Actual Civil War artillery pieces positioned at the summit of Kennesaw Mountain, where 67,000 Confederate troops held off Sherman''s army of 100,000 on June 27, 1864. The mountain itself is the site of one of the bloodiest battles of the Atlanta Campaign. The cannons sit at the peak with a panoramic view of the entire metro area — on clear days you can see downtown Atlanta 20 miles south. The mountain trail is the most-hiked in Georgia.',
  'Civil War cannons at the summit. View of the entire Atlanta skyline 20 miles away.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'kennesaw-mountain-cannons');

-- Concord Covered Bridge — Smyrna
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Concord Covered Bridge', 'concord-covered-bridge', 'artifact', 'Smyrna', 'GA', 'Smyrna',
  33.8510, -84.5210,
  'The only surviving covered bridge in metro Atlanta, built in 1872 over Nickajack Creek. The Concord Woolen Mill operated beside it until Sherman''s troops burned the original bridge and mill in 1864. The replacement bridge was built using the traditional Town lattice truss design with wooden pegs instead of nails. Closed to vehicle traffic since the 1950s, it now sits in a quiet park with the stone mill ruins visible along the creek.',
  'Metro Atlanta''s only surviving covered bridge. Built 1872 with wooden pegs, not nails.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'concord-covered-bridge');

-- Bulloch Hall — Roswell
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Bulloch Hall', 'bulloch-hall', 'artifact', 'Roswell', 'GA', 'Roswell',
  34.0232, -84.3546,
  'The childhood home of Mittie Bulloch — mother of Theodore Roosevelt. Built in 1839 in Greek Revival style, it hosted Mittie''s wedding to Theodore Roosevelt Sr. in 1853. President Teddy Roosevelt visited in 1905 to see where his mother grew up. The house is remarkably intact, with original plaster, mantels, and floorboards. The grounds include reconstructed slave quarters and a teaching kitchen.',
  'Teddy Roosevelt''s mother''s childhood home. He visited in 1905.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'bulloch-hall');

-- Agnes Scott Bradley Observatory — Decatur
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Agnes Scott Bradley Observatory', 'bradley-observatory', 'artifact', 'Decatur', 'GA', 'Decatur',
  33.7680, -84.2936,
  'A 1930s observatory on the Agnes Scott College campus housing a 30-inch Beck telescope — one of the largest in the Southeast available for public viewing. The copper-domed building is a Decatur landmark. Open to the public on clear Friday evenings during the academic year. Students and astronomers point the telescope at Saturn''s rings, Jupiter''s moons, and deep-sky objects. Free.',
  'A 1930s observatory with one of the Southeast''s largest public telescopes. Free Friday nights.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'bradley-observatory');

-- Covington Clock Tower (Mystic Falls) — Covington
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Covington Clock Tower', 'covington-clock-tower', 'artifact', 'Covington', 'GA', 'Covington',
  33.5968, -83.8602,
  'The clock tower on the Covington town square that served as the heart of "Mystic Falls" in The Vampire Diaries for 8 seasons (2009-2017). Fans still visit from around the world to recreate scenes. The town leans into it — there are self-guided walking tours past filming locations, and the annual Mystic Falls Tour draws thousands. The square itself is a nearly perfect small-town Southern courthouse square, also seen in In the Heat of the Night, The Dukes of Hazzard, and 40+ other productions.',
  'The "Mystic Falls" clock tower from Vampire Diaries. Fans still visit from around the world.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'covington-clock-tower');

-- Chick-fil-A Dwarf House — Hapeville
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Chick-fil-A Dwarf House', 'chick-fil-a-dwarf-house', 'artifact', 'Hapeville', 'GA', 'Hapeville',
  33.6593, -84.4108,
  'The original Chick-fil-A — before it was Chick-fil-A. Truett Cathy opened the Dwarf Grill in 1946 (renamed Dwarf House in 1961), and it was here that he invented the original chicken sandwich in the early 1960s. The tiny front door (built for the "dwarf" theme) is still there. The restaurant still operates with a unique menu not found at regular locations. The rest of the 2,800+ Chick-fil-A empire started from this spot.',
  'Where Truett Cathy invented the chicken sandwich. The tiny front door is still there.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'chick-fil-a-dwarf-house');

-- Avondale Estates Tudor Village — Avondale Estates
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Avondale Estates Tudor Village', 'avondale-tudor-village', 'artifact', 'Avondale Estates', 'GA', 'Avondale Estates',
  33.7722, -84.2672,
  'An entire commercial district built in 1920s Tudor Revival style — half-timbered facades, leaded glass windows, and slate roofs that look like they were airlifted from a Cotswolds village. George Francis Willis designed the planned community in 1924, modeling it after Stratford-upon-Avon. The downtown strip along North Avondale Road retains the original English village character nearly 100 years later. Willis also built a public swimming lake at the center of town.',
  'A 1920s commercial district designed to look like an English Tudor village. Still intact.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'avondale-tudor-village');

-- Marietta National Cemetery — Marietta
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Marietta National Cemetery', 'marietta-national-cemetery', 'artifact', 'Marietta', 'GA', 'Marietta',
  33.9520, -84.5436,
  'One of the original national cemeteries, established in 1866 to bury the Union dead from the Atlanta Campaign. Over 10,000 graves — most are unknown soldiers marked only with numbers. Henry Cole, a Marietta citizen, donated the land and personally oversaw the burial of Union soldiers at a time when neighbors called him a traitor. The Confederate dead are buried across town at the Marietta Confederate Cemetery, creating a split that persists to this day.',
  '10,000+ Union soldier graves from the Atlanta Campaign. The man who donated the land was called a traitor.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'marietta-national-cemetery');

-- Indian Seats at Sawnee Mountain — Cumming
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Indian Seats at Sawnee Mountain', 'indian-seats-sawnee-mountain', 'artifact', 'Cumming', 'GA', 'Forsyth County',
  34.2186, -84.1480,
  'Natural rock formations at the summit of Sawnee Mountain that form chair-like seats — used by Cherokee people as lookout points over the Etowah River valley. The "seats" face north, offering panoramic views of the Blue Ridge foothills. Cherokee and Creek peoples used this vantage point for centuries before European settlement. A 2-mile trail leads to the top. The mountain is named for a Cherokee village at its base.',
  'Natural rock chairs used by Cherokee as lookout points. 2-mile hike to panoramic views.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'indian-seats-sawnee-mountain');

-- Bellwood Quarry / Westside Park Reservoir — Atlanta
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Bellwood Quarry Reservoir', 'bellwood-quarry-reservoir', 'artifact', 'Atlanta', 'GA', 'Westside',
  33.7882, -84.4268,
  'A flooded granite quarry that is now Atlanta''s 2.4-billion-gallon emergency drinking water reserve — enough to supply the city for 30-90 days if the Chattahoochee fails. The quarry operated for over 100 years, quarrying the granite that rebuilt Atlanta after Sherman. Much of that labor was done by convicts in horrific conditions. The quarry closed in the early 2000s, flooded naturally, and was converted into Westside Park in 2021. The overlook reveals an impossibly deep turquoise lake surrounded by 200-foot granite walls.',
  '2.4 billion gallons of emergency water in a flooded granite quarry. 200-foot walls.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'bellwood-quarry-reservoir');

-- Asa Candler Mausoleum — Westview Cemetery
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Asa Candler Mausoleum', 'asa-candler-mausoleum', 'artifact', 'Atlanta', 'GA', 'Westview',
  33.7257, -84.4311,
  'The Coca-Cola founder built himself an Egyptian Revival mausoleum at Westview Cemetery — complete with Pharaonic columns, a bronze door with hieroglyphic-style panels, and a sphinx-like guardian. Asa Griggs Candler bought the Coca-Cola formula from Pemberton for $2,300 in 1888 and built it into the world''s most recognized brand. His tomb is the grandest structure in a cemetery that also holds Joel Chandler Harris (before his reinterment) and Bobby Jones.',
  'The Coca-Cola founder''s Egyptian tomb. Pharaonic columns, bronze hieroglyphic door, sphinx.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'asa-candler-mausoleum');

-- Monastery of the Holy Spirit Bonsai Garden — Conyers
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Monastery Bonsai Garden', 'monastery-bonsai-garden', 'artifact', 'Conyers', 'GA', 'Conyers',
  33.5567, -84.0017,
  'A collection of over 400 bonsai trees tended by Trappist monks at the Monastery of the Holy Spirit in Conyers. The monks have cultivated bonsai since the 1970s as a form of prayer and meditation. Some trees are over 100 years old. The monastery itself was founded in 1944 on 2,300 acres of Georgia forest. The monks also produce fudge, fruitcakes, and stained glass. Open to the public. Silence is observed.',
  '400+ bonsai trees tended by Trappist monks. Some trees are over 100 years old. Silence observed.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'monastery-bonsai-garden');

-- Peachtree City Golf Cart Tunnels — Peachtree City
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Peachtree City Golf Cart Tunnels', 'peachtree-city-golf-cart-tunnels', 'artifact', 'Peachtree City', 'GA', 'Peachtree City',
  33.3968, -84.5960,
  'Over 100 miles of multi-use paths with actual tunnels under roads, designed so 10,000+ golf carts can traverse the city without ever crossing a car. Peachtree City residents drive golf carts to school, the grocery store, restaurants, and church. The path system includes bridges, tunnels, and dedicated cart parking at every business. It''s not a gimmick — it''s the primary transportation system for 40,000 people. The most golf carts per capita of any city in America.',
  '100+ miles of golf cart paths with tunnels under roads. 10,000+ carts. Not a gimmick.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'peachtree-city-golf-cart-tunnels');

-- Stately Oaks Plantation — Jonesboro
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Stately Oaks Plantation', 'stately-oaks-plantation', 'artifact', 'Jonesboro', 'GA', 'Jonesboro',
  33.5198, -84.3519,
  'An authentic 1839 antebellum plantation home in Clayton County — the county where Margaret Mitchell placed Tara in Gone with the Wind. While Tara was fictional, Mitchell modeled it after plantations in this area where her maternal grandmother was born. Listed on the National Register of Historic Places, the grounds include a one-room schoolhouse, tenant cabin, cook''s house, blacksmith shop, and country store. Visitors often mistake it for the "real" Tara.',
  'The plantation that inspired Tara from Gone with the Wind. Often mistaken for the "real" one.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'stately-oaks-plantation');

-- ============================================================================
-- 3. HIGHLIGHTS on key new artifacts
-- ============================================================================

-- Monster Mansion
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Disney Legend Created This',
  'Al "Big Al" Bertino worked on Pinocchio, Fantasia, Haunted Mansion, and Country Bear Jamboree at Disney before creating Monster Plantation. Big Al from Country Bear Jamboree is literally a self-portrait.',
  0
FROM venues v WHERE v.slug = 'monster-mansion-monsters'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Disney Legend Created This');

-- Riverview Carousel
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Rescued From Chicago',
  'Riverview Park in Chicago operated from 1904 to 1967. Al Capone, President Harding, and Hearst all rode this carousel. Six Flags spent 26,000 man-hours restoring the 70 hand-carved horses. Added to the National Register of Historic Places in 1995.',
  0
FROM venues v WHERE v.slug = 'riverview-carousel'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Rescued From Chicago');

-- The General
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', '87-Mile Chase',
  'Conductor William Fuller chased the stolen General for 87 miles — first on foot, then by handcar, then by locomotive. Eight of Andrews'' Raiders were hanged as spies. The first Medals of Honor ever awarded went to surviving raiders.',
  0
FROM venues v WHERE v.slug = 'the-general-locomotive'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = '87-Mile Chase');

-- Waffle House Museum
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The FEMA Waffle House Index',
  'FEMA uses the "Waffle House Index" to gauge disaster severity: Green means the restaurant is open with a full menu. Yellow means limited menu. Red — Waffle House is closed — means the area is devastated. If Waffle House gives up, it''s bad.',
  0
FROM venues v WHERE v.slug = 'waffle-house-museum'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'The FEMA Waffle House Index');

-- Lion of Atlanta
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Inspired by Lucerne',
  'The sculptor modeled it after the Lion of Lucerne in Switzerland — a dying lion carved into a cliff face to honor Swiss Guards massacred in the French Revolution. Mark Twain called the Lucerne lion "the saddest piece of stone in the world."',
  0
FROM venues v WHERE v.slug = 'lion-of-atlanta'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Inspired by Lucerne');

-- Bellwood Quarry
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Built on Convict Labor',
  'Thousands of Black men, women, and children — many convicted of petty or fabricated crimes — were forced to break granite here in the decades after the Civil War. The city finally acknowledged this history in 2021.',
  0
FROM venues v WHERE v.slug = 'bellwood-quarry-reservoir'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Built on Convict Labor');

-- ============================================================================
-- 4. MAP ALL 36 NEW VENUES TO THE ARTEFACTS TRACK
-- ============================================================================

DO $$
DECLARE
  v_track_id UUID;
  v_venue_id INT;
  v_sort INT := 43; -- Continue from existing 43 venues
BEGIN
  SELECT id INTO v_track_id FROM explore_tracks WHERE slug = 'artefacts-of-the-lost-city';
  IF v_track_id IS NULL THEN
    RAISE NOTICE 'Track artefacts-of-the-lost-city not found, skipping expansion';
    RETURN;
  END IF;

  -- ==========================================
  -- EXISTING VENUES (already in DB, add to track)
  -- ==========================================

  -- 44. Wren's Nest (Joel Chandler Harris house)
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'wrens-nest' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Where Brer Rabbit was born. Joel Chandler Harris wrote the Uncle Remus stories in this Victorian cottage. The wren nest on the mailbox gave it its name.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 45. Margaret Mitchell House
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'margaret-mitchell-house' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Mitchell called the apartment "The Dump." She wrote the entire 1,037-page Gone with the Wind manuscript here. Arsonists burned it twice. Atlanta rebuilt it twice.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 46. Starlight Drive-In
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'starlight-drive-in' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'One of the last multi-screen drive-in theaters in America. Four screens. Since 1948. The flea market on weekend mornings is almost as legendary as the double features.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 47. Pullman Yard
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'pullman-yards' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      '1904 railcar repair facility. Walking Dead. Stranger Things. Baby Driver. Now an immersive art venue in a building the railroad forgot to demolish.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 48. Rhodes Hall
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'rhodes-hall' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'The "Castle on Peachtree." Last surviving residential mansion on Peachtree Street. Romanesque Revival with a staircase window depicting the rise and fall of the Confederacy in stained glass.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 49. Herndon Home Museum
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'herndon-home-museum' LIMIT 1;
  IF v_venue_id IS NULL THEN
    SELECT id INTO v_venue_id FROM venues WHERE slug = 'herndon-home' LIMIT 1;
  END IF;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Built by Alonzo Herndon — born into slavery, became Atlanta''s first Black millionaire. He designed the house himself. Beaux-Arts mansion with 15 rooms of original furnishings.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 50. King Center
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'king-center' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, TRUE, 'approved',
      'The eternal flame at MLK''s crypt. Lit in 1977, never extinguished. The reflecting pool and marble crypt are the most visited civil rights site in the world.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 51. Manuel's Tavern
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'manuels-tavern' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Every inch of wall covered in political memorabilia since 1956. Where reporters, politicians, and activists have been arguing for 70 years. The walls are the museum.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 52. Mary Mac's Tea Room
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'mary-macs-tea-room' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Last surviving tea room from an era when Atlanta had 16. The neon sign is a Midtown landmark. You write your own order on a notepad. Pot likker shots since 1945.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 53. Sweetwater Creek State Park (the mill ruins)
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'sweetwater-creek-state-park' LIMIT 1;
  IF v_venue_id IS NULL THEN
    SELECT id INTO v_venue_id FROM venues WHERE slug = 'sweetwater-creek' LIMIT 1;
  END IF;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Five-story brick mill ruins rising from the creek. Sherman burned New Manchester Manufacturing in 1864. The women workers were charged with treason and shipped north. The walls still stand.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 54. Underground Atlanta
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'underground-atlanta' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Atlanta''s original street level — buried under viaducts in the 1920s when the city built a new street grid on top. The old storefronts, gas lamps, and rail tracks are still down there.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 55. Arabia Mountain
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'arabia-mountain' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Exposed granite monadnock with "solution pits" — shallow pools in the rock where rare diamorpha plants grow bright red in spring. Looks like the surface of another planet. 30 minutes from downtown.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 56. Dr. Bombay's (already inserted as venue in migration 10)
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'dr-bombays-underwater-tea-party' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'A whimsical tea room behind a weathered door. Thousands of books. Tiered trays of pastries. Sales fund women''s education in Darjeeling. Atlanta''s most Wonderland-like interior.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- ==========================================
  -- NEW ARTIFACT CHILDREN (created above)
  -- ==========================================

  -- 57. Monster Mansion Monsters
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'monster-mansion-monsters' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, TRUE, 'approved',
      '107 animatronic monsters by the guy who made Country Bear Jamboree. Meet Mizzy Scarlett (named after Scarlett O''Hara) and the Boateater (modeled on the designer''s mother-in-law).')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 58. Riverview Carousel
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'riverview-carousel' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'On the National Register. Built 1908. Al Capone rode it in Chicago. 70 hand-carved horses, 40 tons. One of 3 five-abreast carousels left on earth.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 59. Stone Mountain Carving
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'stone-mountain-carving' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, TRUE, 'approved',
      'World''s largest bas-relief. 3 acres of Confederate generals carved into the world''s largest exposed granite. Started by the Mount Rushmore guy. Took 57 years.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 60. Lion of Atlanta
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'lion-of-atlanta' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Dying marble lion guarding 3,000 unknown soldiers. Modeled after the Lion of Lucerne — which Twain called "the saddest piece of stone in the world."')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 61. Margaret Mitchell's Grave
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'margaret-mitchells-grave' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Atlanta''s most visited grave. Fans leave pens and miniature books. She was buried as Margaret Mitchell Marsh — she never legally changed her name.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- ==========================================
  -- NEW STANDALONE VENUES (created above)
  -- ==========================================

  -- 62. The General Locomotive
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'the-general-locomotive' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, TRUE, 'approved',
      'The actual Civil War locomotive stolen by Union spies in 1862. Chased for 87 miles. Disney made a movie. Buster Keaton made a better one. First Medals of Honor awarded to the raiders.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 63. Waffle House Museum
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'waffle-house-museum' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, TRUE, 'approved',
      'Original Waffle House #1. 1955. The counter, stools, and 10-cent coffee menu preserved. If FEMA''s Waffle House Index goes red, civilization has collapsed.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 64. Roswell Mill Ruins
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'roswell-mill-ruins' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Sherman burned the mill and called the women workers traitors. He deported 400+ to Indiana. Most never came home. The stone walls and dam survive in the woods.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 65. Southeastern Railway Museum
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'southeastern-railway-museum' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      '90 vintage trains including a 1911 Pullman with mahogany and stained glass, and a private railcar used by President Harding. You can climb inside.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 66. Kennesaw Mountain Cannons
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'kennesaw-mountain-cannons' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Civil War artillery at the summit where 67,000 Confederates held off Sherman''s 100,000. Georgia''s most-hiked trail. Downtown skyline visible 20 miles south.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 67. Concord Covered Bridge
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'concord-covered-bridge' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Metro Atlanta''s only surviving covered bridge. 1872. Wooden pegs, not nails. Sherman burned the original; this is the replacement. Mill ruins visible from the creek.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 68. Bulloch Hall
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'bulloch-hall' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Teddy Roosevelt''s mother grew up here. He visited in 1905 to see where she was raised. 1839 Greek Revival with original plaster, mantels, and reconstructed slave quarters.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 69. Bradley Observatory
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'bradley-observatory' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'A 1930s copper-domed observatory with one of the Southeast''s largest public telescopes. Free Friday nights. Saturn''s rings visible from Decatur.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 70. Covington Clock Tower
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'covington-clock-tower' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'The "Mystic Falls" clock tower from Vampire Diaries. Fans visit from around the world. Also appeared in In the Heat of the Night, Dukes of Hazzard, and 40+ productions.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 71. Chick-fil-A Dwarf House
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'chick-fil-a-dwarf-house' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Where Truett Cathy invented the chicken sandwich in the early 1960s. The tiny "dwarf" front door is still there. 2,800+ locations started from this spot.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 72. Avondale Tudor Village
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'avondale-tudor-village' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'An entire 1920s commercial district designed to look like Stratford-upon-Avon. Half-timbered facades, leaded glass, slate roofs. Designed by George Willis, complete with a public swimming lake.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 73. Marietta National Cemetery
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'marietta-national-cemetery' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      '10,000+ Union soldiers. Most unknown. The citizen who donated the land was called a traitor. Confederate dead buried across town. The divide still exists.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 74. Indian Seats at Sawnee Mountain
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'indian-seats-sawnee-mountain' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Natural rock chairs on a mountaintop used by Cherokee as lookout points over the Etowah valley. 2-mile hike. Centuries of use before Atlanta existed.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 75. Bellwood Quarry Reservoir
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'bellwood-quarry-reservoir' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      '2.4 billion gallons of emergency water in a flooded quarry with 200-foot granite walls. Built on convict labor. Now the deepest public reservoir in Atlanta.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 76. Asa Candler Mausoleum
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'asa-candler-mausoleum' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'The Coca-Cola founder''s Egyptian tomb. Pharaonic columns, bronze hieroglyphic door, sphinx guardian. Bought the formula for $2,300 and built a pharaoh''s burial chamber.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 77. Monastery Bonsai Garden
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'monastery-bonsai-garden' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      '400+ bonsai trees tended by Trappist monks as prayer. Some trees over 100 years old. The monks also sell fudge, fruitcake, and stained glass. Silence observed.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 78. Peachtree City Golf Cart Tunnels
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'peachtree-city-golf-cart-tunnels' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      '100 miles of paths with tunnels under roads. 10,000+ golf carts as primary transport. Residents drive carts to school, church, and the grocery store. Most carts per capita in America.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 79. Stately Oaks Plantation
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'stately-oaks-plantation' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'The plantation that inspired Tara. 1839. Margaret Mitchell modeled Tara after the plantations in this county where her grandmother lived. Visitors still think it''s the real one.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  RAISE NOTICE 'Artefacts track expansion complete: mapped to position %', v_sort;
END $$;
