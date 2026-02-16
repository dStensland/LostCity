-- Artifact Parent Venue Linking + New Artifacts
-- Adds parent_venue_id column so artifacts housed at a venue
-- appear in that venue's detail page.

-- ============================================================
-- SCHEMA: parent_venue_id column
-- ============================================================

ALTER TABLE venues ADD COLUMN IF NOT EXISTS parent_venue_id bigint REFERENCES venues(id);
CREATE INDEX IF NOT EXISTS idx_venues_parent ON venues(parent_venue_id);

-- ============================================================
-- SET PARENT RELATIONSHIPS on existing artifacts
-- ============================================================

-- Bobby Jones' Grave -> Oakland Cemetery
UPDATE venues SET parent_venue_id = (SELECT id FROM venues WHERE slug = 'oakland-cemetery' LIMIT 1)
WHERE slug = 'bobby-jones-grave' AND parent_venue_id IS NULL;

-- Jack Smith Armchair Statue -> Oakland Cemetery
UPDATE venues SET parent_venue_id = (SELECT id FROM venues WHERE slug = 'oakland-cemetery' LIMIT 1)
WHERE slug = 'jack-smith-armchair-statue' AND parent_venue_id IS NULL;

-- The Cyclorama -> Atlanta History Center
UPDATE venues SET parent_venue_id = (SELECT id FROM venues WHERE slug = 'atlanta-history-center' LIMIT 1)
WHERE slug = 'the-cyclorama' AND parent_venue_id IS NULL;

-- Zero Mile Post -> Underground Atlanta
UPDATE venues SET parent_venue_id = (SELECT id FROM venues WHERE slug = 'underground-atlanta' LIMIT 1)
WHERE slug = 'zero-mile-post' AND parent_venue_id IS NULL;

-- Noguchi Playscape -> Piedmont Park
UPDATE venues SET parent_venue_id = (SELECT id FROM venues WHERE slug = 'piedmont-park' LIMIT 1)
WHERE slug = 'noguchi-playscape' AND parent_venue_id IS NULL;

-- Hoo-Hoo Monument -> Piedmont Park
UPDATE venues SET parent_venue_id = (SELECT id FROM venues WHERE slug = 'piedmont-park' LIMIT 1)
WHERE slug = 'hoo-hoo-monument' AND parent_venue_id IS NULL;

-- The Great Fish -> Atlanta Fish Market
UPDATE venues SET parent_venue_id = (SELECT id FROM venues WHERE slug = 'atlanta-fish-market' LIMIT 1)
WHERE slug = 'the-great-fish' AND parent_venue_id IS NULL;

-- Fountain of Rings -> Centennial Olympic Park
UPDATE venues SET parent_venue_id = (SELECT id FROM venues WHERE slug = 'centennial-olympic-park' LIMIT 1)
WHERE slug = 'fountain-of-rings' AND parent_venue_id IS NULL;

-- The Varsity Neon Sign -> The Varsity
UPDATE venues SET parent_venue_id = (SELECT id FROM venues WHERE slug = 'the-varsity' LIMIT 1)
WHERE slug = 'the-varsity-neon-sign' AND parent_venue_id IS NULL;

-- Crypt of Civilization -> Oglethorpe University
UPDATE venues SET parent_venue_id = (SELECT id FROM venues WHERE slug = 'oglethorpe-university' LIMIT 1)
WHERE slug = 'crypt-of-civilization' AND parent_venue_id IS NULL;

-- Doll's Head Trail -> Constitution Lakes
UPDATE venues SET parent_venue_id = (SELECT id FROM venues WHERE slug = 'constitution-lakes' LIMIT 1)
WHERE slug = 'dolls-head-trail' AND parent_venue_id IS NULL;

-- Pemberton Statue -> World of Coca-Cola
UPDATE venues SET parent_venue_id = (SELECT id FROM venues WHERE slug = 'world-of-coca-cola' LIMIT 1)
WHERE slug = 'pemberton-statue' AND parent_venue_id IS NULL;

