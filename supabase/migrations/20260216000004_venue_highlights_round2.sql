-- Venue highlights round 2: Skyline views, street art, historical, weird Atlanta
-- Curated for quality — each is a specific feature, fact, or hidden thing
-- Uses slug lookup so inserts are safe if venue doesn't exist

-- ============================================================
-- SKYLINE VIEWS & VIEWPOINTS
-- ============================================================

-- Sun Dial Restaurant (Westin Peachtree Plaza, 73rd floor)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'viewpoint', 'Rotating 73rd-Floor Panorama',
  'The bar and restaurant rotate independently — the full loop takes about an hour. Sit still and watch the entire city drift past. On clear days you can pick out Stone Mountain 16 miles east.',
  0
FROM venues v WHERE v.slug = 'sun-dial-restaurant';

-- Polaris (Hyatt Regency, 22nd floor)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Atlanta''s Original Rotating Bar',
  'Operating since 1967, this was the city''s first revolving lounge — the one that started the trend. The full rotation takes 90 minutes, slow enough to watch neighborhoods shift from Olympic Park to Midtown.',
  0
FROM venues v WHERE v.slug = 'polaris';

-- Six Feet Under
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'viewpoint', 'Graveyard-to-Skyline Panorama',
  'The rooftop patio overlooks Oakland Cemetery''s Victorian monuments with the downtown skyline rising directly behind the tombstones. 1850s gravestones against 2020s glass — peak Atlanta juxtaposition.',
  0
FROM venues v WHERE v.slug = 'six-feet-under';

-- Georgian Terrace Hotel
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'viewpoint', 'Fox Theatre Foreground Sightline',
  'The north-facing patio puts the Fox''s famous marquee in the foreground with the Midtown skyline rising behind it. The same view the Gone With the Wind premiere guests had in 1939.',
  0
FROM venues v WHERE v.slug = 'georgian-terrace-hotel';

-- Canoe
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'viewpoint', 'Chattahoochee Riverside Distance Shot',
  'From the riverside patio, downtown Atlanta''s towers appear as a distant cluster across miles of tree canopy. Best at twilight when the skyline glows orange against purple sky.',
  0
FROM venues v WHERE v.slug = 'canoe-vinings';

-- Glenn Hotel
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'viewpoint', 'Eye-Level With the Flatiron',
  'The 10th-floor terrace puts you at the same height as the 1897 Flatiron Building''s wedge point, with Bank of America Plaza towering behind it. Sunset turns the glass facades molten gold.',
  0
FROM venues v WHERE v.slug = 'glenn-hotel';

-- Westin Peachtree Plaza (lobby)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Seven-Story Glass Cylinder Atrium',
  'John Portman''s signature glass elevators rise 73 floors through a cylindrical atrium. Stand at ground level looking up — the vertigo is intentional and the perspective is dizzying.',
  0
FROM venues v WHERE v.slug = 'westin-peachtree-plaza';

-- Scofflaw Brewing rooftop
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'viewpoint', 'Westside Industrial Skyline Grit',
  'The open-air rooftop on Huff Road faces east toward downtown across warehouses, train yards, and cranes. Atlanta mid-transformation — half past, half future, beer in hand.',
  0
FROM venues v WHERE v.slug = 'scofflaw-brewing';

-- ============================================================
-- STREET ART & MURALS
-- ============================================================

-- Junkman's Daughter
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'Psychedelic Exterior Murals',
  'The entire storefront is a rotating canvas of local street artists. Bold colors, surreal imagery, and Atlanta iconography cover every surface. The building itself is the first exhibit.',
  0
FROM venues v WHERE v.slug = 'junkmans-daughter';

-- The Vortex L5P
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'photo_spot', 'The 18-Foot Laughing Skull',
  'The iconic grinning skull entrance has been Little Five''s most photographed landmark since 1992. Walk through the mouth into the bar — exactly as weird as it sounds.',
  0
FROM venues v WHERE v.slug = 'the-vortex-l5p';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'photo_spot', 'The 18-Foot Laughing Skull',
  'The iconic grinning skull entrance has been Little Five''s most photographed landmark since 1992. Walk through the mouth into the bar — exactly as weird as it sounds.',
  0
FROM venues v WHERE v.slug = 'vortex-little-five'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'The 18-Foot Laughing Skull');

