-- Venue highlights expansion for under-covered explore tracks
-- Target: 50%+ highlight coverage per track
-- Tracks expanded: Say Less (speakeasy/cocktails), Beautiful Mosaic (global Atlanta),
-- Too Busy to Hate (LGBTQ+), The Itis (food), Yallywood (stage/screen),
-- Keep Moving Forward (BeltLine), Keep Swinging (sports), Spelhouse Spirit (HBCUs)

-- ============================================================
-- SAY LESS — Speakeasy & Cocktail Bars (10% -> 50%)
-- ============================================================

-- Himitsu
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Secret Entrance',
  'Tucked behind a ramen shop with no signage. You have to know it''s there and find the unmarked door — the mystery of discovery is the first cocktail.',
  0
FROM venues v WHERE v.slug = 'himitsu';

-- Kimball House
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Restored Victorian Oyster Bar',
  'A 19th-century train depot converted into a soaring oyster bar with original pressed tin ceilings, marble bars, and gaslight-era chandeliers. The architecture matches the cocktail precision.',
  0
FROM venues v WHERE v.slug = 'kimball-house';

-- Paper Plane
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Aviation-Themed Detail',
  'Named after the modern classic cocktail, with subtle airplane motifs woven into the decor. The leather banquettes feel like first-class cabin seating.',
  0
FROM venues v WHERE v.slug = 'paper-plane';

-- The Beverly
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'The Vintage Lounge Aesthetic',
  'A rotating collection of vintage furniture, lamps, and wall art that makes every corner feel like a different era''s living room. Nothing matches, everything works.',
  0
FROM venues v WHERE v.slug = 'the-beverly';

-- Ticonderoga Club
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Nautical Parlor Rooms',
  'Multiple intimate rooms decorated like a 19th-century ship captain''s quarters — wood paneling, maritime maps, brass fixtures. Each space feels like a private cabin.',
  0
FROM venues v WHERE v.slug = 'ticonderoga-club';

-- ============================================================
-- A BEAUTIFUL MOSAIC — Global Atlanta (12% -> 50%)
-- ============================================================

-- Buford Highway Farmers Market
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The International Grocery Labyrinth',
  'Aisles organized by country and region — Korean, Vietnamese, Indian, Mexican, Caribbean, African, Eastern European. You can find ingredients from 100+ countries under one roof.',
  0
FROM venues v WHERE v.slug = 'buford-highway-farmers-market';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Food Court United Nations',
  'A food court where Vietnamese pho, Guatemalan pupusas, Filipino lumpia, and Russian pelmeni share tables. Twenty cuisines, zero gentrification.',
  1
FROM venues v WHERE v.slug = 'buford-highway-farmers-market';

-- Plaza Fiesta
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'The Dead Mall Revival',
  'A former suburban mall reborn as a Mexican and Latin American marketplace. Where Sears and JCPenney once stood, now botanicas, taco stalls, quinceañera dress shops, and live mariachi bands.',
  0
FROM venues v WHERE v.slug = 'plaza-fiesta';

-- Kamayan ATL
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Boodle Fight Feast',
  'Traditional Filipino kamayan service — platters of food spread on banana leaves, eaten with hands, shared family-style. The communal eating ritual breaks down every social barrier.',
  0
FROM venues v WHERE v.slug = 'kamayan-atl';

-- Ebenezer Baptist Church
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'MLK''s Pulpit',
  'The church where Martin Luther King Jr. was baptized, ordained, and served as co-pastor with his father. The sanctuary where he preached between marches.',
  0
FROM venues v WHERE v.slug = 'ebenezer-baptist-church';

-- Cafe Mozart Bakery
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Old World European Pastry Case',
  'Black Forest cake, Sachertorte, strudel, linzer torte — Austrian and German pastries baked daily by European-trained bakers. The strudel dough is still hand-stretched.',
  0
FROM venues v WHERE v.slug = 'cafe-mozart-duluth';

