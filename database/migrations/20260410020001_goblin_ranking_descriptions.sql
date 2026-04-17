-- Add description column to ranking items and populate all entries
-- Also fix Final Reckoning items and add missing iconic items from older films

-- 1. Add description column
ALTER TABLE goblin_ranking_items ADD COLUMN IF NOT EXISTS description text;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Fix Final Reckoning stunts (correct names + add descriptions)
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE goblin_ranking_items
SET name = 'Sevastopol submarine dive',
    description = 'Ethan descends to a sunken Russian submarine on the ocean floor to retrieve the Entity''s source code as compartments flood around him.'
WHERE name = 'Submarine torpedo tube escape' AND subtitle = 'The Final Reckoning';

UPDATE goblin_ranking_items
SET description = 'Tom Cruise clings to and fights atop a biplane over South Africa''s Drakensberg mountains at full speed.'
WHERE name = 'Biplane wing walk' AND subtitle = 'The Final Reckoning';

UPDATE goblin_ranking_items
SET name = 'Burning parachute freefall',
    description = 'Cruise falls from a biplane with a burning parachute — performed 16 times to set a Guinness World Record.'
WHERE name = 'Freefall without parachute' AND subtitle = 'The Final Reckoning';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Fix Final Reckoning sequences (replace Entity confrontation with real set pieces)
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE goblin_ranking_items
SET name = 'Sevastopol submarine dive',
    description = 'A 20-minute underwater sequence as Ethan infiltrates a sunken sub, the wreck shifts on the ocean floor, and compartments flood one by one.'
WHERE name = 'Entity confrontation' AND subtitle = 'The Final Reckoning';

UPDATE goblin_ranking_items
SET name = 'St. Matthew''s Island battle',
    description = 'The team defends against Russian special forces on a remote Bering Sea island as a homestead burns and Grace escapes by dog sled.'
WHERE name = 'Submarine opening' AND subtitle = 'The Final Reckoning';

-- Add the two missing Final Reckoning sequences
INSERT INTO goblin_ranking_items (category_id, name, subtitle, description, image_url) VALUES
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = (SELECT id FROM goblin_ranking_games WHERE name = 'Mission: Impossible')),
   'Biplane dogfight over Drakensberg', 'The Final Reckoning',
   'Extended aerial battle over South Africa culminating in mid-air plane transfers, a cockpit fight, and a burning parachute escape.',
   'https://image.tmdb.org/t/p/w500/538U9snNc2fpnOmYXAPUh3zn31H.jpg'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = (SELECT id FROM goblin_ranking_games WHERE name = 'Mission: Impossible')),
   'Doomsday vault gunfight', 'The Final Reckoning',
   'A confined shootout in a South African bunker as a bomb activates and Benji is critically wounded.',
   'https://image.tmdb.org/t/p/w500/pcw4m5WjuQvZZDvVG8UDIp2uWeR.jpg');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Add missing iconic items from older films
-- ═══════════════════════════════════════════════════════════════════════════════

-- Stunt: London rooftop chase (Fallout) — Cruise broke his ankle
INSERT INTO goblin_ranking_items (category_id, name, subtitle, description, image_url) VALUES
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = (SELECT id FROM goblin_ranking_games WHERE name = 'Mission: Impossible')),
   'London rooftop chase / building jump', 'Fallout',
   'Ethan sprints across London rooftops and leaps between buildings — Tom Cruise broke his ankle on impact and kept running.',
   'https://image.tmdb.org/t/p/w500/AkJQpZp9WoNdj7pLYSj1L0RcMMN.jpg');

-- Sequence: Prague restaurant hit / team wipeout (MI)
INSERT INTO goblin_ranking_items (category_id, name, subtitle, description, image_url) VALUES
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = (SELECT id FROM goblin_ranking_games WHERE name = 'Mission: Impossible')),
   'Prague restaurant hit / team wipeout', 'MI',
   'The opening mission where Ethan''s entire IMF team is systematically killed during a Prague embassy operation — the inciting incident of the franchise.',
   'https://image.tmdb.org/t/p/w500/sra8XnL96OyLHENcglmZJg6HA8z.jpg');

