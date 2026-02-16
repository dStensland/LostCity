-- Venue highlights focused on explore track venues
-- Covers: Hip Hop Heritage, Civil Rights, Street Art, Weird Atlanta, Nature Escapes, BeltLine

-- ============================================================
-- HIP HOP HERITAGE — "The South Got Something to Say"
-- ============================================================

-- Trap Music Museum
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'The Escape Rooms',
  'Immersive hip hop-themed escape rooms recreating iconic Atlanta trap scenes — a recording studio, a trap house, a candy paint lowrider interior. Each room references specific lyrics and albums.',
  0
FROM venues v WHERE v.slug = 'trap-music-museum';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'photo_spot', 'The Gold Record Hallway',
  'A corridor lined with gold and platinum plaques from Atlanta trap artists. The sheer wall-to-wall density tells the story of how one city dominated an entire genre.',
  1
FROM venues v WHERE v.slug = 'trap-music-museum';

-- Magic City
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'The Monday Night A&R Office',
  'The strip club where Future, Jeezy, and Young Thug tested new music before release. Monday nights became the unofficial music industry showcase — if the dancers moved, the song was a hit.',
  0
FROM venues v WHERE v.slug = 'magic-city';

-- Lenox Square
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Where Andre Met Big Boi',
  'Andre 3000 and Big Boi met as students at Lenox Square in 1992. The mall appears in countless Atlanta rap lyrics and represents the aspirational aesthetic that defined the city''s sound.',
  0
FROM venues v WHERE v.slug = 'lenox-square';

-- Patchwerk Recording Studios
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Studio A''s Platinum Wall',
  'The control room where OutKast recorded Stankonia and T.I. cut Live Your Life. Walls hold 300+ gold and platinum plaques from every major Atlanta rap artist of the 2000s.',
  0
FROM venues v WHERE v.slug = 'patchwerk-recording-studios';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Studio A''s Platinum Wall',
  'The control room where OutKast recorded Stankonia and T.I. cut Live Your Life. Walls hold 300+ gold and platinum plaques from every major Atlanta rap artist of the 2000s.',
  0
FROM venues v WHERE v.slug = 'patchwerk-studios'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Studio A''s Platinum Wall');

-- Apache Cafe
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'The AWOL Open Mic Stage',
  'The stage where Atlanta''s early hip hop DJ culture thrived in the ''90s. AWOL open mic nights launched careers and defined Southern hip hop''s sound before the world caught on.',
  0
FROM venues v WHERE v.slug = 'apache-cafe';

-- Paschal's
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Back Room Strategy Table',
  'The original round table where MLK, John Lewis, and Andrew Young planned civil rights campaigns over fried chicken. The same back room later hosted the LaFace Records conversations that signed OutKast.',
  0
FROM venues v WHERE v.slug = 'paschals';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Back Room Strategy Table',
  'The original round table where MLK, John Lewis, and Andrew Young planned civil rights campaigns over fried chicken. The same back room later hosted the LaFace Records conversations that signed OutKast.',
  0
FROM venues v WHERE v.slug = 'paschal-s'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'The Back Room Strategy Table');

-- Vinyl Atlanta
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Local Hip Hop Crate',
  'A dedicated section for Atlanta hip hop vinyl — local pressings, mixtapes, and releases you won''t find on streaming. The staff can trace the city''s rap history through wax alone.',
  0
FROM venues v WHERE v.slug = 'vinyl-atlanta';

-- Wax N Facts
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Digging Since 1976',
  'One of Atlanta''s oldest record stores, open since the disco era. DJs from OutKast''s orbit dug here. The used vinyl basement is where the real finds hide.',
  0
FROM venues v WHERE v.slug = 'wax-n-facts';

-- Stankonia Studios
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'The Dungeon Family Birthplace',
  'OutKast''s private studio complex where Aquemini and Stankonia were born. The Dungeon Family collective — Goodie Mob, Killer Mike, Sleepy Brown — all recorded in these rooms.',
  0
FROM venues v WHERE v.slug = 'stankonia-studios';

