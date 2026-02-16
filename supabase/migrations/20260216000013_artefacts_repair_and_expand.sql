-- ============================================================================
-- Artefacts Repair + Expansion
--
-- Migration 000010 was recorded in schema_migrations but its transaction
-- rolled back — the parent_venue_id column wasn't created, so all INSERTs
-- failed. Migration 000012 added the column, but the 19 artifacts from
-- 000010 still don't exist. This migration:
--   1. Re-runs parent linking UPDATEs from 000010
--   2. Re-creates all 18 artifact INSERTs + Dr. Bombay's from 000010
--   3. Re-runs highlights from 000010
--   4. Maps recovered artifacts to the track (failed in 000011)
--   5. Adds NEW artifacts beyond 79
-- ============================================================================

-- ============================================================
-- 1. PARENT LINKING (from failed migration 000010)
-- ============================================================

UPDATE venues SET parent_venue_id = (SELECT id FROM venues WHERE slug = 'oakland-cemetery' LIMIT 1)
WHERE slug = 'bobby-jones-grave' AND parent_venue_id IS NULL;

UPDATE venues SET parent_venue_id = (SELECT id FROM venues WHERE slug = 'oakland-cemetery' LIMIT 1)
WHERE slug = 'jack-smith-armchair-statue' AND parent_venue_id IS NULL;

UPDATE venues SET parent_venue_id = (SELECT id FROM venues WHERE slug = 'atlanta-history-center' LIMIT 1)
WHERE slug = 'the-cyclorama' AND parent_venue_id IS NULL;

UPDATE venues SET parent_venue_id = (SELECT id FROM venues WHERE slug = 'underground-atlanta' LIMIT 1)
WHERE slug = 'zero-mile-post' AND parent_venue_id IS NULL;

UPDATE venues SET parent_venue_id = (SELECT id FROM venues WHERE slug = 'piedmont-park' LIMIT 1)
WHERE slug = 'noguchi-playscape' AND parent_venue_id IS NULL;

UPDATE venues SET parent_venue_id = (SELECT id FROM venues WHERE slug = 'piedmont-park' LIMIT 1)
WHERE slug = 'hoo-hoo-monument' AND parent_venue_id IS NULL;

UPDATE venues SET parent_venue_id = (SELECT id FROM venues WHERE slug = 'atlanta-fish-market' LIMIT 1)
WHERE slug = 'the-great-fish' AND parent_venue_id IS NULL;

UPDATE venues SET parent_venue_id = (SELECT id FROM venues WHERE slug = 'centennial-olympic-park' LIMIT 1)
WHERE slug = 'fountain-of-rings' AND parent_venue_id IS NULL;

UPDATE venues SET parent_venue_id = (SELECT id FROM venues WHERE slug = 'the-varsity' LIMIT 1)
WHERE slug = 'the-varsity-neon-sign' AND parent_venue_id IS NULL;

UPDATE venues SET parent_venue_id = (SELECT id FROM venues WHERE slug = 'oglethorpe-university' LIMIT 1)
WHERE slug = 'crypt-of-civilization' AND parent_venue_id IS NULL;

UPDATE venues SET parent_venue_id = (SELECT id FROM venues WHERE slug = 'constitution-lakes' LIMIT 1)
WHERE slug = 'dolls-head-trail' AND parent_venue_id IS NULL;

UPDATE venues SET parent_venue_id = (SELECT id FROM venues WHERE slug = 'world-of-coca-cola' LIMIT 1)
WHERE slug = 'pemberton-statue' AND parent_venue_id IS NULL;

UPDATE venues SET parent_venue_id = (SELECT id FROM venues WHERE slug = 'buckhead-library' LIMIT 1)
WHERE slug = 'the-storyteller-stag-man' AND parent_venue_id IS NULL;

-- ============================================================
-- 2. MISSING ARTIFACTS (from failed migration 000010)
-- ============================================================

-- Ramblin' Wreck -> Bobby Dodd Stadium
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT 'Ramblin'' Wreck', 'ramblin-wreck', 'artifact', 'Atlanta', 'GA', 'Midtown',
  33.7724, -84.3928,
  'A 1930 Ford Model A Sport Coupe that has served as Georgia Tech''s official mascot car since 1961. Before every home football game, the gold-and-white car leads the team onto the field at Bobby Dodd Stadium. Originally purchased for $1,000 by Dean George Griffin, the car has been stolen, stripped, and recovered multiple times over the decades. Students maintain it through the Ramblin'' Reck Club.',
  '1930 Ford Model A. GT''s mascot car since 1961. Leads the team onto the field.',
  true, 'landmarks_attractions',
  (SELECT id FROM venues WHERE slug = 'bobby-dodd-stadium' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'ramblin-wreck');

-- Coca-Cola Secret Recipe Vault -> World of Coca-Cola
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT 'Coca-Cola Secret Recipe Vault', 'coca-cola-vault', 'artifact', 'Atlanta', 'GA', 'Downtown',
  33.7626, -84.3927,
  'The vault containing Coca-Cola''s secret formula, moved here in 2011 from a SunTrust bank vault where it had been stored since 1925. You can see the massive vault door and peer through a window, but the actual recipe — written by John Pemberton in 1886 — remains locked inside. The formula is one of the most famous trade secrets in history, and allegedly only two Coca-Cola executives know it at any given time.',
  'The vault with Coca-Cola''s secret formula. You can see the door but not the recipe.',
  true, 'landmarks_attractions',
  (SELECT id FROM venues WHERE slug = 'world-of-coca-cola' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'coca-cola-vault');