-- Sequence: Mumbai server room / dual-bluff (Ghost Protocol)
INSERT INTO goblin_ranking_items (category_id, name, subtitle, description, image_url) VALUES
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = (SELECT id FROM goblin_ranking_games WHERE name = 'Mission: Impossible')),
   'Mumbai server room / dual-bluff', 'Ghost Protocol',
   'Brandt drops into a fan shaft while Ethan and the team run simultaneous cons on the buyer and seller in the film''s climactic heist-within-a-heist.',
   'https://image.tmdb.org/t/p/w500/hqyjzDRCs1N5gEsh2gklzPdsEFD.jpg');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. Add descriptions to ALL existing items
-- ═══════════════════════════════════════════════════════════════════════════════

-- Movies
UPDATE goblin_ranking_items SET description = 'Brian De Palma''s original — Ethan Hunt goes rogue after his team is killed and the NOC list is stolen.' WHERE name = 'Mission: Impossible' AND subtitle = '1996';
UPDATE goblin_ranking_items SET description = 'John Woo''s stylized sequel — Ethan races to stop a rogue agent from unleashing the Chimera virus in Sydney.' WHERE name = 'Mission: Impossible 2' AND subtitle = '2000';
UPDATE goblin_ranking_items SET description = 'J.J. Abrams'' visceral entry — Ethan faces ruthless arms dealer Owen Davian while protecting the people he loves.' WHERE name = 'Mission: Impossible III' AND subtitle = '2006';
UPDATE goblin_ranking_items SET description = 'Brad Bird''s animated-to-live-action leap — the IMF is disavowed after a Kremlin bombing, forcing the team to go off-grid.' WHERE name LIKE 'Mission: Impossible%Ghost Protocol' AND subtitle = '2011';
UPDATE goblin_ranking_items SET description = 'McQuarrie''s first MI — Ethan uncovers the Syndicate, a rogue nation of former intelligence operatives led by Solomon Lane.' WHERE name LIKE 'Mission: Impossible%Rogue Nation' AND subtitle = '2015';
UPDATE goblin_ranking_items SET description = 'The franchise peak for many — Ethan races to prevent a nuclear attack while the CIA sends assassin August Walker to shadow him.' WHERE name LIKE 'Mission: Impossible%Fallout' AND subtitle = '2018';
UPDATE goblin_ranking_items SET description = 'Part one of the finale — Ethan confronts the Entity, a sentient AI, and his old enemy Gabriel across Rome and the Orient Express.' WHERE name LIKE 'Mission: Impossible%Dead Reckoning' AND subtitle = '2023';
UPDATE goblin_ranking_items SET description = 'The final chapter — Ethan and the team race to shut down the Entity for good while governments and a ghost from his past close in.' WHERE name LIKE 'Mission: Impossible%Final Reckoning' AND subtitle = '2025';

-- Stunts (MI 1996)
UPDATE goblin_ranking_items SET description = 'Ethan suspends himself inches above a pressure-sensitive floor to steal the NOC list from CIA headquarters.' WHERE name = 'Langley ceiling hang' AND subtitle = 'MI';
UPDATE goblin_ranking_items SET description = 'A massive aquarium shatters during a restaurant meeting, flooding the room in an iconic practical effects sequence.' WHERE name = 'Aquarium restaurant explosion' AND subtitle = 'MI';
UPDATE goblin_ranking_items SET description = 'A helicopter pursues the TGV high-speed train into the Channel Tunnel, with Ethan on the roof.' WHERE name = 'Channel Tunnel helicopter chase' AND subtitle = 'MI';