-- The Clermont (hip hop angle — different from existing "1924 Hotel Basement" highlight)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Hip Hop After-Party Basement',
  'After arena shows, Atlanta rappers from OutKast to Ludacris wound up in this basement. The Clermont became hip hop lore — a place where fame meant nothing and the cover was five bucks.',
  1
FROM venues v WHERE v.slug = 'clermont-lounge';

-- ============================================================
-- CIVIL RIGHTS TRAIL — "Good Trouble"
-- ============================================================

-- APEX Museum
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'The Trolley Car Replica',
  'A recreated segregation-era Atlanta streetcar with the painted dividing line that separated white passengers from Black passengers. Seat wear patterns show how overcrowded the back section was.',
  0
FROM venues v WHERE v.slug = 'apex-museum';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Sweet Auburn District Timeline',
  'An immersive walk through the "richest Negro street in the world" — Auburn Avenue in its 1950s peak, when Black-owned banks, insurance companies, and nightclubs thrived under segregation.',
  1
FROM venues v WHERE v.slug = 'apex-museum';

-- Herndon Home Museum
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'The Beaux-Arts Staircase',
  'The grand staircase in Alonzo Herndon''s 1910 mansion — built by a man born into slavery who became Atlanta''s first Black millionaire. The intricate woodwork was carved by Black craftsmen.',
  0
FROM venues v WHERE v.slug = 'herndon-home-museum';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'The Beaux-Arts Staircase',
  'The grand staircase in Alonzo Herndon''s 1910 mansion — built by a man born into slavery who became Atlanta''s first Black millionaire. The intricate woodwork was carved by Black craftsmen.',
  0
FROM venues v WHERE v.slug = 'herndon-home'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'The Beaux-Arts Staircase');

-- Spelman College (adding civil rights angle to existing museum highlight)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'The 1960 Sit-In Organizers',
  'Spelman students organized some of the first Atlanta sit-ins in 1960, defying college administrators who feared losing donor funding. Sisters Chapel pews are where they planned.',
  1
FROM venues v WHERE v.slug = 'spelman-college';

-- Morehouse College
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'viewpoint', 'King Chapel Bell Tower',
  'The chapel where a young Martin Luther King Jr. studied theology. The tower view spans the entire Atlanta University Center campus where generations of civil rights leaders were educated.',
  0
FROM venues v WHERE v.slug = 'morehouse-college';

-- Clark Atlanta University
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'The Hale Woodruff Murals',
  'Hale Woodruff''s Amistad murals in Trevor Arnett Hall depict the 1839 slave ship revolt. These 1939 masterworks are considered among the most important African American murals in existence.',
  0
FROM venues v WHERE v.slug = 'clark-atlanta';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'The Hale Woodruff Murals',
  'Hale Woodruff''s Amistad murals in Trevor Arnett Hall depict the 1839 slave ship revolt. These 1939 masterworks are considered among the most important African American murals in existence.',
  0
FROM venues v WHERE v.slug = 'clark-atlanta-university'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'The Hale Woodruff Murals');

-- The King Center (beyond the NHP)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'The Eternal Flame and Reflecting Pool',
  'The flame has burned continuously since 1977. MLK and Coretta Scott King''s crypts rest on a raised platform in the reflecting pool — the geometry is designed so the sky is always visible in the water.',
  0
FROM venues v WHERE v.slug = 'king-center';

-- Busy Bee Cafe
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Soul Food Since 1947',
  'The oldest soul food restaurant in Atlanta, opened when the Westside was the center of Black business. Civil rights organizers ate here between marches. The fried chicken recipe hasn''t changed.',
  0
FROM venues v WHERE v.slug = 'busy-bee-cafe';

-- ============================================================
-- STREET ART & MURALS — "Hard in Da Paint"
-- ============================================================

-- Goat Farm Arts Center
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'The 1889 Cotton Gin Complex',
  'A sprawling 19th-century cotton gin and warehouse complex now housing 300+ artist studios, a blacksmith shop, and performance spaces. The crumbling brick and kudzu-wrapped buildings are art themselves.',
  0
