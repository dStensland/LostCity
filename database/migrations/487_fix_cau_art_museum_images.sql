-- Fix broken Google Places image for Clark Atlanta University Art Museum
-- The old URL returns 403 (expired Google Places photo token)

-- Venue: gallery interior photo from AUC Art Collective
UPDATE venues
SET image_url = 'https://aucartcollective.org/wp-content/uploads/2020/05/img_1048-w413.jpg'
WHERE id = 304;

-- Event: official CAU exhibition promo for "Uncommon Nature"
UPDATE events
SET image_url = 'https://www.cau.edu/sites/default/files/styles/large/public/2026-02/IG_Dates_v2.jpg.webp?itok=wcYfiQXM'
WHERE id = 134399;