-- The Drunken Unicorn
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'The Kaleidoscopic Exterior',
  'Every surface of the building is covered in rainbow-hued murals by rotating local artists. The purple-and-gold unicorn aesthetic is pure EAV fever dream — you hear the venue before you see it.',
  0
FROM venues v WHERE v.slug = 'the-drunken-unicorn';

-- Jackson Street Bridge — adding the Walking Dead angle
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'photo_spot', 'The Walking Dead Opening Shot',
  'The exact location of the iconic opening credits shot of Rick Grimes riding into abandoned Atlanta. Fans still recreate the photo daily. Best light at sunrise when the city wakes up behind you.',
  0
FROM venues v WHERE v.slug = 'jackson-street-bridge';

-- Underground Atlanta
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'The Viaduct Gallery Murals',
  'Original 1920s brick railroad viaducts now display commissioned murals depicting Atlanta''s rise from the ashes. The phoenix imagery and hidden Coca-Cola references reward close inspection.',
  0
FROM venues v WHERE v.slug = 'underground-atlanta';

-- Hammonds House Museum (adding to existing)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'The West End Guardian Mural',
  'Aniekan Udofia painted a commanding Harriet Tubman portrait on the museum''s west wall. Her eyes follow you as you walk past — locals call her the West End Guardian.',
  1
FROM venues v WHERE v.slug = 'hammonds-house-museum';

-- Sister Louisa's (adding exterior to existing interior highlight)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'Grant Henry''s Hellfire Exterior',
  'The building exterior is covered in Grant Henry''s folk-art devils and angels. Six-foot letters reading "Jesus Loves You But I''m His Favorite" — peak Church of the Living Room energy.',
  1
FROM venues v WHERE v.slug = 'sister-louisas-church';

-- ============================================================
-- WEIRD & HIDDEN ATLANTA
-- ============================================================

-- Manuel's Tavern
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'The Political Memorabilia Museum',
  'Every Democratic presidential campaign since 1956 is represented on the walls — buttons, bumper stickers, signed photos. Seven decades of liberal Atlanta politics preserved in a neighborhood bar.',
  0
FROM venues v WHERE v.slug = 'manuels-tavern';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Kennedy''s Impromptu 1960 Stop',
  'JFK held an unscheduled campaign meeting here in October 1960, weeks before beating Nixon. Owner Manuel Maloof became DeKalb County''s longest-serving CEO and kept the presidential booth intact.',
  1
FROM venues v WHERE v.slug = 'manuels-tavern';

-- Candler Park
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Forest Disc Golf Course',
  'A full 18-hole disc golf course weaves through hardwood forest that most park visitors never enter. Embedded metal baskets, cleared fairways, dedicated community — an invisible subculture.',
  0
FROM venues v WHERE v.slug = 'candler-park';

-- Underground Atlanta
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Atlanta''s Original Street Level',
  'In the 1920s, viaducts were built over the railroad gulch, burying the original street level. What''s underground now was once ground floor — storefronts, gas lamps, and all. You''re walking on the old ceiling.',
  1
FROM venues v WHERE v.slug = 'underground-atlanta';

-- Oakland Cemetery (adding to existing 3)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'The Confederate Lion',
  'A 65,000-pound marble lion imported from Italy in 1894 guards the Confederate soldiers'' section. Carved by T.M. Brady, its weathered mane and eastward battlefield gaze make it the cemetery''s most haunting sculpture.',
  3
FROM venues v WHERE v.slug = 'oakland-cemetery';

-- Euclid Avenue Yacht Club
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Landlocked Since 1986',
  'Named as a joke — the nearest ocean is 250 miles away. The ironic nautical name mocked Little Five Points'' pretensions during the ''80s gentrification battles. The dive bar energy won.',
  0
FROM venues v WHERE v.slug = 'euclid-avenue-yacht-club';

-- Georgia Aquarium (adding to existing 2)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Beluga Underwater Tunnel',
  'Most visitors watch belugas from above, but a lower-level acrylic tunnel lets you walk beneath them. The whales are curious — they follow people and press against the glass making eye contact.',
  2
FROM venues v WHERE v.slug = 'georgia-aquarium';

-- Krog Street Market (adding to existing 2)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Stove Works Factory Since 1889',
  'Originally the Atlanta Stove Works warehouse, supplying wood-burning stoves across the South. Cast-iron manufacturing remnants are still embedded in the concrete floors beneath the food stalls.',
  2
FROM venues v WHERE v.slug = 'krog-street-market';