-- The Storyteller (Stag-Man) -> Buckhead Library
UPDATE venues SET parent_venue_id = (SELECT id FROM venues WHERE slug = 'buckhead-library' LIMIT 1)
WHERE slug = 'the-storyteller-stag-man' AND parent_venue_id IS NULL;

-- ============================================================
-- NEW ARTIFACTS
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

-- ============================================================
-- HIGHLIGHTS on new artifacts
-- ============================================================

-- Ramblin' Wreck
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Stolen Multiple Times',
  'The car has been stolen by rival schools and pranksters several times. In 1963, Auburn fans stole it during a game. The Ramblin'' Reck Club now guards it 24/7 during rivalry weeks.',
  0
FROM venues v WHERE v.slug = 'ramblin-wreck'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Stolen Multiple Times');

-- Coca-Cola Vault
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Only Two People Know',
  'According to Coca-Cola legend, only two executives know the complete formula at any time, and they are never allowed to fly on the same airplane.',
  0
FROM venues v WHERE v.slug = 'coca-cola-vault'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Only Two People Know');

-- Willie B Statue
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', '27 Years Alone',
  'Willie B spent his first 27 years in a concrete and tile enclosure with nothing but a television. After the zoo''s renovation in the late 1980s, he finally met other gorillas and fathered five offspring.',
  0
FROM venues v WHERE v.slug = 'willie-b-statue'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = '27 Years Alone');

-- ============================================================
-- MORE ARTIFACTS (from research)
-- ============================================================

-- 54 Columns (Sol LeWitt) — Old Fourth Ward
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT '54 Columns', '54-columns', 'artifact', 'Atlanta', 'GA', 'Old Fourth Ward',
  33.7623, -84.3625,
  'A public art installation by minimalist master Sol LeWitt: 54 concrete columns ranging from 10 to 20 feet tall, arranged in a triangular grid at the corner of Glen Iris Drive and North Highland Ave. Commissioned by the Fulton County Arts Council in 1999 and donated by the Taylor family with help from the High Museum. Art in America named it among the top public art projects of 2000. The columns mirror the Atlanta skyline. Renovated in 2024 into a landscaped pocket park.',
  '54 concrete columns by Sol LeWitt. Minimalist skyline in a pocket park.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = '54-columns');

-- Sideways the Dog's Grave — Georgia Tech campus
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT 'Sideways the Dog''s Grave', 'sideways-the-dogs-grave', 'artifact', 'Atlanta', 'GA', 'Midtown',
  33.7714, -84.3933,
  'A plaque near the southeast corner of Tech Tower marks the grave of Sideways, a white terrier with a black eye patch who became Georgia Tech''s unofficial mascot after being thrown from a moving car on North Avenue in 1945. Surgeries saved her life but left her walking at a permanent angle — hence the name. She roamed from class to class and dorm to dorm until she died from eating rat poison. Her headstone is deliberately set at a tilt, just like she was. Students still leave pennies on it.',
  'Georgia Tech''s beloved crooked dog. Headstone set at a tilt, just like she walked.',
  true, 'hidden_gems',
  (SELECT id FROM venues WHERE slug = 'georgia-tech' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'sideways-the-dogs-grave');

-- Lord Dooley Statue — Emory University
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT 'Lord Dooley Statue', 'lord-dooley-statue', 'artifact', 'Atlanta', 'GA', 'Druid Hills',
  33.7917, -84.3243,
  'An $80,000 bronze statue of Lord Dooley — a skeleton "descending from the sky," casting aside his skeleton suit to reveal that he really is a skeleton. Dooley has been Emory''s spirit since 1899, embodied each spring by a student in a skull mask and bone-painted sheet who roams campus with the power to cancel classes. The statue was unveiled at Homecoming 2008 on Asbury Circle.',
  '$80K bronze skeleton descending from the sky. Emory''s spirit since 1899.',
  true, 'hidden_gems',
  (SELECT id FROM venues WHERE slug = 'emory-university' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'lord-dooley-statue');

