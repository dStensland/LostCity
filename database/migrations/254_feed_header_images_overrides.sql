-- Fill coverage gaps in feed headers:
-- 1. Hero images + accent colors for all 35 base day×slot headers
-- 2. Rain overrides for Fri/Sat/Sun (highest behavioral impact)
-- 3. Nice weather overrides for weekend daytime
-- 4. Top 5 holiday overrides (Halloween, NYE, July 4th, Thanksgiving, Christmas)

DO $$
DECLARE
  v_portal_id UUID;
BEGIN
  SELECT id INTO v_portal_id FROM portals WHERE slug = 'atlanta' LIMIT 1;
  IF v_portal_id IS NULL THEN RETURN; END IF;

  -- =========================================================================
  -- 1. HERO IMAGES + ACCENT COLORS on base headers
  -- =========================================================================

  -- Morning slots: Jackson St Bridge (warm orange sunrise accent)
  UPDATE portal_feed_headers SET
    hero_image_url = '/portals/atlanta/jackson-st-bridge.jpg',
    accent_color = 'var(--gold)'
  WHERE portal_id = v_portal_id AND priority = 10
    AND conditions->>'time_slots' = '["morning"]';

  -- Midday slots: Skyline candidate 1 (coral accent)
  UPDATE portal_feed_headers SET
    hero_image_url = '/portals/atlanta/skyline-candidate-1.jpg',
    accent_color = 'var(--coral)'
  WHERE portal_id = v_portal_id AND priority = 10
    AND conditions->>'time_slots' = '["midday"]';

  -- Happy hour slots: Skyline candidate 2 (gold accent)
  UPDATE portal_feed_headers SET
    hero_image_url = '/portals/atlanta/skyline-candidate-2.jpg',
    accent_color = 'var(--gold)'
  WHERE portal_id = v_portal_id AND priority = 10
    AND conditions->>'time_slots' = '["happy_hour"]';

  -- Evening slots: Header BG (coral accent)
  UPDATE portal_feed_headers SET
    hero_image_url = '/portals/atlanta/header-bg.jpg',
    accent_color = 'var(--coral)'
  WHERE portal_id = v_portal_id AND priority = 10
    AND conditions->>'time_slots' = '["evening"]';

  -- Late night slots: Header BG Skyline (magenta accent)
  UPDATE portal_feed_headers SET
    hero_image_url = '/portals/atlanta/header-bg-skyline.jpg',
    accent_color = 'var(--neon-magenta)'
  WHERE portal_id = v_portal_id AND priority = 10
    AND conditions->>'time_slots' = '["late_night"]';

  -- Weekend hero image variety: override the time-slot defaults
  -- Saturday morning: Crown Boa (brunch energy)
  UPDATE portal_feed_headers SET
    hero_image_url = '/portals/atlanta/crown-boa.jpg'
  WHERE portal_id = v_portal_id AND slug = 'sat-morning';

  -- Saturday evening: Crown Westin (peak night energy)
  UPDATE portal_feed_headers SET
    hero_image_url = '/portals/atlanta/crown-westin.jpg'
  WHERE portal_id = v_portal_id AND slug = 'sat-evening';

  -- Sunday morning: Skyline collage (relaxed weekend)
  UPDATE portal_feed_headers SET
    hero_image_url = '/portals/atlanta/header-skyline-collage.jpg'
  WHERE portal_id = v_portal_id AND slug = 'sun-morning';

  -- Friday evening: Crown Altitude (going out energy)
  UPDATE portal_feed_headers SET
    hero_image_url = '/portals/atlanta/crown-altitude.jpg'
  WHERE portal_id = v_portal_id AND slug = 'fri-evening';

  -- Friday late night: Header skyline preview
  UPDATE portal_feed_headers SET
    hero_image_url = '/portals/atlanta/header-skyline-preview.jpg'
  WHERE portal_id = v_portal_id AND slug = 'fri-night';

  -- Saturday late night: Crown Altitude
  UPDATE portal_feed_headers SET
    hero_image_url = '/portals/atlanta/crown-altitude.jpg'
  WHERE portal_id = v_portal_id AND slug = 'sat-night';

  -- =========================================================================
  -- 2. RAIN OVERRIDES (priority 5, beats base at 10)
  --    Fri/Sat/Sun — 10 cells with highest behavioral impact
  -- =========================================================================

  -- Friday evening rain
  INSERT INTO portal_feed_headers (portal_id, slug, name, is_active, priority, show_on_days, conditions, headline, subtitle, hero_image_url, accent_color)
  VALUES (v_portal_id, 'fri-evening-rain', 'Friday Evening Rain', TRUE, 5,
    '{friday}', '{"time_slots":["evening"],"weather_signals":["rain"]}',
    'Rainy Friday? Indoor vibes are underrated.',
    'Comedy clubs, cozy bars, and live music — no umbrella needed',
    '/portals/atlanta/header-bg-rain-crop.jpg', '#60a5fa');

  -- Friday happy hour rain
  INSERT INTO portal_feed_headers (portal_id, slug, name, is_active, priority, show_on_days, conditions, headline, subtitle, hero_image_url, accent_color)
  VALUES (v_portal_id, 'fri-afternoon-rain', 'Friday Afternoon Rain', TRUE, 5,
    '{friday}', '{"time_slots":["happy_hour"],"weather_signals":["rain"]}',
    'Skip the patio — find your rainy day happy hour',
    'Cozy bars with great drinks and no wet shoes',
    '/portals/atlanta/header-bg-rain-crop.jpg', '#60a5fa');

  -- Saturday morning rain
  INSERT INTO portal_feed_headers (portal_id, slug, name, is_active, priority, show_on_days, conditions, headline, subtitle, hero_image_url, accent_color)
  VALUES (v_portal_id, 'sat-morning-rain', 'Saturday Morning Rain', TRUE, 5,
    '{saturday}', '{"time_slots":["morning"],"weather_signals":["rain"]}',
    'Rainy Saturday — brunch and museums it is',
    'Skip the farmers market, grab a table somewhere warm',
    '/portals/atlanta/header-bg-rain-crop.jpg', '#60a5fa');

  -- Saturday midday rain
  INSERT INTO portal_feed_headers (portal_id, slug, name, is_active, priority, show_on_days, conditions, headline, subtitle, hero_image_url, accent_color)
  VALUES (v_portal_id, 'sat-lunch-rain', 'Saturday Midday Rain', TRUE, 5,
    '{saturday}', '{"time_slots":["midday"],"weather_signals":["rain"]}',
    'Rain check on the BeltLine — indoor plans instead',
    'Museums, galleries, and long lunch spots',
    '/portals/atlanta/header-bg-rain-crop.jpg', '#60a5fa');

  -- Saturday evening rain
  INSERT INTO portal_feed_headers (portal_id, slug, name, is_active, priority, show_on_days, conditions, headline, subtitle, hero_image_url, accent_color)
  VALUES (v_portal_id, 'sat-evening-rain', 'Saturday Evening Rain', TRUE, 5,
    '{saturday}', '{"time_slots":["evening"],"weather_signals":["rain"]}',
    'Rain won''t stop Saturday night',
    'The city''s still going — comedy, music, and cozy bars',
    '/portals/atlanta/header-bg-rain-crop.jpg', 'var(--neon-magenta)');

  -- Saturday happy hour rain
  INSERT INTO portal_feed_headers (portal_id, slug, name, is_active, priority, show_on_days, conditions, headline, subtitle, hero_image_url, accent_color)
  VALUES (v_portal_id, 'sat-afternoon-rain', 'Saturday Afternoon Rain', TRUE, 5,
    '{saturday}', '{"time_slots":["happy_hour"],"weather_signals":["rain"]}',
    'Rainy afternoon — cozy up with a cocktail',
    'Indoor happy hours and speakeasy vibes',
    '/portals/atlanta/header-bg-rain-crop.jpg', '#60a5fa');

  -- Sunday morning rain
  INSERT INTO portal_feed_headers (portal_id, slug, name, is_active, priority, show_on_days, conditions, headline, subtitle, hero_image_url, accent_color)
  VALUES (v_portal_id, 'sun-morning-rain', 'Sunday Morning Rain', TRUE, 5,
    '{sunday}', '{"time_slots":["morning"],"weather_signals":["rain"]}',
    'Rainy Sunday — the perfect brunch excuse',
    'Stay in, order another mimosa, read a book',
    '/portals/atlanta/header-bg-rain-crop.jpg', '#60a5fa');

  -- Sunday midday rain
  INSERT INTO portal_feed_headers (portal_id, slug, name, is_active, priority, show_on_days, conditions, headline, subtitle, hero_image_url, accent_color)
  VALUES (v_portal_id, 'sun-lunch-rain', 'Sunday Midday Rain', TRUE, 5,
    '{sunday}', '{"time_slots":["midday"],"weather_signals":["rain"]}',
    'Gray Sunday? Atlanta''s got indoor magic',
    'Museums, bowling, coffee shops, and matinees',
    '/portals/atlanta/header-bg-rain-crop.jpg', '#60a5fa');

  -- =========================================================================
  -- 3. NICE WEATHER OVERRIDES (weekend daytime)
  -- =========================================================================

  -- Saturday morning nice
  INSERT INTO portal_feed_headers (portal_id, slug, name, is_active, priority, show_on_days, conditions, headline, subtitle, hero_image_url, accent_color)
  VALUES (v_portal_id, 'sat-morning-nice', 'Saturday Morning Nice', TRUE, 5,
    '{saturday}', '{"time_slots":["morning"],"weather_signals":["nice"]}',
    'Perfect Saturday morning — get outside',
    'Farmers markets, BeltLine walks, and patio brunch',
    '/portals/atlanta/jackson-st-bridge.jpg', '#4ade80');

  -- Saturday midday nice
  INSERT INTO portal_feed_headers (portal_id, slug, name, is_active, priority, show_on_days, conditions, headline, subtitle, hero_image_url, accent_color)
  VALUES (v_portal_id, 'sat-lunch-nice', 'Saturday Midday Nice', TRUE, 5,
    '{saturday}', '{"time_slots":["midday"],"weather_signals":["nice"]}',
    'Too nice to be inside, Atlanta',
    'Parks, patios, and outdoor festivals',
    '/portals/atlanta/skyline-candidate-1.jpg', '#4ade80');

  -- Sunday morning nice
  INSERT INTO portal_feed_headers (portal_id, slug, name, is_active, priority, show_on_days, conditions, headline, subtitle, hero_image_url, accent_color)
  VALUES (v_portal_id, 'sun-morning-nice', 'Sunday Morning Nice', TRUE, 5,
    '{sunday}', '{"time_slots":["morning"],"weather_signals":["nice"]}',
    'Beautiful Sunday — patio brunch and sunshine',
    'Grab a table outside, you''ve earned it',
    '/portals/atlanta/skyline-candidate-2.jpg', '#4ade80');

  -- Sunday midday nice
  INSERT INTO portal_feed_headers (portal_id, slug, name, is_active, priority, show_on_days, conditions, headline, subtitle, hero_image_url, accent_color)
  VALUES (v_portal_id, 'sun-lunch-nice', 'Sunday Midday Nice', TRUE, 5,
    '{sunday}', '{"time_slots":["midday"],"weather_signals":["nice"]}',
    'Sunday Funday in the sun',
    'Day drinks, BeltLine strolls, and outdoor events',
    '/portals/atlanta/skyline-candidate-1.jpg', '#4ade80');

  -- =========================================================================
  -- 4. HOLIDAY OVERRIDES (priority 3, beats weather at 5)
  --    Evening + late_night for the big 5
  -- =========================================================================

  -- Halloween evening
  INSERT INTO portal_feed_headers (portal_id, slug, name, is_active, priority, show_on_days, conditions, headline, subtitle, hero_image_url, accent_color)
  VALUES (v_portal_id, 'halloween-evening', 'Halloween Evening', TRUE, 3,
    NULL, '{"time_slots":["evening","late_night"],"holidays":["halloween"]}',
    'Happy Halloween, Atlanta',
    'Costume parties, haunted bars, and spooky events all night',
    '/portals/atlanta/header-bg-skyline.jpg', '#fb923c');

  -- New Year's Eve evening
  INSERT INTO portal_feed_headers (portal_id, slug, name, is_active, priority, show_on_days, conditions, headline, subtitle, hero_image_url, accent_color)
  VALUES (v_portal_id, 'nye-evening', 'NYE Evening', TRUE, 3,
    NULL, '{"time_slots":["evening","late_night"],"holidays":["new_years_eve"]}',
    'Ring in the new year, Atlanta',
    'Rooftop parties, live countdowns, and midnight toasts',
    '/portals/atlanta/crown-westin.jpg', 'var(--gold)');

  -- New Year's Day morning
  INSERT INTO portal_feed_headers (portal_id, slug, name, is_active, priority, show_on_days, conditions, headline, subtitle, hero_image_url, accent_color)
  VALUES (v_portal_id, 'new-years-day', 'New Year''s Day', TRUE, 3,
    NULL, '{"time_slots":["morning","midday"],"holidays":["new_years_day"]}',
    'Happy New Year, Atlanta',
    'Brunch it off, grab coffee, and ease into the year',
    '/portals/atlanta/jackson-st-bridge.jpg', 'var(--gold)');

  -- July 4th
  INSERT INTO portal_feed_headers (portal_id, slug, name, is_active, priority, show_on_days, conditions, headline, subtitle, hero_image_url, accent_color)
  VALUES (v_portal_id, 'july-4th', 'Independence Day', TRUE, 3,
    NULL, '{"time_slots":["midday","happy_hour","evening","late_night"],"holidays":["independence_day"]}',
    'Happy Fourth, Atlanta',
    'Fireworks, cookouts, rooftop parties, and cold drinks',
    '/portals/atlanta/crown-altitude.jpg', '#f87171');

  -- Thanksgiving
  INSERT INTO portal_feed_headers (portal_id, slug, name, is_active, priority, show_on_days, conditions, headline, subtitle, hero_image_url, accent_color)
  VALUES (v_portal_id, 'thanksgiving', 'Thanksgiving', TRUE, 3,
    NULL, '{"time_slots":["morning","midday","happy_hour"],"holidays":["thanksgiving"]}',
    'Happy Thanksgiving, Atlanta',
    'Turkey trots, open restaurants, and things to do before dinner',
    '/portals/atlanta/header-skyline-collage.jpg', '#fb923c');

  -- Thanksgiving evening (bar energy)
  INSERT INTO portal_feed_headers (portal_id, slug, name, is_active, priority, show_on_days, conditions, headline, subtitle, hero_image_url, accent_color)
  VALUES (v_portal_id, 'thanksgiving-night', 'Thanksgiving Night', TRUE, 3,
    NULL, '{"time_slots":["evening","late_night"],"holidays":["thanksgiving"]}',
    'Thanksgiving night — the biggest bar night of the year',
    'Hometown reunions, late-night spots, and the Wednesday energy continues',
    '/portals/atlanta/header-bg-skyline.jpg', '#fb923c');

  -- Christmas Eve + Christmas (cozy vibes)
  INSERT INTO portal_feed_headers (portal_id, slug, name, is_active, priority, show_on_days, conditions, headline, subtitle, hero_image_url, accent_color)
  VALUES (v_portal_id, 'christmas-eve', 'Christmas Eve', TRUE, 3,
    NULL, '{"holidays":["christmas_eve"]}',
    'Merry Christmas Eve, Atlanta',
    'Holiday lights, open restaurants, and festive events',
    '/portals/atlanta/header-skyline-collage.jpg', '#f87171');

  INSERT INTO portal_feed_headers (portal_id, slug, name, is_active, priority, show_on_days, conditions, headline, subtitle, hero_image_url, accent_color)
  VALUES (v_portal_id, 'christmas-day', 'Christmas Day', TRUE, 3,
    NULL, '{"holidays":["christmas"]}',
    'Merry Christmas, Atlanta',
    'What''s open today — movies, Chinese food, and holiday walks',
    '/portals/atlanta/header-skyline-collage.jpg', '#f87171');

END $$;