FROM venues v WHERE v.slug = 'goat-farm-arts-center';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Outdoor Performance Ruins',
  'Roofless warehouse shells used for immersive theater, dance, and film screenings. The sky becomes the ceiling and the kudzu-covered walls become the set. Events are rarely announced publicly.',
  1
FROM venues v WHERE v.slug = 'goat-farm-arts-center';

-- Pullman Yards
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'The 1920s Rail Repair Sheds',
  'Massive industrial sheds where Pullman train cars were repaired, now used for immersive art exhibitions. The 60-foot ceilings and original rail tracks in the floor make any installation feel epic.',
  0
FROM venues v WHERE v.slug = 'pullman-yards';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'photo_spot', 'The Rust and Vine Exterior',
  'The exterior walls are a photographer''s dream — peeling paint, industrial rust, climbing vines, and original signage. Best light hits the south-facing wall around 4pm.',
  1
FROM venues v WHERE v.slug = 'pullman-yards';

-- Paris on Ponce
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Overwhelming Maximalist Warehouse',
  'Floor-to-ceiling taxidermy, chandeliers, medical equipment, religious statues, and European furniture stacked in chaotic piles. The sensory overload and dust-covered treasures are disorienting and beautiful.',
  0
FROM venues v WHERE v.slug = 'paris-on-ponce';

-- Whitespace Gallery
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'The Converted Industrial Loft',
  'A raw 4,500-square-foot former industrial space with polished concrete, exposed ductwork, and walls of natural light. The gallery''s minimal design lets the work breathe.',
  0
FROM venues v WHERE v.slug = 'whitespace-gallery';

-- BeltLine Eastside Trail (street art angle)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'The Forward Warrior Mural',
  'Greg Mike''s towering 50-foot geometric warrior near Irwin Street — bold colors, determined stance, greeting thousands of runners and cyclists daily. The most photographed mural on the BeltLine.',
  1
FROM venues v WHERE v.slug = 'beltline-eastside-trail';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'Living Walls Outdoor Gallery',
  'Murals from the annual Living Walls conference line the trail corridor — internationally known street artists given full building walls. New works appear each year.',
  2
FROM venues v WHERE v.slug = 'beltline-eastside-trail';

-- Krog Street Tunnel (adding more detail to existing landmark)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Unwritten Paint-Over Rule',
  'No permits, no curators — anyone can paint over anything. A work by a famous street artist might last a day or a year. Thursday mornings before crowds is when serious artists work.',
  0
FROM venues v WHERE v.slug = 'krog-street-tunnel';

-- Cabbagetown Murals (adding detail to existing landmark)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'The Wylie Street Portrait Series',
  'Large-scale photorealistic portraits of Atlanta cultural figures and Cabbagetown residents on Wylie Street walls. Each mural is commissioned through the neighborhood association.',
  0
FROM venues v WHERE v.slug = 'cabbagetown-murals';

-- Castleberry Hill Art District
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Second Friday Art Stroll Alleys',
  'The narrow service alleys between galleries fill with intimate murals, stencil work, and wheat-paste installations that most visitors miss. The best work is between the buildings, not inside them.',
  0
FROM venues v WHERE v.slug = 'castleberry-hill-art-district';

-- MODA (Museum of Design Atlanta)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Only Design Museum in the Southeast',
  'Tucked into a Midtown corner most people walk past. The exhibitions bridge architecture, industrial design, and fashion in ways traditional art museums don''t touch.',
  0
FROM venues v WHERE v.slug = 'museum-of-design-atlanta';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Only Design Museum in the Southeast',
  'Tucked into a Midtown corner most people walk past. The exhibitions bridge architecture, industrial design, and fashion in ways traditional art museums don''t touch.',
  0
FROM venues v WHERE v.slug = 'moda'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'The Only Design Museum in the Southeast');

-- ============================================================
-- WEIRD ATLANTA — "The Midnight Train"
-- ============================================================

-- Doll's Head Trail
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'The Found-Object Shrines',
  'Dozens of assemblage sculptures made from discarded dolls, appliances, and toys recovered from a former illegal dump site. Baby doll heads sprout from tree roots. Teddy bears watch from branches.',
  0