-- Anti-Gravity Monument — Emory University
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT 'Anti-Gravity Monument', 'anti-gravity-monument', 'artifact', 'Atlanta', 'GA', 'Druid Hills',
  33.7907, -84.3253,
  'A rose-colored tombstone hidden on a wooded hillside near Emory''s Mathematics and Science Center, donated by millionaire Roger Babson — who hated gravity after it drowned his sister and grandson. Babson paid to erect tombstone-like monuments at colleges across America urging the defeat of gravity. The Gravity Research Foundation he founded in 1949 offered cash prizes for anti-gravity essays. This is one of the last surviving monuments.',
  'A tombstone urging the defeat of gravity. Donated by a millionaire who hated it.',
  true, 'hidden_gems',
  (SELECT id FROM venues WHERE slug = 'emory-university' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'anti-gravity-monument');

-- Fiddlin' John Carson's Grave — Sylvester Cemetery, East Atlanta
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Fiddlin'' John Carson''s Grave', 'fiddlin-john-carsons-grave', 'artifact', 'Atlanta', 'GA', 'East Atlanta',
  33.7392, -84.3495,
  'The gravestone of Fiddlin'' John Carson at Sylvester Cemetery — the man who made the first commercially successful country music recording in 1923. His headstone features a carved image of Carson fiddling with his foot propped on an outline of Georgia. A gravel lane named for him leads visitors to the family plot. Before him, record labels didn''t think Southern rural music would sell. He proved them wrong and changed American music forever.',
  'Grave of the man who invented recorded country music. Headstone shows him fiddling.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'fiddlin-john-carsons-grave');

-- Hank Aaron Home Run Wall — near old Turner Field
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Hank Aaron Home Run Wall', 'hank-aaron-home-run-wall', 'artifact', 'Atlanta', 'GA', 'Summerhill',
  33.7350, -84.3894,
  'The actual section of outfield wall over which Hank Aaron hit home run #715 on April 8, 1974 — the swing that broke Babe Ruth''s all-time record. The wall segment was preserved and reinstalled at its original location (521 Capitol Ave SE) when the old Atlanta-Fulton County Stadium was demolished. A monument marks the exact spot where the ball cleared. Aaron did it despite receiving death threats and racist hate mail throughout the chase.',
  'The actual wall Hank Aaron''s record-breaking HR #715 cleared. April 8, 1974.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'hank-aaron-home-run-wall');

-- ============================================================
-- HIGHLIGHTS on additional artifacts
-- ============================================================

-- Sideways
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Tilted on Purpose',
  'Her headstone is deliberately set at an angle, matching the permanent tilt she walked with after her injuries. Students still place pennies on it.',
  0
FROM venues v WHERE v.slug = 'sideways-the-dogs-grave'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Tilted on Purpose');

-- Lord Dooley
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Can Cancel Classes',
  'Each spring, a student dressed as Dooley roams campus with a squirt gun. If Dooley "shoots" a professor, the class is officially cancelled. Faculty cannot refuse.',
  0
FROM venues v WHERE v.slug = 'lord-dooley-statue'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Can Cancel Classes');

-- Hank Aaron Wall
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Despite Death Threats',
  'Aaron received an estimated 930,000 letters during the chase — more mail than any non-politician in America. Many were death threats. He needed a bodyguard and couldn''t stay in the same hotels as his teammates.',
  0
FROM venues v WHERE v.slug = 'hank-aaron-home-run-wall'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Despite Death Threats');

-- ============================================================
-- EVEN MORE ARTIFACTS (Atlas Obscura research)
-- ============================================================