-- Willie B Statue -> Zoo Atlanta
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT 'Willie B Statue', 'willie-b-statue', 'artifact', 'Atlanta', 'GA', 'Grant Park',
  33.7325, -84.3698,
  'A bronze statue of Willie B, the western lowland gorilla who lived at Zoo Atlanta for 39 years (1961-2000). Named after Mayor William B. Hartsfield, Willie B spent his first 27 years alone in a concrete enclosure with only a TV for company. After the zoo''s 1985 renovation, he moved to a natural habitat, discovered other gorillas, and eventually fathered five offspring. He became Atlanta''s most beloved animal and his death made national news.',
  'Bronze of Atlanta''s most famous gorilla. Lived at Zoo Atlanta for 39 years.',
  true, 'landmarks_attractions',
  (SELECT id FROM venues WHERE slug = 'zoo-atlanta' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'willie-b-statue');

-- 54 Columns (Sol LeWitt)
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT '54 Columns', '54-columns', 'artifact', 'Atlanta', 'GA', 'Old Fourth Ward',
  33.7623, -84.3625,
  'A public art installation by minimalist master Sol LeWitt: 54 concrete columns ranging from 10 to 20 feet tall, arranged in a triangular grid at the corner of Glen Iris Drive and North Highland Ave. Commissioned by the Fulton County Arts Council in 1999 and donated by the Taylor family with help from the High Museum. Art in America named it among the top public art projects of 2000. The columns mirror the Atlanta skyline. Renovated in 2024 into a landscaped pocket park.',
  '54 concrete columns by Sol LeWitt. Minimalist skyline in a pocket park.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = '54-columns');

-- Sideways the Dog's Grave -> Georgia Tech
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT 'Sideways the Dog''s Grave', 'sideways-the-dogs-grave', 'artifact', 'Atlanta', 'GA', 'Midtown',
  33.7714, -84.3933,
  'A plaque near the southeast corner of Tech Tower marks the grave of Sideways, a white terrier with a black eye patch who became Georgia Tech''s unofficial mascot after being thrown from a moving car on North Avenue in 1945. Surgeries saved her life but left her walking at a permanent angle — hence the name. She roamed from class to class and dorm to dorm until she died from eating rat poison. Her headstone is deliberately set at a tilt, just like she was. Students still leave pennies on it.',
  'Georgia Tech''s beloved crooked dog. Headstone set at a tilt, just like she walked.',
  true, 'hidden_gems',
  (SELECT id FROM venues WHERE slug = 'georgia-tech' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'sideways-the-dogs-grave');

-- Lord Dooley Statue -> Emory University
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT 'Lord Dooley Statue', 'lord-dooley-statue', 'artifact', 'Atlanta', 'GA', 'Druid Hills',
  33.7917, -84.3243,
  'An $80,000 bronze statue of Lord Dooley — a skeleton "descending from the sky," casting aside his skeleton suit to reveal that he really is a skeleton. Dooley has been Emory''s spirit since 1899, embodied each spring by a student in a skull mask and bone-painted sheet who roams campus with the power to cancel classes. The statue was unveiled at Homecoming 2008 on Asbury Circle.',
  '$80K bronze skeleton descending from the sky. Emory''s spirit since 1899.',
  true, 'hidden_gems',
  (SELECT id FROM venues WHERE slug = 'emory-university' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'lord-dooley-statue');

-- Anti-Gravity Monument -> Emory University
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT 'Anti-Gravity Monument', 'anti-gravity-monument', 'artifact', 'Atlanta', 'GA', 'Druid Hills',
  33.7907, -84.3253,
  'A rose-colored tombstone hidden on a wooded hillside near Emory''s Mathematics and Science Center, donated by millionaire Roger Babson — who hated gravity after it drowned his sister and grandson. Babson paid to erect tombstone-like monuments at colleges across America urging the defeat of gravity. The Gravity Research Foundation he founded in 1949 offered cash prizes for anti-gravity essays. This is one of the last surviving monuments.',
  'A tombstone urging the defeat of gravity. Donated by a millionaire who hated it.',
  true, 'hidden_gems',
  (SELECT id FROM venues WHERE slug = 'emory-university' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'anti-gravity-monument');

-- Fiddlin' John Carson's Grave
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Fiddlin'' John Carson''s Grave', 'fiddlin-john-carsons-grave', 'artifact', 'Atlanta', 'GA', 'East Atlanta',
  33.7392, -84.3495,
  'The gravestone of Fiddlin'' John Carson at Sylvester Cemetery — the man who made the first commercially successful country music recording in 1923. His headstone features a carved image of Carson fiddling with his foot propped on an outline of Georgia. A gravel lane named for him leads visitors to the family plot. Before him, record labels didn''t think Southern rural music would sell. He proved them wrong and changed American music forever.',
  'Grave of the man who invented recorded country music. Headstone shows him fiddling.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'fiddlin-john-carsons-grave');

-- Hank Aaron Home Run Wall
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Hank Aaron Home Run Wall', 'hank-aaron-home-run-wall', 'artifact', 'Atlanta', 'GA', 'Summerhill',
  33.7350, -84.3894,
  'The actual section of outfield wall over which Hank Aaron hit home run #715 on April 8, 1974 — the swing that broke Babe Ruth''s all-time record. The wall segment was preserved and reinstalled at its original location (521 Capitol Ave SE) when the old Atlanta-Fulton County Stadium was demolished. A monument marks the exact spot where the ball cleared. Aaron did it despite receiving death threats and racist hate mail throughout the chase.',
  'The actual wall Hank Aaron''s record-breaking HR #715 cleared. April 8, 1974.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'hank-aaron-home-run-wall');

