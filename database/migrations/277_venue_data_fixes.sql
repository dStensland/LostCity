-- 277: Venue data fixes from post-redesign audit
-- Stone Mountain Park: add description (was NULL, only had short_description)
-- High Museum: set price_level to 3 (general admission ~$23.50)
-- Terminal West: clean up scraped parking_note dump

-- Stone Mountain Park description
UPDATE venues SET description = 'A 3,200-acre park surrounding the world''s largest exposed granite monolith. Features hiking trails, a scenic railroad, a sky-ride to the summit, and a seasonal laser light show projected onto the mountain''s north face. The park encompasses a lake, golf courses, campgrounds, and the largest bas-relief carving in the world.'
WHERE slug = 'stone-mountain-park';

-- High Museum price_level (was NULL, showing as "Free" — actually ~$23.50)
UPDATE venues SET price_level = 3
WHERE slug = 'high-museum-of-art';

-- Terminal West parking_note (was multi-paragraph scrape dump)
UPDATE venues SET parking_note = 'Parking deck adjacent to venue. Paid parking.'
WHERE slug = 'terminal-west';