-- Kermit the Frog Chaplin Statue — Center for Puppetry Arts
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT 'Kermit the Frog Chaplin Statue', 'kermit-chaplin-statue', 'artifact', 'Atlanta', 'GA', 'Midtown',
  33.7910, -84.3878,
  'A 12-foot bronze statue of Kermit the Frog dressed as Charlie Chaplin''s The Little Tramp — top hat, cane, baggy pants. Originally installed at Jim Henson Studios in Hollywood in 2000, it was gifted to Atlanta''s Center for Puppetry Arts by the Henson family in late 2025. Kermit himself (with Jim Henson performing) cut the ribbon at the Center''s opening in 1978. The Center houses the world''s largest collection of Henson puppets, including original Muppets, Fraggles, and Sesame Street characters.',
  '12-foot Kermit dressed as Charlie Chaplin. Gifted by the Henson family in 2025.',
  true, 'landmarks_attractions',
  (SELECT id FROM venues WHERE slug = 'center-for-puppetry-arts' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'kermit-chaplin-statue');

-- The Spirit of Delta — Delta Flight Museum
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT 'The Spirit of Delta', 'spirit-of-delta', 'artifact', 'Atlanta', 'GA', 'Hapeville',
  33.6418, -84.4279,
  'A Boeing 767-200 bought by Delta employees and donated to the airline in 1982 — over 7,000 employees pooled their own money to buy their company a plane. Christened "The Spirit of Delta," Ship 102 flew as an ambassador of employee pride for 23 years, wore special Olympic livery in 1996, and was retired in 2006 after 70,697 flight hours. It was towed across two public roads from the maintenance hangar to the museum. The cockpit and first-class cabin remain intact.',
  'A Boeing 767 bought by employees for their own airline. 70,697 flight hours.',
  true, 'landmarks_attractions',
  (SELECT id FROM venues WHERE slug = 'delta-flight-museum' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'spirit-of-delta');

-- One-Person Jail Cell — Delta Park, Inman Park
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'One-Person Jail Cell', 'one-person-jail-cell', 'artifact', 'Atlanta', 'GA', 'Inman Park',
  33.7575, -84.3535,
  'Atlanta''s last surviving one-person police lockup box, tucked in Delta Park at the corner of Edgewood Avenue and Delta Place. Built between 1890 and 1905, these phone-booth-sized iron cells held one prisoner standing up while the officer waited for the horse-drawn patrol wagon. When empty, cops stored their helmets, nightsticks, and raincoats inside. Atlanta had at least four across the city; this is the only one left. Restored and returned to its original location in 1974.',
  'Last surviving 1890s police lockup box. Room for one prisoner, standing.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'one-person-jail-cell');

-- Adalanta Desert Plaque — Westside Provisions
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Adalanta Desert Plaque', 'adalanta-desert-plaque', 'artifact', 'Atlanta', 'GA', 'Westside',
  33.8085, -84.4107,
  'A bronze plaque at Westside Provisions that honors events from a parallel universe where Atlanta is a searing desert called "Adalanta," crossed by great sphaltways built by Martha Pelaski''s trading post. Part of Kcymaerxthaere — a global art project by Eames Demetrios (grandson of Charles Eames) installing plaques in 30+ countries commemorating the history of an alternate Earth. Look near Forza Storico or the metal staircase by Jeni''s Ice Cream.',
  'Plaque honoring events from a parallel universe where Atlanta is a desert.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'adalanta-desert-plaque');

-- Elvis Shrine Vault — Star Community Bar, Little Five Points
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Elvis Shrine Vault', 'elvis-shrine-vault', 'artifact', 'Atlanta', 'GA', 'Little Five Points',
  33.7645, -84.3490,
  'A bank vault in the basement of the old Clermont-Midtown Bank building — now Star Community Bar — repurposed as an eternal shrine to Elvis Presley. The original vault door and locking mechanisms are still intact. Inside: safety deposit boxes filled with Elvis memorabilia, a velvet "throne," and walls covered in tributes to The King. The bar hosts punk and metal shows upstairs while Elvis rests in peace below.',
  'Bank vault turned Elvis shrine. Original vault door, safety deposit boxes, velvet throne.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'elvis-shrine-vault');