-- Kermit the Frog Chaplin Statue -> Center for Puppetry Arts
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT 'Kermit the Frog Chaplin Statue', 'kermit-chaplin-statue', 'artifact', 'Atlanta', 'GA', 'Midtown',
  33.7910, -84.3878,
  'A 12-foot bronze statue of Kermit the Frog dressed as Charlie Chaplin''s The Little Tramp — top hat, cane, baggy pants. Originally installed at Jim Henson Studios in Hollywood in 2000, it was gifted to Atlanta''s Center for Puppetry Arts by the Henson family in late 2025. Kermit himself (with Jim Henson performing) cut the ribbon at the Center''s opening in 1978. The Center houses the world''s largest collection of Henson puppets, including original Muppets, Fraggles, and Sesame Street characters.',
  '12-foot Kermit dressed as Charlie Chaplin. Gifted by the Henson family in 2025.',
  true, 'landmarks_attractions',
  (SELECT id FROM venues WHERE slug = 'center-for-puppetry-arts' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'kermit-chaplin-statue');

-- Spirit of Delta -> Delta Flight Museum
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT 'The Spirit of Delta', 'spirit-of-delta', 'artifact', 'Atlanta', 'GA', 'Hapeville',
  33.6418, -84.4279,
  'A Boeing 767-200 bought by Delta employees and donated to the airline in 1982 — over 7,000 employees pooled their own money to buy their company a plane. Christened "The Spirit of Delta," Ship 102 flew as an ambassador of employee pride for 23 years, wore special Olympic livery in 1996, and was retired in 2006 after 70,697 flight hours. It was towed across two public roads from the maintenance hangar to the museum. The cockpit and first-class cabin remain intact.',
  'A Boeing 767 bought by employees for their own airline. 70,697 flight hours.',
  true, 'landmarks_attractions',
  (SELECT id FROM venues WHERE slug = 'delta-flight-museum' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'spirit-of-delta');

-- One-Person Jail Cell
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'One-Person Jail Cell', 'one-person-jail-cell', 'artifact', 'Atlanta', 'GA', 'Inman Park',
  33.7575, -84.3535,
  'Atlanta''s last surviving one-person police lockup box, tucked in Delta Park at the corner of Edgewood Avenue and Delta Place. Built between 1890 and 1905, these phone-booth-sized iron cells held one prisoner standing up while the officer waited for the horse-drawn patrol wagon. When empty, cops stored their helmets, nightsticks, and raincoats inside. Atlanta had at least four across the city; this is the only one left. Restored and returned to its original location in 1974.',
  'Last surviving 1890s police lockup box. Room for one prisoner, standing.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'one-person-jail-cell');

-- Adalanta Desert Plaque
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Adalanta Desert Plaque', 'adalanta-desert-plaque', 'artifact', 'Atlanta', 'GA', 'Westside',
  33.8085, -84.4107,
  'A bronze plaque at Westside Provisions that honors events from a parallel universe where Atlanta is a searing desert called "Adalanta," crossed by great sphaltways built by Martha Pelaski''s trading post. Part of Kcymaerxthaere — a global art project by Eames Demetrios (grandson of Charles Eames) installing plaques in 30+ countries commemorating the history of an alternate Earth. Look near Forza Storico or the metal staircase by Jeni''s Ice Cream.',
  'Plaque honoring events from a parallel universe where Atlanta is a desert.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'adalanta-desert-plaque');

-- Elvis Shrine Vault
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Elvis Shrine Vault', 'elvis-shrine-vault', 'artifact', 'Atlanta', 'GA', 'Little Five Points',
  33.7645, -84.3490,
  'A bank vault in the basement of the old Clermont-Midtown Bank building — now Star Community Bar — repurposed as an eternal shrine to Elvis Presley. The original vault door and locking mechanisms are still intact. Inside: safety deposit boxes filled with Elvis memorabilia, a velvet "throne," and walls covered in tributes to The King. The bar hosts punk and metal shows upstairs while Elvis rests in peace below.',
  'Bank vault turned Elvis shrine. Original vault door, safety deposit boxes, velvet throne.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'elvis-shrine-vault');

-- 1895 Exposition Steps -> Piedmont Park
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT '1895 Exposition Steps', '1895-exposition-steps', 'artifact', 'Atlanta', 'GA', 'Midtown',
  33.7830, -84.3725,
  'The last physical remnants of the 1895 Cotton States and International Exposition — a world''s fair that drew nearly 800,000 visitors and put Atlanta on the international map. These stone steps once led to the exposition''s grand buildings. Booker T. Washington delivered his famous "Atlanta Compromise" speech here. The Olmsted Brothers later transformed the fairgrounds into Piedmont Park, but these steps survive as silent witnesses.',
  'Last remnant of the 1895 World''s Fair where Booker T. Washington spoke.',
  true, 'landmarks_attractions',
  (SELECT id FROM venues WHERE slug = 'piedmont-park' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = '1895-exposition-steps');

-- 2 Chainz's Pink Chevy -> Trap Music Museum
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT '2 Chainz''s Pink Chevy', 'pink-trap-house-chevy', 'artifact', 'Atlanta', 'GA', 'Westside',
  33.7718, -84.4086,
  'The bright pink 1970s Chevrolet from 2 Chainz''s infamous Pink Trap House — the pop-up on Howell Mill Road that broke the internet in 2017 when he painted a rental house pink to promote "Pretty Girls Like Trap Music." The original car had to be towed after fans kept jumping on it. Now displayed inside T.I.''s Trap Music Museum alongside Jeezy''s cocaine snowman and T.I.''s Grammy. Staff still have to remind visitors: do not stand on the car.',
  'The pink Chevy from the Pink Trap House. Staff rule: do not stand on the car.',
  true, 'hidden_gems',
  (SELECT id FROM venues WHERE slug = 'trap-music-museum' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'pink-trap-house-chevy');