-- Criminal Records (adding to existing 1)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Zine Archive Wall',
  'A massive wall of locally-made zines, indie comics, and self-published Atlanta art books that most people walk past to reach the vinyl. Forty years of DIY Atlanta culture that never made it to mainstream archives.',
  1
FROM venues v WHERE v.slug = 'criminal-records';

-- Southside Park (Summerhill)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Hank Aaron''s 715th Home Run Spot',
  'The park sits on the old Atlanta-Fulton County Stadium footprint. A monument marks the exact spot where Hank Aaron''s record-breaking 715th home run landed on April 8, 1974.',
  0
FROM venues v WHERE v.slug = 'southside-park';

-- ============================================================
-- HISTORICAL CALLOUTS
-- ============================================================

-- Georgian Terrace (adding to viewpoint)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Gone With the Wind Premiere Party',
  'The cast stayed here during the 1939 premiere. Clark Gable and Vivien Leigh greeted 300,000 fans from the hotel''s Peachtree Street balcony while segregation prevented Hattie McDaniel from attending.',
  1
FROM venues v WHERE v.slug = 'georgian-terrace-hotel';

-- Smith's Olde Bar
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Three Stages, One Building',
  'Three separate performance spaces stacked on top of each other — the main stage, the Atlanta Room upstairs, and the tiny downstairs dive. Acts have graduated from bottom to top over careers.',
  0
FROM venues v WHERE v.slug = 'smiths-olde-bar';

-- The Earl (adding to existing 2)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Former 1930s Gas Station',
  'Built as a Phillips 66 station in the 1930s. The original service bay doors were converted to roll-up windows, and vintage signage brackets are still visible on the exterior walls.',
  2
FROM venues v WHERE v.slug = 'the-earl';

-- Chastain Park Amphitheatre
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Picnic Concert Ritual',
  'Atlanta''s only major venue where bringing a full table setting — candelabra, wine, cheese boards — to a concert is not just allowed but expected. The natural bowl shape means no bad seats.',
  0
FROM venues v WHERE v.slug = 'chastain-park-amphitheatre';

-- Historic Fourth Ward Park (adding to existing 2)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Ponce de Leon Amusement Park Site',
  'This was the 1903 Ponce de Leon Amusement Park — Atlanta''s first theme park with a roller coaster and swimming pool. The current lake sits on roughly the same footprint as the original lagoon.',
  2
FROM venues v WHERE v.slug = 'historic-fourth-ward-park';

-- Rialto Center for the Arts
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', '1916 Beaux-Arts Movie Palace',
  'Originally the Rialto Theatre, one of Atlanta''s grand movie palaces. The ornate plasterwork ceiling, gilt trim, and proscenium arch survived decades of neglect before Georgia State''s restoration.',
  0
FROM venues v WHERE v.slug = 'rialto-center';

-- Theatrical Outfit
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'The Balzer Theater Conversion',
  'Performing inside a converted historic building in the Fairlie-Poplar district, Atlanta''s last intact block of Victorian-era commercial architecture. The intimacy of the space is the point.',
  0
FROM venues v WHERE v.slug = 'theatrical-outfit';

-- Actor's Express
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'The King Plow Arts Warehouse',
  'Performing inside a converted 1920s agricultural equipment factory in the King Plow Arts Center complex. Raw brick, exposed steel trusses, and industrial grit frame every production.',
  0
FROM venues v WHERE v.slug = 'actors-express';

-- Little Five Points (the neighborhood venue)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Five Streetcar Lines Converged Here',
  'Named for where five streetcar lines intersected in 1911. Atlanta''s first automobile suburb before it became the counterculture capital — the independent spirit has roots in transit.',
  0
FROM venues v WHERE v.slug = 'little-five-points';

-- Wild Heaven Beer
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'photo_spot', 'Interactive Angel Wings Wall',
  'Kelsey Montague''s signature interactive angel wings painted on the brewery''s exterior. Stand in the marked spot and the wings frame you from behind — the most recreated photo op in West End.',
  0
FROM venues v WHERE v.slug = 'wild-heaven-beer';

-- Helium Comedy Club
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Two-Drink Minimum Magic',
  'The national chain picked Atlanta for a reason — the comedy scene here punches above its weight. The intimate 200-seat room means every comic can see every face. Front row is dangerous.',
  0
FROM venues v WHERE v.slug = 'helium-comedy-club-atlanta';