FROM venues v WHERE v.slug = 'doll-s-head-trail';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'nature', 'Constitution Lakes Wetland Recovery',
  'The trail loops through wetlands that were once an illegal dump — now home to beavers, river otters, and 150+ bird species. Five miles from downtown skyscrapers.',
  1
FROM venues v WHERE v.slug = 'doll-s-head-trail';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'The Found-Object Shrines',
  'Dozens of assemblage sculptures made from discarded dolls, appliances, and toys recovered from a former illegal dump site. Baby doll heads sprout from tree roots. Teddy bears watch from branches.',
  0
FROM venues v WHERE v.slug = 'constitution-lakes'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'The Found-Object Shrines');

-- Oddities Museum
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Medical Curiosities Collection',
  'Shrunken heads, Victorian mourning hair jewelry, antique surgical instruments, and taxidermy oddities. The "touch and feel" section lets you hold things most museums keep behind glass.',
  0
FROM venues v WHERE v.slug = 'oddities-museum';

-- Westview Cemetery
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'The Abbey Ruins',
  'A crumbling Gothic Revival abbey deep in the 582-acre grounds. Vines wrap the remaining walls, trees grow through the floor. Most Atlantans don''t know it exists.',
  0
FROM venues v WHERE v.slug = 'westview-cemetery';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Joel Chandler Harris''s Grave',
  'The Uncle Remus author is buried here alongside other Atlanta founders. The Victorian-era sections feel like walking through a museum of 19th-century funerary art.',
  1
FROM venues v WHERE v.slug = 'westview-cemetery';

-- Arabia Mountain
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'nature', 'Billion-Year-Old Granite Vernal Pools',
  'Shallow depressions in exposed granite fill with rain and host rare diamorpha wildflowers that turn the rock brilliant red each spring. These micro-ecosystems exist nowhere else in Georgia.',
  0
FROM venues v WHERE v.slug = 'arabia-mountain';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'photo_spot', 'The Alien Landscape',
  'Miles of bare granite monadnock that looks like another planet. No trees, no soil — just ancient rock, lichen, and sky. Twenty minutes from downtown.',
  1
FROM venues v WHERE v.slug = 'arabia-mountain';

-- Sope Creek Paper Mill Ruins
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Civil War Paper Mill Ruins',
  'Stone walls of a Confederate paper mill burned by Union troops in 1864, now overgrown with ferns and rhododendron along Sope Creek. Trees grow from what were factory floors.',
  0
FROM venues v WHERE v.slug = 'sope-creek-paper-mill-ruins';

-- Drepung Loseling Monastery
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Tibetan Temple in Suburban Atlanta',
  'A traditional Tibetan Buddhist monastery with ornate temple, prayer wheels, and monk residences tucked into suburban Brookhaven. Saffron robes against McMansions — cognitive dissonance as spiritual experience.',
  0
FROM venues v WHERE v.slug = 'drepung-loseling-monastery';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Public Meditation Sessions',
  'Open meditation sessions and dharma talks for anyone who shows up. No membership, no pressure. The temple interior is hand-painted in traditional Tibetan Buddhist motifs.',
  1
FROM venues v WHERE v.slug = 'drepung-loseling-monastery';

-- Star Bar
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'The Unexplained Elvis Shrine',
  'An entire corner dedicated to Elvis velvet paintings, commemorative plates, and devotional candles. Nobody remembers who started it. The punk bar treats it as sacred tradition.',
  0
FROM venues v WHERE v.slug = 'star-bar';

-- Jeju Sauna
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Themed Temperature Rooms',
  'Jade room, salt room, clay ball room, ice room — each at extreme temperatures for Korean wellness rituals. The communal culture and full-day stays shock first-timers from the drive-through city.',
  0
FROM venues v WHERE v.slug = 'jeju-sauna';

-- Plaza Theatre (adding weird angle to existing history highlight)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Saturday Midnight Rocky Horror',
  'Every Saturday at midnight since 1982. The same shadow cast performing in front of the screen, rice on the floor, audience callbacks. Over 40 years of committed weirdness.',
  1