-- The Confessional Photobooth -> Sister Louisa's
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT 'The Confessional Photobooth', 'confessional-photobooth', 'artifact', 'Atlanta', 'GA', 'Old Fourth Ward',
  33.7556, -84.3714,
  'A retrofitted church confessional repurposed as a photobooth inside Sister Louisa''s Church of the Living Room & Ping Pong Emporium on Edgewood Avenue. Step in, close the curtain, and take your portrait where sinners once whispered. Part of Grant Henry''s church-themed fever dream that also includes an organ for live karaoke, complimentary choir robes for patrons, walls covered floor-to-ceiling in satirical religious paintings, and a ping pong table.',
  'Church confessional turned photobooth. Step in where sinners once whispered.',
  true, 'hidden_gems',
  (SELECT id FROM venues WHERE slug = 'sister-louisas-church' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'confessional-photobooth');

-- Fulton Bag Mill Smokestacks
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Fulton Bag Mill Smokestacks', 'fulton-bag-mill-smokestacks', 'artifact', 'Atlanta', 'GA', 'Cabbagetown',
  33.7490, -84.3625,
  'The twin smokestacks of the Fulton Bag and Cotton Mills — still standing since 1881, now rising above the loft condos named after them ("The Stacks"). Jacob Elsas, a German Jewish immigrant, built the mill on the ruins of the Atlanta Rolling Mill that Sherman burned in 1864. By the early 1900s it was one of the largest cotton mills in the South, employing the entire neighborhood of Cabbagetown. The mill closed in the 1970s, was converted to lofts in 1995 in one of the biggest loft conversions in the US, but the smokestacks remain — industrial ghosts watching over the BeltLine.',
  'Twin 1881 cotton mill smokestacks. The "Stacks" that named the neighborhood.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'fulton-bag-mill-smokestacks');

-- Owl Rock
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Owl Rock', 'owl-rock', 'artifact', 'Atlanta', 'GA', 'Southwest Atlanta',
  33.6890, -84.5075,
  'An eight-foot-tall boulder carved with an owl''s eye by Creek nation artisans in the 16th century, hidden inside the cemetery of the Owl Rock United Methodist Church at 5880 Campbellton Road. Before Atlanta existed, members of the Creek nation settled along the Chattahoochee at a town called Oktahatalofa — Sandtown. This boulder served as a trail marker at the entrance to the town. It is one of the oldest surviving human-made marks in the Atlanta metro area. The church cemetery gate is unlocked for visitors.',
  '16th-century Creek nation carving on an 8-foot boulder. Hidden in a church cemetery.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'owl-rock');

-- Dr. Bombay's Underwater Tea Party
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, website, active, explore_category)
SELECT 'Dr. Bombay''s Underwater Tea Party', 'dr-bombays-underwater-tea-party', 'coffee_shop', 'Atlanta', 'GA', 'Grant Park',
  33.7337, -84.3700,
  'A whimsical, book-lined tea room across from Zoo Atlanta in Grant Park, behind a weathered door. Tiered trays of pastries arrive with pots of Darjeeling while vintage furniture and thousands of books create a world that feels like falling through a looking glass. Owner Katrell Christie runs The Learning Tea — a significant portion of sales fund housing and education for young women in Darjeeling, India. Relocated from Candler Park in 2025 after 20 years.',
  'Book-lined tea room behind a weathered door. Sales fund women''s education in India.',
  'https://www.drbombays.com/',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'dr-bombays-underwater-tea-party');

-- ============================================================
-- 3. HIGHLIGHTS (from failed migration 000010)
-- ============================================================

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Stolen Multiple Times',
  'The car has been stolen by rival schools and pranksters several times. In 1963, Auburn fans stole it during a game. The Ramblin'' Reck Club now guards it 24/7 during rivalry weeks.',
  0
FROM venues v WHERE v.slug = 'ramblin-wreck'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Stolen Multiple Times');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Only Two People Know',
  'According to Coca-Cola legend, only two executives know the complete formula at any time, and they are never allowed to fly on the same airplane.',
  0
FROM venues v WHERE v.slug = 'coca-cola-vault'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Only Two People Know');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', '27 Years Alone',
  'Willie B spent his first 27 years in a concrete and tile enclosure with nothing but a television. After the zoo''s renovation in the late 1980s, he finally met other gorillas and fathered five offspring.',
  0
FROM venues v WHERE v.slug = 'willie-b-statue'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = '27 Years Alone');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Tilted on Purpose',
  'Her headstone is deliberately set at an angle, matching the permanent tilt she walked with after her injuries. Students still place pennies on it.',
  0
FROM venues v WHERE v.slug = 'sideways-the-dogs-grave'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Tilted on Purpose');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Can Cancel Classes',
  'Each spring, a student dressed as Dooley roams campus with a squirt gun. If Dooley "shoots" a professor, the class is officially cancelled. Faculty cannot refuse.',
  0
FROM venues v WHERE v.slug = 'lord-dooley-statue'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Can Cancel Classes');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Despite Death Threats',
  'Aaron received an estimated 930,000 letters during the chase — more mail than any non-politician in America. Many were death threats. He needed a bodyguard and couldn''t stay in the same hotels as his teammates.',
  0
FROM venues v WHERE v.slug = 'hank-aaron-home-run-wall'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Despite Death Threats');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'From Hollywood to Atlanta',
  'The statue stood at Jim Henson Studios in Hollywood for 25 years. When the Henson family decided to move it, they chose Atlanta — because Kermit himself opened the Center for Puppetry Arts in 1978.',
  0
