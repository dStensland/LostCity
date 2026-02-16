-- Remove Tiny Doors from Hard in Da Paint description — they asked not to be included
UPDATE explore_tracks
SET description = 'BeltLine murals, gallery crawls, and the street art that makes Atlanta a canvas.'
WHERE slug = 'hard-in-da-paint';