FROM venues v WHERE v.slug = 'plaza-theatre';

-- The Varsity
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'World''s Largest Drive-In Since 1928',
  'The same "What''ll ya have?" counter call since 1928, serving 2 miles of hot dogs daily. The sprawling parking lot and neon signs are a time capsule of pre-interstate Atlanta.',
  0
FROM venues v WHERE v.slug = 'the-varsity';

-- Mary Mac's Tea Room
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'The Pot Likker Tradition',
  'Every table gets a complimentary cup of pot likker (the broth from cooking greens) with cornbread before the meal arrives. Serving Atlanta since 1945 without a break.',
  0
FROM venues v WHERE v.slug = 'mary-macs-tea-room';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'The Pot Likker Tradition',
  'Every table gets a complimentary cup of pot likker (the broth from cooking greens) with cornbread before the meal arrives. Serving Atlanta since 1945 without a break.',
  0
FROM venues v WHERE v.slug = 'mary-mac-s-tea-room'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'The Pot Likker Tradition');

-- ============================================================
-- NATURE ESCAPES — "City in a Forest"
-- ============================================================

-- Sweetwater Creek State Park
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Civil War Mill Ruins in the Rapids',
  'Brick walls of the New Manchester Mill, burned by Sherman''s troops in 1864, now overgrown with vines while Sweetwater Creek rushes through the collapsed structure.',
  0
FROM venues v WHERE v.slug = 'sweetwater-creek-state-park';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'nature', 'The Gorge Trail Rapids',
  'A rocky creek gorge with class II rapids just 20 minutes from downtown. The red trail follows the water through boulders and hardwood forest that feels hours from any city.',
  1
FROM venues v WHERE v.slug = 'sweetwater-creek-state-park';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Civil War Mill Ruins in the Rapids',
  'Brick walls of the New Manchester Mill, burned by Sherman''s troops in 1864, now overgrown with vines while Sweetwater Creek rushes through the collapsed structure.',
  0
FROM venues v WHERE v.slug = 'sweetwater-creek'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Civil War Mill Ruins in the Rapids');

-- Chattahoochee River NRA
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'nature', 'The Shoals and Oxbow Wetlands',
  'River shoals where you can wade across in summer and oxbow wetlands with blue herons, kingfishers, and egrets — all while metro Atlanta traffic hums in the distance.',
  0
FROM venues v WHERE v.slug = 'chattahoochee-river-national-recreation-area';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Tube and Float Access Points',
  'Locals float the Hooch on inner tubes from Powers Island to Paces Mill on summer weekends. The river is clean enough to swim in and cold enough to shock you.',
  1
FROM venues v WHERE v.slug = 'chattahoochee-river-national-recreation-area';

-- Westside Park / Bellwood Quarry
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'viewpoint', 'The Quarry Overlook',
  'A 280-acre park built around a flooded granite quarry with turquoise water. The overlook platforms give you views of a 200-foot-deep flooded canyon that supplied the stone for Atlanta''s early buildings.',
  0
FROM venues v WHERE v.slug = 'westside-park';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'viewpoint', 'The Quarry Overlook',
  'A 280-acre park built around a flooded granite quarry with turquoise water. The overlook platforms give you views of a 200-foot-deep flooded canyon that supplied the stone for Atlanta''s early buildings.',
  0
FROM venues v WHERE v.slug = 'bellwood-quarry'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'The Quarry Overlook');

-- Stone Mountain
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'nature', 'The Summit Scramble',
  'A mile-long walk up bare granite to a summit with 60-mile views of the North Georgia mountains. The exposed rock heats up in summer — go early or at sunset.',
  0
FROM venues v WHERE v.slug = 'stone-mountain-park';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'The Contested Carving',
  'The largest bas-relief sculpture in the world depicts three Confederate leaders. Originally proposed by the KKK in 1915, the carving is an ongoing civic debate about public memory and the Lost Cause.',
  1
FROM venues v WHERE v.slug = 'stone-mountain-park';

