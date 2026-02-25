-- Fix missing image for Compound Atlanta using a stable venue photo URL.

UPDATE venues
SET image_url = 'https://images.discotech.me/venue/None/9e0a6afc-46c6-43aa-826e-0a3ddd56950b.jpg'
WHERE slug = 'compound-atlanta';
