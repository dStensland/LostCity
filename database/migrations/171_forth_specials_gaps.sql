-- Migration 171: Fix specials gaps from corridor research
-- 1. Move Clermont specials from Hotel (781) to Lounge (825)
-- 2. Seed Bulldogs specials (574)
-- 3. Seed Rowdy Tiger brunch special (641)
-- 4. Seed Murphy's wine specials (1161)
-- 5. Seed New Realm Brewing events (925)
-- 6. Seed Atkins Park happy hour (1691)

-- ============================================================
-- 1. CLERMONT FIX: Move specials from Hotel to Lounge
-- ============================================================
UPDATE venue_specials
SET venue_id = 825  -- Clermont Lounge
WHERE venue_id = 781  -- The Clermont Hotel
  AND title IN ('Karaoke Night', 'Disco Saturday Nights');

-- ============================================================
-- 2. BULLDOGS (574) — Midtown bar
-- ============================================================
INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, time_end, price_note, confidence, source_url)
VALUES
  (574, '$2 Tequila Shots', 'daily_special', 'Recurring tequila shot deal', NULL, NULL, NULL, '$2 tequila shots', 'low', 'https://www.instagram.com/bulldogsatlanta/'),
  (574, '$2 Shots & Tacos', 'daily_special', 'Recurring tacos and shots deal', NULL, NULL, NULL, '$2 shots & tacos', 'low', 'https://www.instagram.com/bulldogsatlanta/'),
  (574, 'Karaoke Night', 'event_night', 'Weekly karaoke', NULL, '21:00', NULL, NULL, 'low', 'https://www.instagram.com/bulldogsatlanta/'),
  (574, 'R&B Night', 'event_night', 'Weekly R&B night with DJ', NULL, '21:00', NULL, NULL, 'low', 'https://www.instagram.com/bulldogsatlanta/')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. ROWDY TIGER (641) — Renaissance Hotel restaurant
-- ============================================================
INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, time_end, price_note, confidence, source_url)
VALUES
  (641, 'Bottomless Mimosas Brunch', 'brunch', 'Weekend brunch with bottomless mimosas', ARRAY[6,7], '10:00', '14:00', '$18 bottomless mimosas', 'low', NULL)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. MURPHY'S (1161) — Virginia-Highland restaurant
-- ============================================================
INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, time_end, price_note, confidence, source_url)
VALUES
  (1161, 'Wine Shop Happy Hour', 'happy_hour', 'Happy hour in the wine shop area', NULL, NULL, NULL, 'Half-price wine select nights', 'low', 'https://www.murphys-atlanta-restaurant.com'),
  (1161, 'Sommelier Wine Tasting', 'event_night', 'Weekly sommelier-led wine tasting', ARRAY[4], NULL, NULL, NULL, 'medium', 'https://www.murphys-atlanta-restaurant.com'),
  (1161, 'Monthly Wine Dinner', 'event_night', 'Monthly curated wine dinner pairing', NULL, NULL, NULL, NULL, 'medium', 'https://www.murphys-atlanta-restaurant.com')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. NEW REALM BREWING (925) — BeltLine brewery
-- ============================================================
INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, time_end, price_note, confidence, source_url)
VALUES
  (925, 'Trivia Night', 'event_night', 'Weekly trivia at the brewery', NULL, '19:00', '21:00', NULL, 'low', 'https://www.newrealmbrewing.com'),
  (925, 'Bingo Night', 'event_night', 'Weekly bingo at the brewery', NULL, '19:00', NULL, NULL, 'low', 'https://www.newrealmbrewing.com'),
  (925, 'Atlanta United Watch Party', 'event_night', 'Atlanta United match screenings on the big screens', NULL, NULL, NULL, NULL, 'low', 'https://www.newrealmbrewing.com')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. ATKINS PARK (1691) — Virginia-Highland bar/restaurant
-- ============================================================
INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, time_end, price_note, confidence, source_url)
VALUES
  (1691, 'Happy Hour', 'happy_hour', 'Daily happy hour at Atlanta''s oldest continuously licensed tavern (since 1922)', ARRAY[1,2,3,4,5], '17:00', '19:00', NULL, 'low', 'https://www.atkinspark.com'),
  (1691, 'Weekend Brunch', 'brunch', 'Saturday and Sunday brunch', ARRAY[6,7], '10:00', '15:00', NULL, 'low', 'https://www.atkinspark.com')
ON CONFLICT DO NOTHING;


-- DOWN
-- UPDATE venue_specials SET venue_id = 781 WHERE venue_id = 825 AND title IN ('Karaoke Night', 'Disco Saturday Nights');
-- DELETE FROM venue_specials WHERE venue_id IN (574, 641, 1161, 925, 1691) AND confidence IN ('low', 'medium');