-- Desta Ethiopian Kitchen
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Injera Tablecloth',
  'Platters served directly on injera spread across communal tables. Tear pieces of the spongy flatbread to scoop stews — the bread IS the plate, utensil, and side dish.',
  0
FROM venues v WHERE v.slug = 'desta-ethiopian-kitchen';

-- Canton House Restaurant
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Dim Sum Cart Service',
  'Rolling carts of steamed buns, dumplings, and turnip cakes circulate the dining room. You point at what looks good, staff stamps your card — the way dim sum has been served for generations.',
  0
FROM venues v WHERE v.slug = 'canton-house-restaurant';

-- Virgil's Gullah Kitchen
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Gullah Geechee Culinary Tradition',
  'Recipes and cooking techniques from the Gullah Geechee people of the coastal Southeast — okra soup, shrimp and grits, red rice, she-crab soup. This cuisine shaped all of Lowcountry cooking.',
  0
FROM venues v WHERE v.slug = 'virgils-gullah-kitchen';

-- Bole Ethiopian
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Ethiopian Coffee Ceremony',
  'Traditional coffee ceremony performed tableside on weekends — green beans roasted over charcoal, hand-ground, brewed in a clay pot. The ritual takes 30 minutes and fills the room with smoke and aroma.',
  0
FROM venues v WHERE v.slug = 'bole-ethiopian';

-- ============================================================
-- TOO BUSY TO HATE — LGBTQ+ Culture (13% -> 50%)
-- ============================================================

-- Atlanta Eagle
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'The Eagle Patio Legacy',
  'A legendary leather bar since the 1980s with an outdoor patio that has witnessed decades of queer nightlife evolution. The spot where generations of Atlanta''s leather and bear communities gathered.',
  0
FROM venues v WHERE v.slug = 'atlanta-eagle';

-- Blake's on the Park
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'viewpoint', 'The Piedmont Park View Patio',
  'A multi-level patio overlooking Piedmont Park where Sunday brunch crowds spill into the afternoon. The view of the park and Midtown skyline is unmatched.',
  0
FROM venues v WHERE v.slug = 'blakes-on-the-park';

-- Bulldogs
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Red Room Dance Floor',
  'A vibrant dance floor with red lighting and a rotating lineup of DJs spinning everything from Top 40 to Latin nights. The energy peaks around midnight.',
  0
FROM venues v WHERE v.slug = 'bulldogs';

-- Friends on Ponce
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Bowling Alley Bar',
  'A full bar tucked into a retro bowling alley. Sip cocktails while you bowl — the collision of dive bar, sports bar, and queer nightclub that only works in Atlanta.',
  0
FROM venues v WHERE v.slug = 'friends-on-ponce';

-- Jungle Atlanta
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'The Tropical Maximalist Interior',
  'Floor-to-ceiling jungle murals, hanging plants, tiki decor, and neon signs create a sensory overload tropical fantasy. Every surface is decorated.',
  0
FROM venues v WHERE v.slug = 'jungle-atlanta';

-- Lips Atlanta
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Drag Dinner Theater',
  'Full drag performances during dinner service — queens sing, dance, and roast the audience between courses. The entertainment is as important as the food.',
  0
FROM venues v WHERE v.slug = 'lips-atlanta';

-- My Sister's Room
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'The Lesbian Bar Survivor',
  'One of the few remaining lesbian bars in the United States, open since 1980. A vital queer women''s space in a city where most lesbian bars have closed.',
  0
FROM venues v WHERE v.slug = 'my-sisters-room';

-- ============================================================
-- THE ITIS — Food Scene (24% -> 50%)
-- ============================================================

-- Bacchanalia
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'The Converted Meatpacking Plant',
  'A soaring industrial space with exposed brick, steel beams, and 30-foot ceilings. The raw architecture frames the refined tasting menu service.',
  0
FROM venues v WHERE v.slug = 'bacchanalia';

-- BoccaLupo
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Handmade Pasta Bar',
  'Watch the pasta team roll, cut, and shape fresh pasta throughout service. The open kitchen puts the craft on display — flour dust and all.',
  0
