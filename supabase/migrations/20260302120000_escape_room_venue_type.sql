-- Retype escape room venues from entertainment/attraction → escape_room
-- Escape rooms were seeded in migration 079 as entertainment/attraction;
-- the import_escape_rooms.py script also used entertainment_venue.
-- Now that escape_room is a first-class venue_type, normalize existing data.

-- Known Escape Game venues from migration 079
UPDATE venues
SET venue_type = 'escape_room'
WHERE slug IN (
  'the-escape-game-atlanta-battery',
  'the-escape-game-atlanta-interlock'
)
AND venue_type IN ('entertainment', 'attraction', 'entertainment_venue');

-- Bulk retype by name pattern for any escape room venues
-- that were categorized as entertainment/attraction/recreation
UPDATE venues
SET venue_type = 'escape_room'
WHERE (
  lower(name) LIKE '%escape room%'
  OR lower(name) LIKE '%escape game%'
  OR lower(name) LIKE '%breakout game%'
  OR lower(name) LIKE '%beat the room%'
  OR lower(name) LIKE '%quest quest%'
  OR lower(name) LIKE '%paranoia quest%'
  OR lower(name) LIKE '%big escape%'
  OR lower(name) LIKE '%60 out escape%'
  OR lower(name) LIKE '%all in adventures%'
)
AND venue_type IN ('entertainment', 'attraction', 'entertainment_venue', 'recreation')
AND venue_type != 'escape_room';

-- Mark these as experience destinations
UPDATE venues
SET is_experience = true,
    typical_duration_minutes = 75
WHERE venue_type = 'escape_room'
AND (is_experience IS NULL OR is_experience = false);
