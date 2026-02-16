-- Comprehensive venue highlights seed for Atlanta venues
-- Each highlight is a "thing a local would tell you not to miss"
-- Uses slug lookup so inserts are idempotent and safe if venue doesn't exist

-- ============================================================
-- MUSEUMS & CULTURAL
-- ============================================================

-- High Museum of Art
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'viewpoint', 'The Meier Atrium Light Well',
  'Stand in the center atrium at noon — the Richard Meier skylight creates a cathedral of natural light that changes completely every hour.',
  0
FROM venues v WHERE v.slug = 'high-museum-of-art';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Renzo Piano Floating Staircase',
  'The three-story aluminum ribbon staircase in the Wieland Pavilion looks like a sculpture itself. Best photographed from the ground floor looking up.',
  1
FROM venues v WHERE v.slug = 'high-museum-of-art';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'photo_spot', 'Plaza Reflecting Pool',
  'The shallow pool on the plaza mirrors the museum''s white facade. Shoot from the southwest corner at golden hour for a skyline backdrop.',
  2
FROM venues v WHERE v.slug = 'high-museum-of-art';

-- Fernbank Museum of Natural History
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'nature', 'Fernbank Forest',
  '65 acres of old-growth Piedmont forest with 2+ miles of trails behind the museum. One of Atlanta''s last primeval forests, preserved since 1939.',
  0
FROM venues v WHERE v.slug = 'fernbank-museum-of-natural-history';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Great Hall Windows',
  'Floor-to-ceiling 65-foot windows frame the forest like living art. The dinosaurs get attention, but locals know this view is what makes Fernbank special.',
  1
FROM venues v WHERE v.slug = 'fernbank-museum-of-natural-history';

-- Also try alternate slug
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'nature', 'Fernbank Forest',
  '65 acres of old-growth Piedmont forest with 2+ miles of trails behind the museum. One of Atlanta''s last primeval forests, preserved since 1939.',
  0
FROM venues v WHERE v.slug = 'fernbank-museum'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Fernbank Forest');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Great Hall Windows',
  'Floor-to-ceiling 65-foot windows frame the forest like living art. The dinosaurs get attention, but locals know this view is what makes Fernbank special.',
  1
FROM venues v WHERE v.slug = 'fernbank-museum'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Great Hall Windows');

-- Atlanta History Center
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Swan House Servant Stairs',
  'A hidden spiral staircase staff used to move between floors unseen — a stark reminder of 1920s social hierarchy. Most visitors miss the entrance behind the kitchen.',
  0
FROM venues v WHERE v.slug = 'atlanta-history-center';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'viewpoint', 'Goizueta Garden Overlook',
  'The terraced gardens drop down toward Peachtree Creek with views most people don''t associate with Buckhead. Great for understanding why this land was so valuable.',
  1
FROM venues v WHERE v.slug = 'atlanta-history-center';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Tullie Smith Farm Root Cellar',
  'An actual 1840s underground storage room that stayed 50-55 degrees year-round. You can still feel the temperature drop when you step inside.',
  2
FROM venues v WHERE v.slug = 'atlanta-history-center';

-- Center for Civil & Human Rights
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'The Lunch Counter Experience',
  'The interactive sit-in exhibit lets you feel what activists endured. The actual preserved counter with cigarette burns tells the real story.',
  0
FROM venues v WHERE v.slug = 'national-center-for-civil-and-human-rights';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Reflection Room',
  'A quiet meditation space most visitors rush past. The curved mirror installation is designed to make you confront your own reflection while considering civil rights.',
  1
FROM venues v WHERE v.slug = 'national-center-for-civil-and-human-rights';

-- Also try alternate slug
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'The Lunch Counter Experience',
  'The interactive sit-in exhibit lets you feel what activists endured. The actual preserved counter with cigarette burns tells the real story.',
  0
FROM venues v WHERE v.slug = 'civil-rights-center'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'The Lunch Counter Experience');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Reflection Room',
  'A quiet meditation space most visitors rush past. The curved mirror installation is designed to make you confront your own reflection while considering civil rights.',
  1
FROM venues v WHERE v.slug = 'civil-rights-center'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'The Reflection Room');

-- Michael C. Carlos Museum (Emory)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'Ancient Portrait Panels',
  'Skip the mummies everyone photographs — the 2nd-century portrait panels still have vibrant color after nearly two millennia. Side gallery, easy to miss.',
  0
