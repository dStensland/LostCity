-- Replace temporary place photo with a direct image of Sheriff Billy Bob Fritter.
-- Mirrors database/migrations/236_billy_bob_fritter_image_fix.sql.

UPDATE venues
SET image_url = 'https://live.staticflickr.com/2525/3981824129_007c256c9e_b.jpg'
WHERE slug = 'monster-mansion-monsters';