FROM venues v WHERE v.slug = 'kermit-chaplin-statue'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'From Hollywood to Atlanta');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Employees Bought Their Company a Plane',
  'Three Delta flight attendants launched "Project 767" — rallying over 7,000 employees and retirees to pool their own money and buy the airline a brand-new Boeing 767. Nothing like it has happened before or since.',
  0
FROM venues v WHERE v.slug = 'spirit-of-delta'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Employees Bought Their Company a Plane');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Also a Coat Closet',
  'When no prisoner occupied the cell, officers used it to store helmets, nightsticks, raincoats, and gear. A dual-purpose iron phone booth.',
  0
FROM venues v WHERE v.slug = 'one-person-jail-cell'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Also a Coat Closet');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Older Than Atlanta',
  'This carving predates the city of Atlanta by roughly 300 years. It marks the entrance to Oktahatalofa (Sandtown), a Creek settlement along the Chattahoochee. One of the oldest human-made marks in the metro area.',
  0
FROM venues v WHERE v.slug = 'owl-rock'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Older Than Atlanta');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'We Brew Scholars',
  'A portion of every cup of tea funds The Learning Tea — housing and educational scholarships for young women in Darjeeling, India. Founded by owner Katrell Christie.',
  0
FROM venues v WHERE v.slug = 'dr-bombays-underwater-tea-party'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'We Brew Scholars');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Sherman Burned What Came Before',
  'The mill was built on the ruins of the Atlanta Rolling Mill, which forged Confederate railroad track and artillery until Sherman''s troops destroyed it in 1864. Elsas built his cotton mill on the ashes.',
  0
FROM venues v WHERE v.slug = 'fulton-bag-mill-smokestacks'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Sherman Burned What Came Before');

-- ============================================================
-- 4. NEW ARTIFACTS (beyond 79)
-- ============================================================

-- Merci Boxcar — Kennesaw (at Southern Museum)
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Merci Boxcar', 'merci-boxcar', 'artifact', 'Kennesaw', 'GA', 'Kennesaw',
  34.0238, -84.6160,
  'One of 49 French boxcars — one for each state plus DC — gifted to America in 1949 as a "Merci Train" thank-you for the 700+ boxcars of food and supplies Americans sent France after World War II. Each boxcar was filled with personal gifts from French citizens: dolls, war medals, letters, wedding dresses. Georgia''s boxcar sits near the Southern Museum in Kennesaw. These "40-and-8" boxcars — designed to hold 40 men or 8 horses — also carried soldiers to the front in both world wars.',
  'French WWII gratitude boxcar. One of 49 gifted to America, packed with personal thank-you gifts.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'merci-boxcar');

-- W.W. King Covered Bridge — Stone Mountain Park
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT 'W.W. King Covered Bridge', 'ww-king-covered-bridge', 'artifact', 'Stone Mountain', 'GA', 'Stone Mountain',
  33.8050, -84.1550,
  'A covered bridge inside Stone Mountain Park built in 1891 by Horace King''s son, Washington W. King. Horace King was born enslaved, became the most famous bridge builder in the antebellum South, and was freed by an act of the Alabama legislature. He built bridges across Georgia, Alabama, and Mississippi. After emancipation, he served in the Alabama House of Representatives. His son W.W. continued the family trade. This bridge was relocated to Stone Mountain Park in 1965.',
  'Built 1891 by the son of the South''s most famous bridge builder — a formerly enslaved man.',
  true, 'hidden_gems',
  (SELECT id FROM venues WHERE slug = 'stone-mountain-park' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'ww-king-covered-bridge');

-- FDR's Railcar — Southeastern Railway Museum
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT 'FDR''s Superb Railcar', 'fdr-superb-railcar', 'artifact', 'Duluth', 'GA', 'Duluth',
  34.0025, -84.1375,
  'The "Superb" — a 1911 Pullman private railcar used by President Franklin D. Roosevelt on his trips between Washington and Warm Springs, Georgia, where he sought treatment for polio. The mahogany-paneled car features a fully equipped kitchen, sleeping quarters, and an observation lounge. FDR died in Warm Springs in 1945 and his body was transported back to Washington by train. The car is remarkably intact, with original brass fittings and stained glass.',
  'FDR''s personal Pullman railcar. Mahogany, brass, stained glass. Rode it to Warm Springs.',
  true, 'landmarks_attractions',
  (SELECT id FROM venues WHERE slug = 'southeastern-railway-museum' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'fdr-superb-railcar');

-- Stone Mountain Grist Mill
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT 'Stone Mountain Grist Mill', 'stone-mountain-grist-mill', 'artifact', 'Stone Mountain', 'GA', 'Stone Mountain',
  33.8085, -84.1495,
  'An operating 1869 grist mill inside Stone Mountain Park, relocated here from Ellijay, Georgia. The water-powered mill still grinds corn into meal and grits using the original granite millstones. Visitors can watch the wooden gears turn and buy fresh-ground cornmeal. The mill sits on a creek with a working waterwheel — one of the last functioning grist mills in Georgia.',
  'Working 1869 water-powered grist mill. Still grinding corn with original granite stones.',
  true, 'hidden_gems',
  (SELECT id FROM venues WHERE slug = 'stone-mountain-park' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'stone-mountain-grist-mill');