-- Stunts (MI:2)
UPDATE goblin_ranking_items SET description = 'Ethan scales a sheer cliff face at Dead Horse Point, Utah — no ropes, no net, Cruise did it himself.' WHERE name = 'Rock climbing free solo' AND subtitle = 'MI:2';
UPDATE goblin_ranking_items SET description = 'Ethan and Ambrose charge each other head-on on motorcycles, leaping off and colliding mid-air.' WHERE name = 'Motorcycle joust' AND subtitle = 'MI:2';

-- Stunts (MI:III)
UPDATE goblin_ranking_items SET description = 'The team infiltrates a Vatican City event in full disguise to kidnap arms dealer Owen Davian.' WHERE name = 'Vatican infiltration' AND subtitle = 'MI:III';
UPDATE goblin_ranking_items SET description = 'Ethan swings on a cable from a Shanghai rooftop into a guarded building in a single fluid arc.' WHERE name = 'Shanghai factory swing' AND subtitle = 'MI:III';

-- Stunts (Ghost Protocol)
UPDATE goblin_ranking_items SET description = 'Ethan scales the outside of the world''s tallest building using malfunctioning gecko gloves — Cruise actually climbed the Burj Khalifa.' WHERE name = 'Burj Khalifa climb' AND subtitle = 'Ghost Protocol';
UPDATE goblin_ranking_items SET description = 'A multi-level car chase through a Mumbai parking structure in pursuit of Hendricks.' WHERE name = 'Mumbai parking garage chase' AND subtitle = 'Ghost Protocol';

-- Stunts (Rogue Nation)
UPDATE goblin_ranking_items SET description = 'Ethan clings to the outside of an Airbus A400M military transport as it takes off and climbs to altitude.' WHERE name = 'Plane door hang (takeoff)' AND subtitle = 'Rogue Nation';
UPDATE goblin_ranking_items SET description = 'A high-speed motorcycle pursuit through the winding mountain roads of Casablanca.' WHERE name = 'Morocco motorcycle chase' AND subtitle = 'Rogue Nation';
UPDATE goblin_ranking_items SET description = 'Ethan holds his breath for over three minutes underwater to swap a security profile inside a submerged power station.' WHERE name = 'Underwater Torus breach' AND subtitle = 'Rogue Nation';

-- Stunts (Fallout)
UPDATE goblin_ranking_items SET description = 'Ethan and Walker perform a HALO jump over Paris at 25,000 feet — Cruise did over 100 jumps to film it.' WHERE name = 'HALO jump' AND subtitle = 'Fallout';
UPDATE goblin_ranking_items SET description = 'Ethan pilots a helicopter through narrow Kashmir mountain canyons in pursuit of Walker.' WHERE name = 'Helicopter canyon chase' AND subtitle = 'Fallout';
UPDATE goblin_ranking_items SET description = 'Ethan rides a motorcycle against traffic around the Arc de Triomphe with no helmet and no CGI.' WHERE name = 'Paris motorcycle chase' AND subtitle = 'Fallout';
UPDATE goblin_ranking_items SET description = 'Ethan and Walker fight on the edge of a sheer cliff face above a Kashmir gorge.' WHERE name = 'Kashmir cliff fight' AND subtitle = 'Fallout';

-- Stunts (Dead Reckoning)
UPDATE goblin_ranking_items SET description = 'Ethan rides a motorcycle off a 4,000-foot Norwegian cliff and BASE jumps to the train below — the most dangerous stunt in cinema history.' WHERE name = 'Motorcycle cliff jump' AND subtitle = 'Dead Reckoning';
UPDATE goblin_ranking_items SET description = 'Ethan fights Gabriel on top of the Orient Express as the train derails off a destroyed bridge into a river gorge.' WHERE name = 'Orient Express train roof fight' AND subtitle = 'Dead Reckoning';

-- Sequences (MI 1996)
UPDATE goblin_ranking_items SET description = 'Ethan''s team executes an elaborate heist at a Prague embassy gala that turns out to be a mole-hunt trap.' WHERE name = 'NOC list theft (embassy)' AND subtitle = 'MI';
UPDATE goblin_ranking_items SET description = 'The climactic unmasking of the mole aboard the TGV Eurostar train, with Phelps revealed as the traitor.' WHERE name = 'Bible reveal / mole hunt' AND subtitle = 'MI';

