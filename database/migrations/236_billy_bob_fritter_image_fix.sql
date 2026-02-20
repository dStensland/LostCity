-- Replace temporary place photo with a direct image of Sheriff Billy Bob Fritter.

UPDATE venues
SET image_url = 'https://live.staticflickr.com/2525/3981824129_007c256c9e_b.jpg'
WHERE slug = 'monster-mansion-monsters';