-- Cascade Springs Nature Preserve Earthworks
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Cascade Springs Earthworks', 'cascade-springs-earthworks', 'artifact', 'Atlanta', 'GA', 'Cascade Heights',
  33.7119, -84.4606,
  'Civil War earthworks hidden in the woods of Cascade Springs Nature Preserve — trenches and berms dug by Confederate soldiers during the Battle of Utoy Creek in August 1864. The engagement was one of the last Confederate victories before the fall of Atlanta. The earthworks are remarkably well-preserved, winding through a forest that has grown up around them over 160 years. Most visitors come for the springs and waterfall and never realize they''re walking through a battlefield.',
  'Hidden Civil War trenches in a nature preserve. Most visitors walk right past them.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'cascade-springs-earthworks');

-- The Dump — Margaret Mitchell's apartment (restored)
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT 'The Dump Apartment', 'the-dump-apartment', 'artifact', 'Atlanta', 'GA', 'Midtown',
  33.7812, -84.3841,
  'The cramped ground-floor apartment Margaret Mitchell and husband John Marsh rented in 1925 — which she lovingly called "The Dump." This is where she wrote the entirety of Gone with the Wind over 10 years, starting the last chapter first. The building at 10th and Peachtree was nearly demolished, survived two arson fires, and was finally restored as part of the Margaret Mitchell House museum. The tiny writing desk, typewriter, and the room''s dimensions show just how modest the birthplace of the best-selling American novel really was.',
  'The cramped apartment where Mitchell wrote all of Gone with the Wind. She called it "The Dump."',
  true, 'hidden_gems',
  (SELECT id FROM venues WHERE slug = 'margaret-mitchell-house' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'the-dump-apartment');

-- Maynard Jackson's Grave — Oakland Cemetery
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT 'Maynard Jackson''s Grave', 'maynard-jacksons-grave', 'artifact', 'Atlanta', 'GA', 'Grant Park',
  33.7487, -84.3710,
  'The grave of Maynard Holbrook Jackson Jr. — Atlanta''s first Black mayor (1974-1982, 1990-1994) — at Oakland Cemetery. Jackson transformed the city: he ensured that Black-owned businesses got a fair share of contracts to build Hartsfield-Jackson Airport, which became the world''s busiest. He was 35 when elected, the youngest mayor of a major Southern city. The airport that bears his name moves 93 million passengers a year. He''s buried near Margaret Mitchell.',
  'Atlanta''s first Black mayor. Built the world''s busiest airport. Buried near Margaret Mitchell.',
  true, 'landmarks_attractions',
  (SELECT id FROM venues WHERE slug = 'oakland-cemetery' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'maynard-jacksons-grave');

-- The Waving Girl Statue homage — not in Atlanta but Southeastern connection
-- Let's do something better: the actual Atlanta pieces

-- East Atlanta Village Totem Pole
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'East Atlanta Village Totem Pole', 'eav-totem-pole', 'artifact', 'Atlanta', 'GA', 'East Atlanta',
  33.7401, -84.3489,
  'A 30-foot hand-carved totem pole rising from the sidewalk on Flat Shoals Avenue in East Atlanta Village — created by local chainsaw artist Randy Mercer from a dead tree that the city was about to remove. Instead of a stump, the neighborhood got a neighborhood monument: faces, animals, and figures spiraling up the trunk. It''s unofficial public art that the city decided to keep. A totemic landmark for one of Atlanta''s weirdest neighborhoods.',
  '30-foot chainsaw-carved totem pole. Made from a dead tree the city was about to remove.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'eav-totem-pole');

-- The Clermont Lounge (legendary dive bar, artifact of old Atlanta)
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'The Clermont Lounge', 'the-clermont-lounge', 'artifact', 'Atlanta', 'GA', 'Poncey-Highland',
  33.7690, -84.3533,
  'The oldest strip club in Atlanta, operating since 1965 in the basement of the Clermont Hotel. Famous for performers like Blondie, who crushes beer cans with her chest. Anthony Bourdain called it his favorite bar in Atlanta. REM, the Black Keys, and every touring band that plays Atlanta ends up here at 2 AM. When developers bought the Clermont Hotel and converted it to a boutique hotel in 2018, they kept the lounge exactly as it was — smoke-stained ceiling, sticky floors, and all. The last true dive in a city of rooftop bars.',
  'Atlanta''s oldest strip club. Since 1965. Bourdain''s favorite. Kept as-is when the hotel went boutique.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'the-clermont-lounge');

-- The Buford Highway International Corridor sign
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Buford Highway International Corridor', 'buford-highway-corridor', 'artifact', 'Chamblee', 'GA', 'Buford Highway',
  33.8750, -84.2950,
  'A 20-mile stretch of highway that is the most ethnically diverse food corridor in America. Vietnamese, Korean, Chinese, Salvadoran, Mexican, Ethiopian, Bangladeshi, Burmese, and Nepali restaurants line both sides — most in strip malls with no English signage. The corridor formed organically as immigrants settled along cheap commercial real estate in the 1980s and 90s. Anthony Bourdain, Andrew Zimmern, and every food journalist in America has called it one of the great food streets in the world.',
  'America''s most diverse food corridor. 20 miles. 30+ cuisines. Mostly no English signage.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'buford-highway-corridor');

-- Atlanta's Bridge Over Nothing (Freedom Parkway)
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'The Bridge Over Nothing', 'bridge-over-nothing', 'artifact', 'Atlanta', 'GA', 'Old Fourth Ward',
  33.7630, -84.3685,
  'A highway bridge on Freedom Parkway that crosses over... nothing. No road beneath it, no river, no railroad. The bridge was built in the 1960s as part of the proposed Stone Mountain Freeway (I-485) that was to cut through the city. Community activists — led by future President Jimmy Carter''s neighborhood — killed the highway project, but this orphaned bridge section had already been built. The city paved a path underneath it instead. It''s a monument to the highway revolt that saved Atlanta''s neighborhoods.',
  'A highway bridge that crosses over nothing. Monument to the revolt that stopped a freeway.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'bridge-over-nothing');