FROM venues v WHERE v.slug = 'michael-c-carlos-museum';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'The Sunken Entrance Court',
  'The outdoor courtyard with ancient columns creates a surreal Atlanta-meets-Mediterranean moment. Empty on weekday mornings.',
  1
FROM venues v WHERE v.slug = 'michael-c-carlos-museum';

-- MOCA GA
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'photo_spot', 'Industrial Skylight Grid',
  'The raw warehouse ceiling with geometric light wells — stay until late afternoon when angular shadows cut across the white walls.',
  0
FROM venues v WHERE v.slug = 'moca-ga';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Original Loading Dock Doors',
  'The roll-up doors from when this was an actual West Midtown warehouse are now part of the exhibition space. The patina tells the neighborhood''s transformation story.',
  1
FROM venues v WHERE v.slug = 'moca-ga';

-- Hammonds House Museum
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'The Eastlake Victorian House',
  'The 1857 Eastlake Victorian home is one of the West End''s finest surviving residences. The art collection is world-class but the house itself is the hidden masterpiece.',
  0
FROM venues v WHERE v.slug = 'hammonds-house-museum';

-- Atlanta Contemporary
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Studio Artist Program',
  'Working artists keep studios on-site. If you visit during open hours, you can sometimes peek into active creative work — not just finished exhibitions.',
  0
FROM venues v WHERE v.slug = 'atlanta-contemporary';

-- Center for Puppetry Arts
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'Jim Henson Collection',
  'One of the world''s largest collections of Jim Henson puppets — original Kermit, Miss Piggy, and Fraggle Rock characters. The detail up close is extraordinary.',
  0
FROM venues v WHERE v.slug = 'center-for-puppetry-arts';

-- College Football Hall of Fame
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Indoor Playing Field',
  'A regulation 45-yard indoor field where you can run routes and kick field goals. Most visitors don''t realize you can actually play.',
  0
FROM venues v WHERE v.slug = 'college-football-hof';

-- Margaret Mitchell House
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The "Dump" Writing Apartment',
  'Mitchell called her apartment "the dump" — her writing desk faced a wall and the bathtub was in the kitchen. You see why she wrote about grand estates.',
  0
FROM venues v WHERE v.slug = 'margaret-mitchell-house';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'photo_spot', 'Crescent Avenue Oak Frame',
  'The massive oak tree frames the Tudor Revival house perfectly from the southwest corner. Bloom season in April adds dogwood contrast.',
  1
FROM venues v WHERE v.slug = 'margaret-mitchell-house';

-- ============================================================
-- MUSIC & THEATER VENUES
-- ============================================================

-- Fox Theatre
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Moorish Revival Architecture',
  'The 1929 interior is a destination unto itself — a starlit ceiling with 96 crystal stars, ornate balconies, and a Moorish courtyard. Arrive early to take it in.',
  0
FROM venues v WHERE v.slug = 'fox-theatre';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Egyptian Ballroom Hieroglyphs',
  'Most people see the main auditorium and leave. The second-floor ballroom has hand-painted "hieroglyphs" that are actually Art Deco gibberish — beautiful gibberish.',
  1
FROM venues v WHERE v.slug = 'fox-theatre';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Mighty Mo Organ',
  'The 3,622-pipe Moller organ hidden behind the walls still works. During tours they''ll sometimes play it — you feel the bass notes in your chest.',
  2
FROM venues v WHERE v.slug = 'fox-theatre';

-- The Tabernacle
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'The Converted Church Interior',
  'Built as a Baptist church in 1910, the original stained glass and vaulted ceilings now frame punk shows and hip-hop acts. The acoustics are a happy accident of faith.',
  0
FROM venues v WHERE v.slug = 'the-tabernacle';

-- The Masquerade
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'viewpoint', 'Heaven Rooftop Pre-Show View',
  'Get there early and head to the outdoor area — the downtown skyline framed by Old Fourth Ward rooftops is peak Atlanta aesthetic.',
  0
FROM venues v WHERE v.slug = 'the-masquerade';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'The Excelsior Mill Bones',
  'Original 1890s industrial infrastructure still visible in the walls. The building processed flour before it processed mosh pits.',
  1
FROM venues v WHERE v.slug = 'the-masquerade';

-- Terminal West
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'photo_spot', 'King Plow Water Tower',
  'The vintage water tower visible from the outdoor patio is the perfect "Atlanta industrial chic" backdrop. Best shot at blue hour with the tower lit.',
  0
