-- Remove Tiny Doors reference from Hard in Da Paint track description
-- (per request from Tiny Doors ATL to not be included)

UPDATE explore_tracks
SET description = 'Krog Tunnel, BeltLine murals, gallery crawls, and the street art that makes Atlanta a canvas.'
WHERE slug = 'hard-in-da-paint';