-- Cascade Springs Nature Preserve
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'nature', 'Hidden Urban Waterfall',
  'A 15-foot spring-fed waterfall inside Atlanta city limits, surrounded by ferns and moss-covered rocks. The sound of falling water blocks out traffic from the surrounding neighborhoods.',
  0
FROM venues v WHERE v.slug = 'cascade-springs-nature-preserve';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'nature', 'Hidden Urban Waterfall',
  'A 15-foot spring-fed waterfall inside Atlanta city limits, surrounded by ferns and moss-covered rocks. The sound of falling water blocks out traffic from the surrounding neighborhoods.',
  0
FROM venues v WHERE v.slug = 'cascade-springs'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Hidden Urban Waterfall');

-- Emory / Lullwater Preserve (add nature detail to existing Emory highlight)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Suspension Bridge',
  'A wooden suspension bridge over Lullwater Creek deep in the 154-acre preserve, swaying gently over clear water where freshwater mussels filter the current. Most Atlantans don''t know it exists.',
  1
FROM venues v WHERE v.slug = 'emory-university';

-- Fernbank Forest (standalone venue if it exists)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'nature', 'The Witness Trees',
  '200+ year-old tulip poplars and white oaks along elevated boardwalks. These trees predate Atlanta''s founding — the city grew around them and somehow they survived.',
  0
FROM venues v WHERE v.slug = 'fernbank-forest';

-- ============================================================
-- BELTLINE — "Keep Moving Forward"
-- ============================================================

-- Historic Fourth Ward Park (adding BeltLine context)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'nature', 'The Stormwater Pond Ecology',
  'An engineered pond that captures 50 million gallons of stormwater annually, transformed into urban wetland with turtles, dragonflies, and native plantings. Green infrastructure as public art.',
  1
FROM venues v WHERE v.slug = 'historic-fourth-ward-park';

-- World of Coca-Cola
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The International Tasting Room',
  'A room with 100+ Coca-Cola products from around the world on free-pour fountains. Beverly from Italy is famously terrible — trying it and making the face is the real attraction.',
  0
FROM venues v WHERE v.slug = 'world-of-coca-cola';

-- ============================================================
-- SPEAKEASY & COCKTAILS — "Say Less"
-- ============================================================

-- Red Phone Booth
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Phone Booth Entrance',
  'Dial the secret number on the vintage red phone booth and the back wall slides open. The ritual of entry is half the experience — if you don''t have the number, you''re not getting in.',
  0
FROM venues v WHERE v.slug = 'red-phone-booth';

-- JoJo's Beloved
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'photo_spot', 'The Disco Ball Room',
  'A mirrored room with a massive disco ball that fragments light across every surface. The most Instagram-photographed bar interior in Atlanta for a reason.',
  0
FROM venues v WHERE v.slug = 'jojo-s-beloved';

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'photo_spot', 'The Disco Ball Room',
  'A mirrored room with a massive disco ball that fragments light across every surface. The most Instagram-photographed bar interior in Atlanta for a reason.',
  0
FROM venues v WHERE v.slug = 'jojos-beloved'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'The Disco Ball Room');

-- ============================================================
-- SPORTS — "Keep Swinging"
-- ============================================================

-- Truist Park / The Battery
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Monument Garden',
  'A landscaped plaza with bronze statues of Braves legends — Hank Aaron''s swing, Chipper Jones''s stance, Phil Niekro''s knuckleball grip. The Aaron statue faces the exact trajectory of his 715th home run.',
  0
FROM venues v WHERE v.slug = 'truist-park';

-- ============================================================
-- FAMILY — "Life's Like a Movie"
-- ============================================================

-- Fernbank Science Center
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Free Planetarium Shows',
  'One of the largest planetariums in the country, and many shows are free. The dome theater predates most commercial IMAX experiences and still feels more immersive.',
  0
FROM venues v WHERE v.slug = 'fernbank-science-center';

-- Children's Museum of Atlanta
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'The Rooftop Play Area',
  'An outdoor rooftop space most families miss because it''s not on the main floor. Views of Centennial Olympic Park while kids play — parents'' secret escape.',
  0
FROM venues v WHERE v.slug = 'childrens-museum-of-atlanta';