-- 1895 Cotton Exposition Steps — Piedmont Park
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT '1895 Exposition Steps', '1895-exposition-steps', 'artifact', 'Atlanta', 'GA', 'Midtown',
  33.7830, -84.3725,
  'The last physical remnants of the 1895 Cotton States and International Exposition — a world''s fair that drew nearly 800,000 visitors and put Atlanta on the international map. These stone steps once led to the exposition''s grand buildings. Booker T. Washington delivered his famous "Atlanta Compromise" speech here. The Olmsted Brothers later transformed the fairgrounds into Piedmont Park, but these steps survive as silent witnesses.',
  'Last remnant of the 1895 World''s Fair where Booker T. Washington spoke.',
  true, 'landmarks_attractions',
  (SELECT id FROM venues WHERE slug = 'piedmont-park' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = '1895-exposition-steps');

-- ============================================================
-- HIGHLIGHTS on Atlas Obscura artifacts
-- ============================================================

-- Kermit Statue
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'From Hollywood to Atlanta',
  'The statue stood at Jim Henson Studios in Hollywood for 25 years. When the Henson family decided to move it, they chose Atlanta — because Kermit himself opened the Center for Puppetry Arts in 1978.',
  0
FROM venues v WHERE v.slug = 'kermit-chaplin-statue'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'From Hollywood to Atlanta');

-- Spirit of Delta
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Employees Bought Their Company a Plane',
  'Three Delta flight attendants launched "Project 767" — rallying over 7,000 employees and retirees to pool their own money and buy the airline a brand-new Boeing 767. Nothing like it has happened before or since.',
  0
FROM venues v WHERE v.slug = 'spirit-of-delta'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Employees Bought Their Company a Plane');

-- One-Person Jail Cell
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Also a Coat Closet',
  'When no prisoner occupied the cell, officers used it to store helmets, nightsticks, raincoats, and gear. A dual-purpose iron phone booth.',
  0
FROM venues v WHERE v.slug = 'one-person-jail-cell'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Also a Coat Closet');

-- ============================================================
-- FINAL BATCH
-- ============================================================

-- 2 Chainz's Pink Trap House Chevy — Trap Music Museum
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT '2 Chainz''s Pink Chevy', 'pink-trap-house-chevy', 'artifact', 'Atlanta', 'GA', 'Westside',
  33.7718, -84.4086,
  'The bright pink 1970s Chevrolet from 2 Chainz''s infamous Pink Trap House — the pop-up on Howell Mill Road that broke the internet in 2017 when he painted a rental house pink to promote "Pretty Girls Like Trap Music." The original car had to be towed after fans kept jumping on it. Now displayed inside T.I.''s Trap Music Museum alongside Jeezy''s cocaine snowman and T.I.''s Grammy. Staff still have to remind visitors: do not stand on the car.',
  'The pink Chevy from the Pink Trap House. Staff rule: do not stand on the car.',
  true, 'hidden_gems',
  (SELECT id FROM venues WHERE slug = 'trap-music-museum' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'pink-trap-house-chevy');

-- The Confessional Photobooth — Sister Louisa's Church
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category, parent_venue_id)
SELECT 'The Confessional Photobooth', 'confessional-photobooth', 'artifact', 'Atlanta', 'GA', 'Old Fourth Ward',
  33.7556, -84.3714,
  'A retrofitted church confessional repurposed as a photobooth inside Sister Louisa''s Church of the Living Room & Ping Pong Emporium on Edgewood Avenue. Step in, close the curtain, and take your portrait where sinners once whispered. Part of Grant Henry''s church-themed fever dream that also includes an organ for live karaoke, complimentary choir robes for patrons, walls covered floor-to-ceiling in satirical religious paintings, and a ping pong table.',
  'Church confessional turned photobooth. Step in where sinners once whispered.',
  true, 'hidden_gems',
  (SELECT id FROM venues WHERE slug = 'sister-louisas-church' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'confessional-photobooth');

