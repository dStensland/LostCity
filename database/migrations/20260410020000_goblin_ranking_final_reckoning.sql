-- Add Mission: Impossible – The Final Reckoning (2025) to all ranking categories
-- The seed migration only covered through Dead Reckoning (2023)

-- Movie entry
INSERT INTO goblin_ranking_items (category_id, name, subtitle, image_url) VALUES
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Movies' AND game_id = (SELECT id FROM goblin_ranking_games WHERE name = 'Mission: Impossible')),
   'Mission: Impossible – The Final Reckoning', '2025',
   'https://image.tmdb.org/t/p/w500/z53D72EAOxGRqdr7KXXWp9dJiDe.jpg');

-- Stunts
INSERT INTO goblin_ranking_items (category_id, name, subtitle, image_url) VALUES
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = (SELECT id FROM goblin_ranking_games WHERE name = 'Mission: Impossible')),
   'Submarine torpedo tube escape', 'The Final Reckoning',
   'https://image.tmdb.org/t/p/w500/538U9snNc2fpnOmYXAPUh3zn31H.jpg'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = (SELECT id FROM goblin_ranking_games WHERE name = 'Mission: Impossible')),
   'Biplane wing walk', 'The Final Reckoning',
   'https://image.tmdb.org/t/p/w500/xPNDRM50a58uvv1il2GVZrtWjkZ.jpg'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = (SELECT id FROM goblin_ranking_games WHERE name = 'Mission: Impossible')),
   'Freefall without parachute', 'The Final Reckoning',
   'https://image.tmdb.org/t/p/w500/rwwkWkmecrH9glp5XJGZx3nPLhW.jpg');

-- Sequences
INSERT INTO goblin_ranking_items (category_id, name, subtitle, image_url) VALUES
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = (SELECT id FROM goblin_ranking_games WHERE name = 'Mission: Impossible')),
   'Entity confrontation', 'The Final Reckoning',
   'https://image.tmdb.org/t/p/w500/pcw4m5WjuQvZZDvVG8UDIp2uWeR.jpg'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = (SELECT id FROM goblin_ranking_games WHERE name = 'Mission: Impossible')),
   'Submarine opening', 'The Final Reckoning',
   'https://image.tmdb.org/t/p/w500/7ONMDhnErvpkKvkZqM82ud7bzcT.jpg');

-- Clean up any user-added malformed Final Reckoning entries
-- (lowercase, no image, no subtitle) that were crowd-sourced
DELETE FROM goblin_ranking_entries WHERE item_id IN (
  SELECT id FROM goblin_ranking_items
  WHERE LOWER(name) LIKE '%final reckoning%'
    AND image_url IS NULL
    AND category_id = (SELECT id FROM goblin_ranking_categories WHERE name = 'Movies' AND game_id = (SELECT id FROM goblin_ranking_games WHERE name = 'Mission: Impossible'))
);
DELETE FROM goblin_ranking_items
WHERE LOWER(name) LIKE '%final reckoning%'
  AND image_url IS NULL
  AND category_id = (SELECT id FROM goblin_ranking_categories WHERE name = 'Movies' AND game_id = (SELECT id FROM goblin_ranking_games WHERE name = 'Mission: Impossible'));