FROM venues v WHERE v.slug = 'terminal-west';

-- Variety Playhouse
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'The Little Five Points Cinema Roots',
  'This was a movie theater from the 1940s through the ''80s before becoming a music venue. The sloped floor and balcony seating still give it a cinematic feel.',
  0
FROM venues v WHERE v.slug = 'variety-playhouse';

-- Eddie's Attic
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Songwriter''s Open Mic Legacy',
  'John Mayer, Sugarland, and the Indigo Girls all played their first Atlanta shows here. The open mic nights still run — you might catch the next one.',
  0
FROM venues v WHERE v.slug = 'eddies-attic';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Attic Window Spillover',
  'In summer the second-floor window opens and sound spills onto the Decatur square. Locals know you can catch shows for free from the benches outside.',
  1
FROM venues v WHERE v.slug = 'eddies-attic';

-- The Earl
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'Pressed Tin Ceiling Patchwork',
  'Every section of pressed tin ceiling is from a different demolished Atlanta building. It''s an accidental archive of lost architecture overhead.',
  0
FROM venues v WHERE v.slug = 'the-earl';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Back Patio Mural Rotation',
  'Local artists repaint the patio wall every few months. It''s like a rotating gallery of East Atlanta Village street art.',
  1
FROM venues v WHERE v.slug = 'the-earl';

-- Plaza Theatre
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Atlanta''s Oldest Cinema',
  'Operating since 1939, this single-screen art house has survived the multiplex era. The neon marquee on Ponce is an Atlanta landmark in its own right.',
  0
FROM venues v WHERE v.slug = 'plaza-theatre';

-- Dad's Garage Theatre
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Cast Hangs After the Show',
  'The improv cast doesn''t disappear backstage — they drink at the lobby bar with the audience. BYOB-friendly, and the conversation is half the experience.',
  0
FROM venues v WHERE v.slug = 'dad-s-garage-theatre';

-- Shakespeare Tavern
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Elizabethan Thrust Stage',
  'The only Shakespeare company in America performing in original Elizabethan staging — no proscenium, actors surrounded by audience on three sides.',
  0
FROM venues v WHERE v.slug = 'shakespeare-tavern';

-- 7 Stages
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Little Five Points Theater Lab',
  'Running experimental and new works since 1979, this is where Atlanta''s avant-garde theater scene was born. The intimate black box has launched careers.',
  0
FROM venues v WHERE v.slug = '7-stages';

-- Callanwolde Fine Arts Center
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Gothic Tudor Revival Mansion',
  'The 1920 Asa Candler Jr. estate is 27,000 square feet of hand-carved marble, leaded glass, and a 3,752-pipe Aeolian organ. The art classes happen inside a palace.',
  0
FROM venues v WHERE v.slug = 'callanwolde-fine-arts-center';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'nature', 'The Formal Gardens',
  'Twelve acres of professionally maintained gardens with walking paths, sculptures, and mature hardwoods. Free to walk the grounds anytime.',
  1
FROM venues v WHERE v.slug = 'callanwolde-fine-arts-center';

-- ============================================================
-- PARKS & GARDENS
-- ============================================================

-- Piedmont Park
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'viewpoint', 'Active Oval North Berm',
  'The small hill at the north end of the meadow gives you the full Midtown skyline with the park in the foreground. Best picnic spot in the city.',
  0
FROM venues v WHERE v.slug = 'piedmont-park';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', '1895 Exposition Ruins',
  'Near the 12th Street entrance, a stone foundation is all that remains of the Cotton States and International Exposition. Most people walk right over it.',
  1
FROM venues v WHERE v.slug = 'piedmont-park';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'nature', 'Clara Meer Dock at Sunrise',
  'The wooden dock on the lake''s east side faces due east. Summer sunrise over the water with heron activity is quiet magic.',
  2
FROM venues v WHERE v.slug = 'piedmont-park';

-- Atlanta Botanical Garden
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'nature', 'Canopy Walk',
  'A 600-foot elevated walkway 40 feet above the forest floor in the Storza Woods. Best at golden hour when the light filters through.',
  0
FROM venues v WHERE v.slug = 'atlanta-botanical-garden';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Edible Garden Teaching Beds',
  'Most people rush to the Orchid Center and miss the working vegetable garden. Free samples during harvest season if you catch the volunteers.',
  1