-- Dahlonega Gold Museum
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Dahlonega Gold Museum', 'dahlonega-gold-museum', 'artifact', 'Dahlonega', 'GA', 'Dahlonega',
  34.5328, -83.9848,
  'Inside the oldest courthouse in Georgia (1836), this museum sits at the epicenter of the first American gold rush — which happened in Georgia in 1828, two decades before California. The U.S. government built a mint here. So much gold was found that the dome of the Georgia State Capitol is gilded with Dahlonega gold. The Cherokee were forcibly removed from these mountains on the Trail of Tears to make way for gold miners. "Dahlonega" is the anglicized Cherokee word for "yellow."',
  'Site of the first American gold rush. 1828. The name is Cherokee for "yellow."',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'dahlonega-gold-museum');

-- The Battery at Truist Park (Hank Aaron statue)
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Hank Aaron Statue', 'hank-aaron-statue', 'artifact', 'Atlanta', 'GA', 'Cobb County',
  33.8907, -84.4680,
  'A 9-foot bronze statue of Henry "Hank" Aaron in his iconic home run follow-through at Truist Park — alongside statues of other Braves legends. Aaron hit 755 home runs over 23 seasons, a record that stood for 33 years. The statue was moved from Turner Field to the new ballpark in 2017. His uniform number 44 is retired across all of Major League Baseball. He was born in Mobile, Alabama and told his mother he''d be in the big leagues — she didn''t believe him.',
  '9-foot bronze of the home run king mid-swing. Number 44 retired across all of baseball.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'hank-aaron-statue');

-- ============================================================
-- 5. HIGHLIGHTS on new expansion artifacts
-- ============================================================

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Packed by French Families',
  'Each boxcar was filled with personal thank-you gifts from ordinary French citizens: handmade dolls, pressed flowers, letters, war medals, lace, even a Legion of Honor ribbon. Every item was chosen by a family who remembered what American aid meant.',
  0
FROM venues v WHERE v.slug = 'merci-boxcar'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Packed by French Families');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Born Enslaved, Built the South',
  'Horace King was born enslaved in 1807. He became the most sought-after bridge builder in the antebellum South, and the Alabama legislature passed a special act to free him. After the Civil War, he served in the Alabama House of Representatives.',
  0
FROM venues v WHERE v.slug = 'ww-king-covered-bridge'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Born Enslaved, Built the South');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Still Grinds Corn',
  'The mill still operates on water power, grinding corn into meal and grits using the original 1869 granite millstones. You can buy a bag of fresh-ground cornmeal on site.',
  0
FROM venues v WHERE v.slug = 'stone-mountain-grist-mill'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Still Grinds Corn');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Started Last Chapter First',
  'Mitchell wrote the last chapter of Gone with the Wind first, then worked backwards. She stored manuscript pages in towering stacks around the tiny apartment. A visiting editor discovered the pile in 1935.',
  0
FROM venues v WHERE v.slug = 'the-dump-apartment'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Started Last Chapter First');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Youngest Mayor, Biggest Airport',
  'Jackson was 35 when elected — youngest mayor of a major Southern city. He made the airport the world''s busiest by insisting that minority-owned firms get 25% of construction contracts. The airport handles 93 million passengers a year.',
  0
FROM venues v WHERE v.slug = 'maynard-jacksons-grave'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Youngest Mayor, Biggest Airport');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Before California',
  'The Georgia Gold Rush of 1828 predates California''s by 21 years. It brought 15,000 miners to Cherokee land. The Trail of Tears followed. The gold on the Georgia Capitol dome came from these mountains.',
  0
FROM venues v WHERE v.slug = 'dahlonega-gold-museum'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Before California');

-- ============================================================
-- 6. MAP RECOVERED ARTIFACTS TO TRACK (failed in migration 000011)
-- ============================================================

DO $$
DECLARE
  v_track_id UUID;
  v_venue_id INT;
  v_max_sort INT;