-- Sequences (MI:2)
UPDATE goblin_ranking_items SET description = 'Ethan uses a mask to infiltrate a Seville nightclub and approach Nyah Nordoff-Hall for recruitment.' WHERE name = 'Seville nightclub infiltration' AND subtitle = 'MI:2';
UPDATE goblin_ranking_items SET description = 'The team breaks into Biocyte Pharmaceuticals'' cliff-top lab in Sydney to destroy the Chimera virus before it spreads.' WHERE name = 'Chimera lab break-in' AND subtitle = 'MI:2';

-- Sequences (MI:III)
UPDATE goblin_ranking_items SET description = 'An IMF convoy captures Davian on the Chesapeake Bay Bridge, then his team counterattacks with a drone strike.' WHERE name = 'Bridge ambush / Davian capture' AND subtitle = 'MI:III';
UPDATE goblin_ranking_items SET description = 'Ethan sprints across Shanghai rooftops in a desperate race to reach the Rabbit''s Foot before the countdown expires.' WHERE name = 'Shanghai rooftop run' AND subtitle = 'MI:III';

-- Sequences (Ghost Protocol)
UPDATE goblin_ranking_items SET description = 'The team infiltrates the Kremlin using a hallway screen illusion — then the building explodes and the IMF is disavowed.' WHERE name = 'Kremlin infiltration' AND subtitle = 'Ghost Protocol';
UPDATE goblin_ranking_items SET description = 'Ethan chases Hendricks on foot through a massive Dubai sandstorm with near-zero visibility.' WHERE name = 'Sandstorm pursuit' AND subtitle = 'Ghost Protocol';

-- Sequences (Rogue Nation)
UPDATE goblin_ranking_items SET description = 'Ethan prevents an assassination during a live Turandot performance at the Vienna State Opera in a tense three-way standoff.' WHERE name = 'Vienna opera house' AND subtitle = 'Rogue Nation';
UPDATE goblin_ranking_items SET description = 'Ethan and Ilsa pursue Solomon Lane through London streets, ending with Lane trapped in a bulletproof glass box.' WHERE name = 'London pursuit / glass box' AND subtitle = 'Rogue Nation';
UPDATE goblin_ranking_items SET description = 'The Syndicate''s existence is revealed as Lane interrogates a captured agent, exposing a shadow network of rogue operatives.' WHERE name = 'Lane interrogation (The Syndicate reveal)' AND subtitle = 'Rogue Nation';

-- Sequences (Fallout)
UPDATE goblin_ranking_items SET description = 'Ethan and Walker team up against John Lark in a brutal close-quarters bathroom brawl — one of the best fight scenes in the franchise.' WHERE name = 'Belfast bathroom fight' AND subtitle = 'Fallout';
UPDATE goblin_ranking_items SET description = 'A simultaneous race against two nuclear devices in the Kashmir mountains while Ethan battles Walker on a cliff above.' WHERE name = 'Kashmir nuclear deactivation' AND subtitle = 'Fallout';

-- Sequences (Dead Reckoning)
UPDATE goblin_ranking_items SET description = 'Ethan confronts Gabriel at an Abu Dhabi airport with multiple factions double-crossing each other in real time.' WHERE name = 'Airport runway standoff' AND subtitle = 'Dead Reckoning';
UPDATE goblin_ranking_items SET description = 'A sprawling chase through Venice''s narrow streets, alleys, and canals as multiple factions converge on Ethan and Grace.' WHERE name = 'Venice chase' AND subtitle = 'Dead Reckoning';
UPDATE goblin_ranking_items SET description = 'Ethan and Grace flee through Rome in a tiny yellow Fiat 500 while handcuffed together, crashing through ancient streets.' WHERE name = 'Rome car chase (Fiat)' AND subtitle = 'Dead Reckoning';