FROM venues v WHERE v.slug = 'atlanta-botanical-garden';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'Chihuly in the Fern Grotto',
  'The permanent Chihuly glass installation is hidden behind the Japanese garden, not in the main galleries. Go at twilight when it glows.',
  2
FROM venues v WHERE v.slug = 'atlanta-botanical-garden';

-- Oakland Cemetery
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Victorian Garden Cemetery',
  'Founded 1850. Self-guided tours wind past ornate monuments, Confederate memorials, and the graves of Margaret Mitchell and Bobby Jones.',
  0
FROM venues v WHERE v.slug = 'oakland-cemetery';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'viewpoint', 'Bell Tower Overlook',
  'During special tours you can climb the tower for a view of the city from its oldest vantage point. You see how much Atlanta has grown around this anchor.',
  1
FROM venues v WHERE v.slug = 'oakland-cemetery';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'Victorian Stained Glass Mausoleums',
  'The Jasper Newton Smith mausoleum has perfectly intact 1884 stained glass. Afternoon light makes it glow — most visitors photograph the big monuments and miss this.',
  2
FROM venues v WHERE v.slug = 'oakland-cemetery';

-- Centennial Olympic Park
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Fountain of Rings Show Schedule',
  'The fountain plays 4 different programmed water shows daily. The 7pm summer show has the highest jets and best music sync — locals time their visits around it.',
  0
FROM venues v WHERE v.slug = 'centennial-olympic-park';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'photo_spot', 'Amphitheater Stairs Panorama',
  'Sit on the upper steps facing south — you get the Ferris wheel, CNN Center, and Mercedes-Benz Stadium in one sweep.',
  1
FROM venues v WHERE v.slug = 'centennial-olympic-park';

-- Grant Park
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Fort Walker Civil War Earthworks',
  'The park contains some of Atlanta''s only surviving Civil War fortifications. The earthen berms near the zoo entrance are easy to miss but date to 1864.',
  0
FROM venues v WHERE v.slug = 'grant-park';

-- Historic Fourth Ward Park
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'viewpoint', 'Stormwater Pond Skyline Reflection',
  'The retention pond was designed as infrastructure but became one of Atlanta''s best skyline mirror shots. The BeltLine runs right along the edge.',
  0
FROM venues v WHERE v.slug = 'historic-fourth-ward-park';

-- ============================================================
-- FOOD & DRINK
-- ============================================================

-- Ponce City Market
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'viewpoint', 'Rooftop City Views',
  '9th floor open-air deck with panoramic Midtown skyline views. The west corner at sunset gives you skyline, BeltLine, and Stone Mountain in one sweep.',
  0
FROM venues v WHERE v.slug = 'ponce-city-market';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Original Sears Loading Platform',
  'The outdoor courtyard was where trucks loaded Sears catalog orders. The old rail tracks are still embedded in the concrete beneath your feet.',
  1
FROM venues v WHERE v.slug = 'ponce-city-market';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'The 1926 Sears Trusses',
  'The second-floor skybridge over the food hall exposes the original wood trusses of the 1926 Sears, Roebuck building. Look up.',
  2
FROM venues v WHERE v.slug = 'ponce-city-market';

-- Krog Street Market
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'photo_spot', 'Inman Park Loading Dock',
  'The industrial backdoor entrance with original brick and the BeltLine visible through the trees — way better than the main entrance for photos.',
  0
FROM venues v WHERE v.slug = 'krog-street-market';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'Adjacent Tunnel Murals',
  'Steps from the market, the Krog Street Tunnel is Atlanta''s most famous street art gallery. New murals appear weekly — Thursday mornings before crowds is when artists work.',
  1
FROM venues v WHERE v.slug = 'krog-street-market';

-- Sweet Auburn Curb Market
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Atlanta''s Oldest Market',
  'Operating since 1923 as the Municipal Market, this is where Auburn Avenue''s Black business district met working-class Atlanta. The original tile floor is still underfoot.',
  0
FROM venues v WHERE v.slug = 'sweet-auburn-curb-market';

-- Monday Night Brewing
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'viewpoint', 'Garage Rooftop Westside View',
  'The second-floor opens up to the Westside skyline. You''re literally watching the neighborhood transform around you, beer in hand.',
  0
FROM venues v WHERE v.slug = 'monday-night-brewing';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Fermenter Room Windows',
  'Ground-floor windows look directly into the working brewery. Visit on packaging days (Wednesdays typically) to see the full operation.',
  1
FROM venues v WHERE v.slug = 'monday-night-brewing';

