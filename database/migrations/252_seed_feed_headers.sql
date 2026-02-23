-- Seed default feed headers for the Atlanta portal.
-- 7 days × 5 time slots = 35 editorial headers.
-- Priority 10 so they beat the fallback (999) but lose to any special-occasion header.
-- All use show_on_days + conditions.time_slots for matching.
-- Headline supports {{display_name}} and {{city_name}} template vars.

DO $$
DECLARE
  v_portal_id UUID;
BEGIN
  SELECT id INTO v_portal_id FROM portals WHERE slug = 'atlanta' LIMIT 1;
  IF v_portal_id IS NULL THEN
    RAISE NOTICE 'No atlanta portal found, skipping seed';
    RETURN;
  END IF;

  -- =========================================================================
  -- MONDAY
  -- =========================================================================
  INSERT INTO portal_feed_headers (portal_id, slug, name, is_active, priority, show_on_days, conditions, headline, subtitle)
  VALUES
    (v_portal_id, 'mon-morning', 'Monday Morning', TRUE, 10,
     '{monday}', '{"time_slots":["morning"]}',
     'Start the week right, Atlanta',
     'Coffee, classes, and a clear head'),

    (v_portal_id, 'mon-lunch', 'Monday Lunch', TRUE, 10,
     '{monday}', '{"time_slots":["midday"]}',
     'Monday lunch break',
     'Fuel up — the week is just getting started'),

    (v_portal_id, 'mon-afternoon', 'Monday Afternoon', TRUE, 10,
     '{monday}', '{"time_slots":["happy_hour"]}',
     'Happy hour on a Monday? Absolutely.',
     'You earned it — find drink specials and live music'),

    (v_portal_id, 'mon-evening', 'Monday Evening', TRUE, 10,
     '{monday}', '{"time_slots":["evening"]}',
     'Monday night in Atlanta',
     'Trivia nights, open mics, and low-key hangs'),

    (v_portal_id, 'mon-night', 'Monday Night', TRUE, 10,
     '{monday}', '{"time_slots":["late_night"]}',
     'Still out on a Monday?',
     'Late-night eats and the spots that never sleep');

  -- =========================================================================
  -- TUESDAY
  -- =========================================================================
  INSERT INTO portal_feed_headers (portal_id, slug, name, is_active, priority, show_on_days, conditions, headline, subtitle)
  VALUES
    (v_portal_id, 'tue-morning', 'Tuesday Morning', TRUE, 10,
     '{tuesday}', '{"time_slots":["morning"]}',
     'Good morning, Atlanta',
     'Coffee shops are calling — here''s what''s happening today'),

    (v_portal_id, 'tue-lunch', 'Tuesday Lunch', TRUE, 10,
     '{tuesday}', '{"time_slots":["midday"]}',
     'Happy Taco Tuesday',
     'Taco specials, lunch deals, and afternoon plans'),

    (v_portal_id, 'tue-afternoon', 'Tuesday Afternoon', TRUE, 10,
     '{tuesday}', '{"time_slots":["happy_hour"]}',
     'Taco Tuesday happy hour',
     'Margarita specials and taco spots across the city'),

    (v_portal_id, 'tue-evening', 'Tuesday Evening', TRUE, 10,
     '{tuesday}', '{"time_slots":["evening"]}',
     'Tuesday night out',
     'Taco specials, trivia, and under-the-radar events'),

    (v_portal_id, 'tue-night', 'Tuesday Night', TRUE, 10,
     '{tuesday}', '{"time_slots":["late_night"]}',
     'Late night Tuesday',
     'The city''s still going — find what''s open');

  -- =========================================================================
  -- WEDNESDAY
  -- =========================================================================
  INSERT INTO portal_feed_headers (portal_id, slug, name, is_active, priority, show_on_days, conditions, headline, subtitle)
  VALUES
    (v_portal_id, 'wed-morning', 'Wednesday Morning', TRUE, 10,
     '{wednesday}', '{"time_slots":["morning"]}',
     'Halfway there, Atlanta',
     'Hump day — grab a coffee and plan your evening'),

    (v_portal_id, 'wed-lunch', 'Wednesday Lunch', TRUE, 10,
     '{wednesday}', '{"time_slots":["midday"]}',
     'Wine Wednesday starts early',
     'Lunch spots and wine bars worth your afternoon'),

    (v_portal_id, 'wed-afternoon', 'Wednesday Afternoon', TRUE, 10,
     '{wednesday}', '{"time_slots":["happy_hour"]}',
     'Wine Wednesday vibes',
     'Wine specials, tastings, and happy hour deals'),

    (v_portal_id, 'wed-evening', 'Wednesday Evening', TRUE, 10,
     '{wednesday}', '{"time_slots":["evening"]}',
     'Wednesday night — the midweek move',
     'Live music, comedy, and wine bar specials'),

    (v_portal_id, 'wed-night', 'Wednesday Night', TRUE, 10,
     '{wednesday}', '{"time_slots":["late_night"]}',
     'Wednesday late night',
     'Midweek nightlife for the adventurous');

  -- =========================================================================
  -- THURSDAY
  -- =========================================================================
  INSERT INTO portal_feed_headers (portal_id, slug, name, is_active, priority, show_on_days, conditions, headline, subtitle)
  VALUES
    (v_portal_id, 'thu-morning', 'Thursday Morning', TRUE, 10,
     '{thursday}', '{"time_slots":["morning"]}',
     'Almost Friday, Atlanta',
     'Plan your weekend while the coffee''s hot'),

    (v_portal_id, 'thu-lunch', 'Thursday Lunch', TRUE, 10,
     '{thursday}', '{"time_slots":["midday"]}',
     'Thursday — weekend''s almost here',
     'Lunch spots and a look at what''s coming up'),

    (v_portal_id, 'thu-afternoon', 'Thursday Afternoon', TRUE, 10,
     '{thursday}', '{"time_slots":["happy_hour"]}',
     'Thirsty Thursday is here',
     'Happy hour deals and tonight''s best events'),

    (v_portal_id, 'thu-evening', 'Thursday Evening', TRUE, 10,
     '{thursday}', '{"time_slots":["evening"]}',
     'Thursday night in Atlanta',
     'The weekend starts now — live shows, comedy, and nightlife'),

    (v_portal_id, 'thu-night', 'Thursday Night', TRUE, 10,
     '{thursday}', '{"time_slots":["late_night"]}',
     'Thirsty Thursday late night',
     'The warm-up to the weekend is in full swing');

  -- =========================================================================
  -- FRIDAY
  -- =========================================================================
  INSERT INTO portal_feed_headers (portal_id, slug, name, is_active, priority, show_on_days, conditions, headline, subtitle)
  VALUES
    (v_portal_id, 'fri-morning', 'Friday Morning', TRUE, 10,
     '{friday}', '{"time_slots":["morning"]}',
     'It''s Friday — make plans',
     'The weekend is here. What are you getting into?'),

    (v_portal_id, 'fri-lunch', 'Friday Lunch', TRUE, 10,
     '{friday}', '{"time_slots":["midday"]}',
     'Friday afternoon in Atlanta',
     'Long lunches, early happy hours, and tonight''s lineup'),

    (v_portal_id, 'fri-afternoon', 'Friday Afternoon', TRUE, 10,
     '{friday}', '{"time_slots":["happy_hour"]}',
     'Friday happy hour — where to?',
     'Specials, rooftop bars, and the best spots to start your night'),

    (v_portal_id, 'fri-evening', 'Friday Evening', TRUE, 10,
     '{friday}', '{"time_slots":["evening"]}',
     'Friday night in Atlanta',
     'Live music, comedy, nightlife — the city is yours'),

    (v_portal_id, 'fri-night', 'Friday Night', TRUE, 10,
     '{friday}', '{"time_slots":["late_night"]}',
     'Friday night is alive',
     'Late shows, after-parties, and late-night eats');

  -- =========================================================================
  -- SATURDAY
  -- =========================================================================
  INSERT INTO portal_feed_headers (portal_id, slug, name, is_active, priority, show_on_days, conditions, headline, subtitle)
  VALUES
    (v_portal_id, 'sat-morning', 'Saturday Morning', TRUE, 10,
     '{saturday}', '{"time_slots":["morning"]}',
     'Saturday morning, Atlanta',
     'Brunch, farmers markets, and the best way to start the weekend'),

    (v_portal_id, 'sat-lunch', 'Saturday Lunch', TRUE, 10,
     '{saturday}', '{"time_slots":["midday"]}',
     'Saturday afternoon adventures',
     'Explore the city — festivals, markets, and outdoor fun'),

    (v_portal_id, 'sat-afternoon', 'Saturday Afternoon', TRUE, 10,
     '{saturday}', '{"time_slots":["happy_hour"]}',
     'Saturday happy hour',
     'Rooftop bars, day parties, and tonight''s big events'),

    (v_portal_id, 'sat-evening', 'Saturday Evening', TRUE, 10,
     '{saturday}', '{"time_slots":["evening"]}',
     'Saturday night — the city''s alive',
     'The biggest night of the week. Go find your thing.'),

    (v_portal_id, 'sat-night', 'Saturday Night', TRUE, 10,
     '{saturday}', '{"time_slots":["late_night"]}',
     'Saturday night is just getting started',
     'Late shows, DJ sets, and after-hours spots');

  -- =========================================================================
  -- SUNDAY
  -- =========================================================================
  INSERT INTO portal_feed_headers (portal_id, slug, name, is_active, priority, show_on_days, conditions, headline, subtitle)
  VALUES
    (v_portal_id, 'sun-morning', 'Sunday Morning', TRUE, 10,
     '{sunday}', '{"time_slots":["morning"]}',
     'Easy Sunday morning',
     'Brunch, coffee, and a slow start to the day'),

    (v_portal_id, 'sun-lunch', 'Sunday Lunch', TRUE, 10,
     '{sunday}', '{"time_slots":["midday"]}',
     'Sunday Funday',
     'Day drinking, live music, and soaking up the weekend'),

    (v_portal_id, 'sun-afternoon', 'Sunday Afternoon', TRUE, 10,
     '{sunday}', '{"time_slots":["happy_hour"]}',
     'Sunday wind-down',
     'Chill spots, happy hours, and one last weekend hurrah'),

    (v_portal_id, 'sun-evening', 'Sunday Evening', TRUE, 10,
     '{sunday}', '{"time_slots":["evening"]}',
     'Sunday night — ease into the week',
     'Low-key events, comedy, and a good meal'),

    (v_portal_id, 'sun-night', 'Sunday Night', TRUE, 10,
     '{sunday}', '{"time_slots":["late_night"]}',
     'Sunday late night',
     'Industry night and the spots that keep going');

END $$;