-- Fulton Bag Mill Smokestacks — Cabbagetown
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Fulton Bag Mill Smokestacks', 'fulton-bag-mill-smokestacks', 'artifact', 'Atlanta', 'GA', 'Cabbagetown',
  33.7490, -84.3625,
  'The twin smokestacks of the Fulton Bag and Cotton Mills — still standing since 1881, now rising above the loft condos named after them ("The Stacks"). Jacob Elsas, a German Jewish immigrant, built the mill on the ruins of the Atlanta Rolling Mill that Sherman burned in 1864. By the early 1900s it was one of the largest cotton mills in the South, employing the entire neighborhood of Cabbagetown. The mill closed in the 1970s, was converted to lofts in 1995 in one of the biggest loft conversions in the US, but the smokestacks remain — industrial ghosts watching over the BeltLine.',
  'Twin 1881 cotton mill smokestacks. The "Stacks" that named the neighborhood.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'fulton-bag-mill-smokestacks');

-- Owl Rock — Campbellton Road, SW Atlanta
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Owl Rock', 'owl-rock', 'artifact', 'Atlanta', 'GA', 'Southwest Atlanta',
  33.6890, -84.5075,
  'An eight-foot-tall boulder carved with an owl''s eye by Creek nation artisans in the 16th century, hidden inside the cemetery of the Owl Rock United Methodist Church at 5880 Campbellton Road. Before Atlanta existed, members of the Creek nation settled along the Chattahoochee at a town called Oktahatalofa — Sandtown. This boulder served as a trail marker at the entrance to the town. It is one of the oldest surviving human-made marks in the Atlanta metro area. The church cemetery gate is unlocked for visitors.',
  '16th-century Creek nation carving on an 8-foot boulder. Hidden in a church cemetery.',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'owl-rock');

-- Highlights
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Older Than Atlanta',
  'This carving predates the city of Atlanta by roughly 300 years. It marks the entrance to Oktahatalofa (Sandtown), a Creek settlement along the Chattahoochee. One of the oldest human-made marks in the metro area.',
  0
FROM venues v WHERE v.slug = 'owl-rock'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Older Than Atlanta');

-- ============================================================
-- DR. BOMBAY'S — venue, not artifact
-- ============================================================

INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, website, active, explore_category)
SELECT 'Dr. Bombay''s Underwater Tea Party', 'dr-bombays-underwater-tea-party', 'coffee_shop', 'Atlanta', 'GA', 'Grant Park',
  33.7337, -84.3700,
  'A whimsical, book-lined tea room across from Zoo Atlanta in Grant Park, behind a weathered door. Tiered trays of pastries arrive with pots of Darjeeling while vintage furniture and thousands of books create a world that feels like falling through a looking glass. Owner Katrell Christie runs The Learning Tea — a significant portion of sales fund housing and education for young women in Darjeeling, India. Relocated from Candler Park in 2025 after 20 years.',
  'Book-lined tea room behind a weathered door. Sales fund women''s education in India.',
  'https://www.drbombays.com/',
  true, 'hidden_gems'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'dr-bombays-underwater-tea-party');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'We Brew Scholars',
  'A portion of every cup of tea funds The Learning Tea — housing and educational scholarships for young women in Darjeeling, India. Founded by owner Katrell Christie.',
  0
FROM venues v WHERE v.slug = 'dr-bombays-underwater-tea-party'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'We Brew Scholars');

-- ============================================================

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Sherman Burned What Came Before',
  'The mill was built on the ruins of the Atlanta Rolling Mill, which forged Confederate railroad track and artillery until Sherman''s troops destroyed it in 1864. Elsas built his cotton mill on the ashes.',
  0
FROM venues v WHERE v.slug = 'fulton-bag-mill-smokestacks'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Sherman Burned What Came Before');