-- SweetWater Brewing
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'nature', 'Chattahoochee Trail Access',
  'The brewery sits steps from the river trail. Locals bike the Hooch, stop for a tasting flight on the patio, then ride back.',
  0
FROM venues v WHERE v.slug = 'sweetwater-brewing-company';

-- Orpheus Brewing
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'viewpoint', 'Piedmont Park Patio View',
  'Perched right at the edge of Piedmont Park, the patio has one of the best park-to-skyline views of any brewery in the country.',
  0
FROM venues v WHERE v.slug = 'orpheus-brewing';

-- New Realm Brewing
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'viewpoint', 'BeltLine Rooftop Deck',
  'Three-story brewery right on the BeltLine Eastside Trail. The rooftop deck gives you a front-row seat to the parade of Atlanta walking by.',
  0
FROM venues v WHERE v.slug = 'new-realm-brewing';

-- Bold Monk Brewing
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', '30-Foot Monastery Ceilings',
  'Modeled after a Belgian abbey hall with 30-foot vaulted ceilings, reclaimed wood, and communal tables that seat 20. Easily the most dramatic brewery interior in the city.',
  0
FROM venues v WHERE v.slug = 'bold-monk-brewing';

-- ============================================================
-- BARS & NIGHTLIFE
-- ============================================================

-- Clermont Lounge
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'The 1924 Hotel Basement',
  'Downstairs from the Clermont Hotel since 1965 — the hotel got a boutique renovation but the basement stayed untouched. The contrast between upstairs and down is the whole story of Atlanta.',
  0
FROM venues v WHERE v.slug = 'clermont-lounge';

-- Northside Tavern
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Sawdust Floor Blues Joint',
  'Real sawdust on the floor, live blues seven nights a week since the ''70s. This is what Atlanta''s west side sounded like before the condos came.',
  0
FROM venues v WHERE v.slug = 'northside-tavern';

-- MJQ Concourse
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Underground Bunker',
  'Below a parking lot in Poncey-Highland, this literal underground bunker has hosted Atlanta''s best DJs for decades. If you don''t know where the door is, you''re not getting in.',
  0
FROM venues v WHERE v.slug = 'mjq-concourse';

-- Sister Louisa's Church
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'Church Art Fever Dream',
  'Every surface is covered in Grant Henry''s irreverent folk art — thrift store paintings remixed with provocative text. It''s a gallery disguised as a bar disguised as a church.',
  0
FROM venues v WHERE v.slug = 'sister-louisas-church';

-- Joystick Gamebar
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Free-Play Vintage Arcade',
  'All the classic arcade cabinets are free to play — no quarters needed. The craft cocktail menu is serious too. Best combination in Little Five.',
  0
FROM venues v WHERE v.slug = 'joystick-gamebar';

-- Ormsby's
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Games Basement',
  'Bocce courts, shuffleboard, darts, and board games fill the massive downstairs space. Most people drink upstairs and never discover the playground below.',
  0
FROM venues v WHERE v.slug = 'ormsbys';

-- Painted Duck
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Duckpin Bowling Lanes',
  'Full duckpin bowling lanes hidden inside a Westside bar. Smaller balls, no rental shoes required — it''s bowling for people who hate bowling alleys.',
  0
FROM venues v WHERE v.slug = 'painted-duck';

-- ============================================================
-- HISTORIC & CIVIC LANDMARKS
-- ============================================================

-- Martin Luther King Jr. National Historical Park
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'The Birth Home Kitchen',
  'The actual hand pump in MLK''s childhood home that the family used until 1935. The wear pattern on the handle comes from three generations.',
  0
FROM venues v WHERE v.slug = 'martin-luther-king-jr-national-historical-park';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Fire Station No. 6',
  'The restored 1894 firehouse next door still has the original sleeping quarters upstairs. Most visitors skip it for the church, but it''s a gem.',
  1
FROM venues v WHERE v.slug = 'martin-luther-king-jr-national-historical-park';

-- Ebenezer Baptist Church
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'Original 1914 Stained Glass',
  'The Heritage Sanctuary has the original stained glass that MLK Sr. installed. Late afternoon light makes them glow in a way photographs can''t capture.',
  0
FROM venues v WHERE v.slug = 'ebenezer-baptist-church';

-- Wren's Nest
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Joel Chandler Harris Home',
  'The 1870s Queen Anne home of the Uncle Remus creator is one of Atlanta''s oldest house museums. The front porch where Harris told stories is preserved.',
  0