FROM venues v WHERE v.slug = 'boccalupo';

-- Gunshow
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Dim Sum Cart Concept',
  'Chefs circulate the dining room with plates of food like dim sum carts. You flag down what looks good. The format turns dinner into an interactive performance.',
  0
FROM venues v WHERE v.slug = 'gunshow';

-- Staplehouse
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'The Mission-Driven Restaurant',
  'Opened in memory of chef Ryan Hidinger, with profits funding the Giving Kitchen charity. Every meal supports hospitality workers in crisis — the food is incredible, the mission is bigger.',
  0
FROM venues v WHERE v.slug = 'staplehouse';

-- Miller Union
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Seasonal Farm Board',
  'A chalkboard listing the farms supplying each ingredient. The menu changes with Georgia seasons — spring peas, summer tomatoes, fall squash, winter greens.',
  0
FROM venues v WHERE v.slug = 'miller-union';

-- Twisted Soul
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'The Afro-Southern Fusion Menu',
  'Soul food techniques meet global spices — African, Caribbean, Asian influences woven into Southern classics. The oxtails and jollof rice collard greens redefine tradition.',
  0
FROM venues v WHERE v.slug = 'twisted-soul';

-- ============================================================
-- YALLYWOOD — Stage & Screen (36% -> 50%)
-- ============================================================

-- 7 Stages
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Atlanta''s Political Theater Home',
  'Founded in 1979 as a home for socially conscious and experimental theater. The black box stages have hosted decades of provocative work that wouldn''t survive at mainstream venues.',
  0
FROM venues v WHERE v.slug = '7-stages';

-- Actor's Express
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Intimate 150-Seat House',
  'A small theater where every seat feels like front row. The proximity to actors makes even quiet moments land with force.',
  0
FROM venues v WHERE v.slug = 'actors-express';

-- ============================================================
-- KEEP MOVING FORWARD — BeltLine (38% -> 50%)
-- ============================================================

-- Grant Park
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'nature', 'The Olmsted Landscape Design',
  'Designed by sons of Frederick Law Olmsted in 1883. Rolling hills, winding paths, century-old oak trees — the vision of urban parkland as democratic public space.',
  0
FROM venues v WHERE v.slug = 'grant-park';

-- New Realm Brewing
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'viewpoint', 'The BeltLine Patio',
  'A sprawling patio directly on the BeltLine Eastside Trail. Watch cyclists, runners, and strollers stream past while you drink beer — the patio IS the people-watching.',
  0
FROM venues v WHERE v.slug = 'new-realm-brewing';

-- ============================================================
-- KEEP SWINGING — Sports & Game Day (44% -> 50%)
-- ============================================================

-- Mercedes-Benz Stadium
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'The Retractable Petal Roof',
  'A one-of-a-kind retractable roof that opens like a camera aperture — eight triangular petals unfold to reveal the sky. The engineering is as impressive as the games.',
  0
FROM venues v WHERE v.slug = 'mercedes-benz-stadium';

-- ============================================================
-- THE SOUTH GOT SOMETHING TO SAY — Hip Hop Heritage (44% -> 50%)
-- ============================================================

-- College Park MARTA Station
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'The Player''s Ball Transit Hub',
  'The MARTA station immortalized in OutKast''s "Player''s Ball" — the train line that connected the Southside to downtown. The station name appears in dozens of Atlanta rap songs.',
  0
FROM venues v WHERE v.slug = 'college-park-marta-station';

-- ============================================================
-- SPELHOUSE SPIRIT — HBCU Culture (45% -> 50%)
-- ============================================================

-- Atlanta University Center
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'The Largest HBCU Consortium',
  'Four HBCUs — Spelman, Morehouse, Clark Atlanta, Morehouse School of Medicine — share a 250-acre campus. The concentration of Black academic excellence is unmatched in American higher education.',
  0
FROM venues v WHERE v.slug = 'atlanta-university-center';
