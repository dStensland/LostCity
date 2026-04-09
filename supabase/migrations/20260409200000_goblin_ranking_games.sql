-- Goblin Day: Ranking Games
-- Generic ranking game system for collaborative item ranking during hangs

-- 1. Tables
CREATE TABLE IF NOT EXISTS goblin_ranking_games (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  image_url text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goblin_ranking_categories (
  id serial PRIMARY KEY,
  game_id integer NOT NULL REFERENCES goblin_ranking_games(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goblin_ranking_items (
  id serial PRIMARY KEY,
  category_id integer NOT NULL REFERENCES goblin_ranking_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  subtitle text,
  image_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goblin_ranking_entries (
  id serial PRIMARY KEY,
  item_id integer NOT NULL REFERENCES goblin_ranking_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sort_order integer NOT NULL,
  tier_name text,
  tier_color text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (item_id, user_id)
);

-- 2. Indexes
CREATE INDEX idx_ranking_entries_user_item ON goblin_ranking_entries(user_id, item_id);
CREATE INDEX idx_ranking_categories_game_order ON goblin_ranking_categories(game_id, sort_order);
CREATE INDEX idx_ranking_items_category ON goblin_ranking_items(category_id);

-- 3. RLS
ALTER TABLE goblin_ranking_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE goblin_ranking_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE goblin_ranking_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE goblin_ranking_entries ENABLE ROW LEVEL SECURITY;

-- Reference tables: authenticated read-only
CREATE POLICY "read_games" ON goblin_ranking_games FOR SELECT USING (true);
CREATE POLICY "read_categories" ON goblin_ranking_categories FOR SELECT USING (true);
CREATE POLICY "read_items" ON goblin_ranking_items FOR SELECT USING (true);

-- Entry table: public read + owner write
CREATE POLICY "read_all_entries" ON goblin_ranking_entries FOR SELECT USING (true);
CREATE POLICY "insert_own_entries" ON goblin_ranking_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_entries" ON goblin_ranking_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete_own_entries" ON goblin_ranking_entries FOR DELETE USING (auth.uid() = user_id);

-- 4. Seed: Mission: Impossible
INSERT INTO goblin_ranking_games (name, description, status) VALUES
  ('Mission: Impossible', 'Rank the movies, the stunts, and the sequences.', 'open');

-- Categories (game_id = lastval from above)
INSERT INTO goblin_ranking_categories (game_id, name, sort_order) VALUES
  (currval('goblin_ranking_games_id_seq'), 'Movies', 0),
  (currval('goblin_ranking_games_id_seq'), 'Stunts', 1),
  (currval('goblin_ranking_games_id_seq'), 'Sequences', 2);

-- Movies
INSERT INTO goblin_ranking_items (category_id, name, subtitle) VALUES
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Movies' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Mission: Impossible', '1996'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Movies' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Mission: Impossible 2', '2000'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Movies' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Mission: Impossible III', '2006'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Movies' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Mission: Impossible – Ghost Protocol', '2011'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Movies' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Mission: Impossible – Rogue Nation', '2015'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Movies' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Mission: Impossible – Fallout', '2018'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Movies' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Mission: Impossible – Dead Reckoning', '2023');

-- Stunts
INSERT INTO goblin_ranking_items (category_id, name, subtitle) VALUES
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Langley ceiling hang', 'MI'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Aquarium restaurant explosion', 'MI'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Channel Tunnel helicopter chase', 'MI'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Rock climbing free solo', 'MI:2'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Motorcycle joust', 'MI:2'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Vatican infiltration', 'MI:III'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Shanghai factory swing', 'MI:III'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Burj Khalifa climb', 'Ghost Protocol'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Mumbai parking garage chase', 'Ghost Protocol'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Plane door hang (takeoff)', 'Rogue Nation'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Morocco motorcycle chase', 'Rogue Nation'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Underwater Torus breach', 'Rogue Nation'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'HALO jump', 'Fallout'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Helicopter canyon chase', 'Fallout'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Paris motorcycle chase', 'Fallout'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Kashmir cliff fight', 'Fallout'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Motorcycle cliff jump', 'Dead Reckoning'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Orient Express train roof fight', 'Dead Reckoning');

-- Sequences
INSERT INTO goblin_ranking_items (category_id, name, subtitle) VALUES
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'NOC list theft (embassy)', 'MI'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Bible reveal / mole hunt', 'MI'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Seville nightclub infiltration', 'MI:2'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Chimera lab break-in', 'MI:2'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Bridge ambush / Davian capture', 'MI:III'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Shanghai rooftop run', 'MI:III'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Kremlin infiltration', 'Ghost Protocol'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Sandstorm pursuit', 'Ghost Protocol'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Vienna opera house', 'Rogue Nation'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'London pursuit / glass box', 'Rogue Nation'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Lane interrogation (The Syndicate reveal)', 'Rogue Nation'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Belfast bathroom fight', 'Fallout'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Kashmir nuclear deactivation', 'Fallout'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Airport runway standoff', 'Dead Reckoning'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Venice chase', 'Dead Reckoning'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Rome car chase (Fiat)', 'Dead Reckoning');