FROM venues v WHERE v.slug = 'wrens-nest';

-- ============================================================
-- SPORTS & ENTERTAINMENT
-- ============================================================

-- Mercedes-Benz Stadium
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Retractable Roof Aperture',
  'Eight triangular panels open like a camera aperture in about 7 minutes. Watch it from inside on game day — it looks like science fiction.',
  0
FROM venues v WHERE v.slug = 'mercedes-benz-stadium';

-- State Farm Arena
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Concourse Art Walk',
  'The renovated arena has curated Atlanta art installations throughout the concourse levels. Most fans rush to seats and miss the rotating gallery.',
  0
FROM venues v WHERE v.slug = 'state-farm-arena';

-- Georgia Aquarium
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Ocean Voyager Acrylic Window',
  'The massive viewing window is actually 6 individual acrylic panels with nearly invisible seams. At certain angles the seams refract light in rainbow patterns.',
  0
FROM venues v WHERE v.slug = 'georgia-aquarium';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'viewpoint', 'Dolphin Theater Upper Gallery',
  'The back row of the dolphin show gives you a top-down view of the pool geometry. You see the intelligence of the choreography better than from front row.',
  1
FROM venues v WHERE v.slug = 'georgia-aquarium';

-- Zoo Atlanta
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'nature', 'The Willie B. Forest Canopy',
  'Named for Atlanta''s most famous gorilla, the habitat has century-old oaks that predate the zoo. The gorillas use them exactly like they would in the wild.',
  0
FROM venues v WHERE v.slug = 'zoo-atlanta';

-- Starlight Drive-In
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Last Drive-In Standing',
  'One of the few remaining drive-in theaters in a major American city, open since 1955. Four screens, swap meets on weekends, and the same snack bar atmosphere.',
  0
FROM venues v WHERE v.slug = 'starlight-drive-in';

-- ============================================================
-- UNIVERSITIES & COLLEGES
-- ============================================================

-- Emory University
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'nature', 'Lullwater Preserve',
  'A 154-acre nature preserve hidden in the middle of campus with a suspension bridge, waterfall, and the president''s mansion. Most Atlantans don''t know it exists.',
  0
FROM venues v WHERE v.slug = 'emory-university';

-- Spelman College
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'Spelman Museum of Fine Art',
  'The only museum in the country dedicated to art by and about women of the African diaspora. Intimate galleries, world-class collection, overlooked by tourists.',
  0
FROM venues v WHERE v.slug = 'spelman-college';

-- Georgia Tech
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Tech Tower Gold Dome',
  'The iconic 1888 administration building with its gold-leafed dome is visible from across Midtown. The "T" letters have been famously stolen by students throughout history.',
  0
FROM venues v WHERE v.slug = 'georgia-tech';

-- Oglethorpe University
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Crypt of Civilization',
  'Sealed in 1940, this time capsule in the basement isn''t meant to be opened until the year 8113. It''s recognized by Guinness as the first successful time capsule.',
  0
FROM venues v WHERE v.slug = 'oglethorpe-university';

-- ============================================================
-- UNIQUE ATLANTA
-- ============================================================

-- Eyedrum
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Three Decades of Weird Atlanta',
  'Running since 1997, Eyedrum has outlived five locations and every wave of gentrification. The current Krog Street space has raw concrete walls that artists alter during residencies.',
  0
FROM venues v WHERE v.slug = 'eyedrum';

-- Criminal Records
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Back Room Comics Vault',
  'The vinyl up front draws the crowds, but the back room has one of the best independent comics selections in the Southeast. Ask about the rare bin.',
  0
FROM venues v WHERE v.slug = 'criminal-records';

-- The Bakery
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'No Sign, No Map Pin',
  'There''s no signage. You find it through the scene or you don''t. The old commercial ovens are still in the back room behind the stage.',
  0
FROM venues v WHERE v.slug = 'the-bakery';

-- SCAD Atlanta
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'Free Student Galleries',
  'SCAD''s Midtown campus has rotating exhibitions of student and professional work that are free and open to the public. Quality rivals the commercial galleries.',
  0
FROM venues v WHERE v.slug = 'scad-atlanta';

-- SCAD FASH Museum
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Free Costume Exhibitions',
  'Most Atlantans walk past this Midtown building without realizing there''s a free museum inside. Past shows have included original Oscar gowns and avant-garde couture.',
  0
FROM venues v WHERE v.slug = 'scad-fash';