BEGIN
  SELECT id INTO v_track_id FROM explore_tracks WHERE slug = 'artefacts-of-the-lost-city';
  IF v_track_id IS NULL THEN
    RAISE NOTICE 'Track not found, skipping';
    RETURN;
  END IF;

  -- Get current max sort order
  SELECT COALESCE(MAX(sort_order), 0) INTO v_max_sort
  FROM explore_track_venues WHERE track_id = v_track_id;

  -- Recovered artifacts from migration 000010 (attempted in 000011 but slugs didn't exist)

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'ramblin-wreck' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      '1930 Ford Model A. Georgia Tech''s golden mascot car since 1961. Stolen by rival schools multiple times. The Reck Club guards it 24/7 during rivalry weeks.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'coca-cola-vault' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, TRUE, 'approved',
      'The vault with Coca-Cola''s secret formula. Moved from a SunTrust bank vault in 2011. Only two executives know it. They can''t fly on the same plane.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'willie-b-statue' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      'Bronze of the gorilla who spent 27 years alone with a TV. Named after the mayor. Fathered five kids once he finally met other gorillas.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = '54-columns' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      '54 concrete columns by Sol LeWitt — 10 to 20 feet tall, mirroring the Atlanta skyline. Art in America''s top public art of 2000.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'sideways-the-dogs-grave' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      'A crooked dog''s crooked headstone. Sideways walked at an angle after being thrown from a car. Students still leave pennies.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'lord-dooley-statue' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      '$80K bronze skeleton descending from the sky. Emory''s spirit since 1899. If Dooley shoots your professor, class is cancelled.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'anti-gravity-monument' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      'A tombstone urging the defeat of gravity. Donated by a millionaire whose sister and grandson drowned. He hated gravity. This is real.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'fiddlin-john-carsons-grave' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      'The man who made the first commercially successful country music recording. 1923. Labels didn''t think rural Southern music would sell. He proved them wrong.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'hank-aaron-home-run-wall' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, TRUE, 'approved',
      'The actual wall HR #715 cleared on April 8, 1974. Aaron broke Ruth''s record despite death threats and 930,000 letters of hate mail.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'kermit-chaplin-statue' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      '12-foot Kermit as Charlie Chaplin. Stood at Jim Henson Studios in Hollywood for 25 years. Came to Atlanta because Kermit opened the Puppetry Arts Center in 1978.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'spirit-of-delta' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      '7,000 Delta employees pooled their own money to buy their airline a Boeing 767. Nothing like it has happened before or since. 70,697 flight hours.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'one-person-jail-cell' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      'Atlanta''s last 1890s police lockup box. Room for one prisoner, standing. When empty, cops kept their helmets and raincoats inside.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'adalanta-desert-plaque' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      'Plaque from a parallel universe where Atlanta is a desert called "Adalanta." Part of a global art project by Charles Eames''s grandson. Near Jeni''s Ice Cream.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'elvis-shrine-vault' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      'Bank vault turned Elvis shrine in the basement of Star Community Bar. Original vault door. Safety deposit boxes of memorabilia. Velvet throne. Punk shows upstairs.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = '1895-exposition-steps' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      'Last remnant of the 1895 World''s Fair. 800,000 visitors. Booker T. Washington spoke here. The Olmsted Brothers built a park on top. Only the steps survive.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'pink-trap-house-chevy' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      'The pink Chevy from 2 Chainz''s Pink Trap House. Broke the internet in 2017. Now in T.I.''s Trap Music Museum. Staff rule: do not stand on the car.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'confessional-photobooth' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      'Church confessional turned photobooth at Sister Louisa''s. Step in where sinners once whispered. Choir robes available. Ping pong table in the next room.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'fulton-bag-mill-smokestacks' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      'Twin 1881 smokestacks rising above BeltLine loft condos. Built on Sherman''s ashes by a German immigrant. The "Stacks" that named the neighborhood.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'owl-rock' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      '16th-century Creek nation owl carving. Predates Atlanta by 300 years. Hidden in a church cemetery off Campbellton Road. Gate unlocked for visitors.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Dr. Bombay's (already mapped in 000012 if it existed, but re-ensure)
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'dr-bombays-underwater-tea-party' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort + 1, FALSE, 'approved',
      'Whimsical tea room behind a weathered door. Thousands of books. Tiered pastry trays. Sales fund women''s education in Darjeeling. Atlanta''s most Wonderland-like interior.')
    ON CONFLICT (track_id, venue_id) DO NOTHING;
  END IF;

  -- ==========================================
  -- NEW EXPANSION ARTIFACTS (beyond 79)
  -- ==========================================

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'merci-boxcar' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      'French WWII gratitude boxcar. One of 49. Packed with handmade dolls, war medals, and letters from families who remembered what American aid meant.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'ww-king-covered-bridge' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      'Built 1891 by the son of the South''s most famous bridge builder — Horace King, born enslaved, freed by an act of the Alabama legislature.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'fdr-superb-railcar' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      'FDR''s personal Pullman railcar. Mahogany, brass, stained glass. Rode it to Warm Springs for polio treatment. His body came back to Washington by train.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'stone-mountain-grist-mill' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      'Working 1869 water-powered grist mill with original granite stones. Still grinds corn. Buy a bag of cornmeal on site.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'cascade-springs-earthworks' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      'Hidden Civil War trenches in a nature preserve. Most visitors come for the springs and never realize they''re walking through a battlefield.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'the-dump-apartment' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      'The cramped apartment where Mitchell wrote all 1,037 pages of Gone with the Wind. She called it "The Dump." Started with the last chapter. Survived two arsons.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'maynard-jacksons-grave' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      'Atlanta''s first Black mayor. Built the world''s busiest airport. Youngest mayor of a major Southern city at 35. Buried near Margaret Mitchell at Oakland.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'eav-totem-pole' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      '30-foot chainsaw-carved totem pole. Made from a dead tree the city was about to remove. A totemic landmark for Atlanta''s weirdest neighborhood.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'the-clermont-lounge' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      'Since 1965. Bourdain''s favorite Atlanta bar. When the hotel went boutique, they kept the lounge exactly as-is — smoke-stained ceiling, sticky floors, and all.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'buford-highway-corridor' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      'America''s most diverse food corridor. 20 miles, 30+ cuisines, mostly no English signage. Formed organically from immigrant settlements in the 80s and 90s.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'bridge-over-nothing' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      'A highway bridge that crosses over nothing. Built for a freeway that Jimmy Carter''s neighborhood killed. Monument to the revolt that saved Atlanta''s communities.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'dahlonega-gold-museum' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      'Site of the first American gold rush — 1828, 21 years before California. The name is Cherokee for "yellow." The Capitol dome is gilded with Dahlonega gold.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_venue_id FROM venues WHERE slug = 'hank-aaron-statue' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_max_sort := v_max_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_max_sort, FALSE, 'approved',
      '9-foot bronze of the home run king mid-swing. 755 home runs. Number 44 retired across all of Major League Baseball. His mother didn''t believe him.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  RAISE NOTICE 'Artefacts repair + expansion complete. Final sort position: %', v_max_sort;
END $$;
