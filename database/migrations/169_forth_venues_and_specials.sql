-- Migration 169: FORTH Hotel Venue Records + Corridor Specials Seed
-- Creates FORTH's own F&B venues as real DB records, then seeds venue_specials
-- for FORTH venues + 28 corridor venues with confirmed specials data.
-- Research source: crawlers/data/forth_corridor_specials.md

-- ============================================================================
-- 1. FORTH HOTEL OWN VENUES
-- ============================================================================

-- Bar Premio (lobby, 1st floor — all-day cafe by day, wine bar by evening)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, website, description, vibes)
VALUES (
    'Bar Premio', 'bar-premio',
    '800 Rankin St NE', 'Old Fourth Ward', 'Atlanta', 'GA', '30308',
    33.7834, -84.3731,
    'bar',
    'https://www.forthatlanta.com/dine-drink/bar-premio',
    'All-day lobby bar at FORTH Hotel. La Colombe coffee by morning, Italian-inspired wine bar and cocktails by evening. Aperitivo hour daily 4-7pm.',
    ARRAY['upscale', 'cocktails', 'wine-bar', 'hotel']
) ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address, lat = EXCLUDED.lat, lng = EXCLUDED.lng,
    website = EXCLUDED.website, description = EXCLUDED.description, vibes = EXCLUDED.vibes;

-- Il Premio (ground floor — fine dining steakhouse)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, website, description, vibes)
VALUES (
    'Il Premio', 'il-premio',
    '800 Rankin St NE', 'Old Fourth Ward', 'Atlanta', 'GA', '30308',
    33.7834, -84.3731,
    'restaurant',
    'https://www.forthatlanta.com/dine-drink/il-premio',
    'Fine dining steakhouse at FORTH Hotel. USDA prime, A5 wagyu, raw bar, handmade pasta. Dinner nightly. Reservations via Resy.',
    ARRAY['upscale', 'fine-dining', 'date-night', 'hotel']
) ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address, lat = EXCLUDED.lat, lng = EXCLUDED.lng,
    website = EXCLUDED.website, description = EXCLUDED.description, vibes = EXCLUDED.vibes;

-- Elektra (4th floor — poolside Mediterranean)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, website, description, vibes)
VALUES (
    'Elektra', 'elektra-forth',
    '800 Rankin St NE', 'Old Fourth Ward', 'Atlanta', 'GA', '30308',
    33.7834, -84.3731,
    'restaurant',
    'https://www.forthatlanta.com/dine-drink/elektra',
    'Poolside Mediterranean restaurant at FORTH Hotel, 4th floor. Weekend brunch Sat-Sun 8am-2pm. Lunch Mon-Fri, dinner nightly. Reservations via Resy.',
    ARRAY['upscale', 'brunch', 'outdoor-seating', 'hotel']
) ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address, lat = EXCLUDED.lat, lng = EXCLUDED.lng,
    website = EXCLUDED.website, description = EXCLUDED.description, vibes = EXCLUDED.vibes;

-- Moonlight (16th floor rooftop)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, website, description, vibes)
VALUES (
    'Moonlight at FORTH', 'moonlight-forth',
    '800 Rankin St NE', 'Old Fourth Ward', 'Atlanta', 'GA', '30308',
    33.7834, -84.3731,
    'rooftop',
    'https://www.forthatlanta.com/dine-drink/moonlight',
    'Rooftop lounge on the 16th floor of FORTH Hotel. Cocktails, caviar bumps, light bites with Atlanta skyline views. DJs Fri-Sun. Reservations via Resy.',
    ARRAY['upscale', 'rooftop', 'cocktails', 'dj', 'views', 'date-night', 'hotel']
) ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address, lat = EXCLUDED.lat, lng = EXCLUDED.lng,
    website = EXCLUDED.website, description = EXCLUDED.description, vibes = EXCLUDED.vibes;

-- ============================================================================
-- 2. SEED VENUE SPECIALS — FORTH HOTEL VENUES
-- ============================================================================

-- Helper: get venue IDs by slug
DO $$
DECLARE
    v_bar_premio INTEGER;
    v_il_premio INTEGER;
    v_elektra INTEGER;
    v_moonlight INTEGER;
BEGIN
    SELECT id INTO v_bar_premio FROM venues WHERE slug = 'bar-premio';
    SELECT id INTO v_il_premio FROM venues WHERE slug = 'il-premio';
    SELECT id INTO v_elektra FROM venues WHERE slug = 'elektra-forth';
    SELECT id INTO v_moonlight FROM venues WHERE slug = 'moonlight-forth';

    -- Bar Premio: Aperitivo Hour (daily 4-7pm)
    INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, time_end, price_note, confidence, source_url)
    VALUES (v_bar_premio, 'Aperitivo Hour', 'happy_hour',
        'Italian-inspired cocktail hour with $11 spritzes and $14 negronis. Sicilian Spritz, Bianco Negroni, and more.',
        '{1,2,3,4,5,6,7}', '16:00', '19:00', '$11 spritzes, $14 negronis', 'high',
        'https://www.forthatlanta.com/dine-drink/bar-premio');

    -- Bar Premio: Vino & Vibes (2nd & 4th Saturday, 2-6pm)
    INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, time_end, price_note, confidence, source_url)
    VALUES (v_bar_premio, 'Vino & Vibes', 'recurring_deal',
        'Local DJs with wine and cocktails. Every 2nd and 4th Saturday.',
        '{6}', '14:00', '18:00', 'Complimentary', 'high',
        'https://www.forthatlanta.com/dine-drink/bar-premio');

    -- Bar Premio: Uncorked wine tasting
    INSERT INTO venue_specials (venue_id, title, type, description, price_note, confidence, source_url)
    VALUES (v_bar_premio, 'Uncorked Wine Tasting', 'recurring_deal',
        'Guided tasting of 4 wines with light bites. Recurring event.',
        '$45/person', 'high',
        'https://www.forthatlanta.com/dine-drink/bar-premio');

    -- Elektra: Weekend Brunch (Sat-Sun 8am-2pm)
    INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, time_end, confidence, source_url)
    VALUES (v_elektra, 'Weekend Brunch', 'brunch',
        'Poolside Mediterranean brunch. Olive oil pancakes, Turkish eggs, and more.',
        '{6,7}', '08:00', '14:00', 'high',
        'https://www.forthatlanta.com/dine-drink/elektra');

    -- Moonlight: "Wish You Were Here" DJ nights (Fri-Sat 9pm-close)
    INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, time_end, confidence, source_url)
    VALUES (v_moonlight, 'Wish You Were Here', 'event_night',
        'DJ sets on the rooftop every Friday and Saturday night.',
        '{5,6}', '21:00', '00:00', 'high',
        'https://www.forthatlanta.com/dine-drink/moonlight');

    -- Moonlight: "Last Dance" Sundays (5-9pm)
    INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, time_end, confidence, source_url)
    VALUES (v_moonlight, 'Last Dance Sundays', 'event_night',
        'Soulful DJ sets to close out the weekend. Cocktails and skyline views.',
        '{7}', '17:00', '21:00', 'high',
        'https://www.forthatlanta.com/dine-drink/moonlight');

END $$;

-- ============================================================================
-- 3. SEED VENUE SPECIALS — CORRIDOR VENUES (by distance from FORTH)
-- ============================================================================
-- Uses venue names to look up IDs. Venues that don't exist in DB are skipped.

DO $$
DECLARE
    vid INTEGER;
BEGIN

    -- ---- PARK TAVERN (0.38km) ----
    SELECT id INTO vid FROM venues WHERE slug = 'park-tavern' OR name ILIKE 'Park Tavern%' LIMIT 1;
    IF vid IS NOT NULL THEN
        INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, time_end, price_note, confidence)
        VALUES
            (vid, 'Wine Wednesday', 'daily_special', '50% off all bottles of wine, all day.', '{3}', NULL, NULL, '50% off bottles', 'medium'),
            (vid, 'BOGO Food', 'daily_special', 'Buy one get one free any food item, 9-10pm daily.', '{1,2,3,4,5,6,7}', '21:00', '22:00', 'BOGO any food item', 'medium'),
            (vid, 'Late Night Sushi', 'daily_special', 'Half-price sushi 10pm-midnight nightly.', '{1,2,3,4,5,6,7}', '22:00', '00:00', 'Half-price sushi', 'medium'),
            (vid, 'Weekend Brunch Bloodies', 'brunch', 'Half-off Bloody Marys during weekend brunch.', '{6,7}', NULL, NULL, 'Half-off Bloody Marys', 'medium');
    END IF;

    -- ---- THE INDEPENDENT (0.65km) ----
    SELECT id INTO vid FROM venues WHERE slug = 'the-independent' OR name ILIKE 'The Independent%' LIMIT 1;
    IF vid IS NOT NULL THEN
        INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, time_end, price_note, confidence)
        VALUES
            (vid, '$2 Jager Mondays', 'daily_special', '$2 Jagermeister all night.', '{1}', '17:00', '03:00', '$2 Jager', 'medium'),
            (vid, '$2 High Life + Trivia', 'daily_special', '$2 Miller High Life plus trivia night.', '{2}', '21:00', '23:00', '$2 High Life', 'medium'),
            (vid, '$3 Wells + Movie Trivia', 'daily_special', '$3 well drinks plus movie trivia.', '{3}', '21:00', '23:00', '$3 wells', 'medium'),
            (vid, '$1 Oyster Happy Hour', 'happy_hour', '$1 oysters Monday through Friday, 3-6pm.', '{1,2,3,4,5}', '15:00', '18:00', '$1 oysters', 'medium');
    END IF;

    -- ---- BLAKE'S ON THE PARK (0.68km) ----
    SELECT id INTO vid FROM venues WHERE slug ILIKE 'blake%' OR name ILIKE 'Blake''s%' LIMIT 1;
    IF vid IS NOT NULL THEN
        INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, time_end, confidence)
        VALUES
            (vid, 'Craft Cocktail Monday', 'daily_special', 'Craft cocktail specials.', '{1}', NULL, NULL, 'medium'),
            (vid, 'Latin Night', 'event_night', 'Bachata and salsa dancing.', '{2}', NULL, NULL, 'medium'),
            (vid, 'Drag Shows', 'event_night', 'Drag shows Thursday through Saturday around 11pm.', '{4,5,6}', '23:00', NULL, 'medium'),
            (vid, 'Sunday Funday', 'event_night', 'Sunday Funday with drag show around 8:30pm.', '{7}', '20:30', NULL, 'medium');
    END IF;

    -- ---- KAT'S CAFE (0.77km) ----
    SELECT id INTO vid FROM venues WHERE slug ILIKE 'kat%cafe%' OR name ILIKE 'Kat''s Cafe%' LIMIT 1;
    IF vid IS NOT NULL THEN
        INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, time_end, price_note, confidence)
        VALUES
            (vid, '$5 Martini Friday', 'happy_hour', '$5 martinis and half-price chicken wraps.', '{5}', '17:00', '21:00', '$5 martinis', 'medium'),
            (vid, 'Comedy Night', 'event_night', 'Stand-up comedy.', '{2}', '21:00', NULL, NULL, 'medium'),
            (vid, 'Open Mic Thursday', 'event_night', 'Open mic night.', '{4}', '21:00', NULL, NULL, 'medium'),
            (vid, 'Expressions Open Mic', 'event_night', 'Expressions open mic showcase.', '{5}', '21:00', NULL, NULL, 'medium'),
            (vid, 'Live Band Saturday', 'event_night', 'Live band performance.', '{6}', '21:00', NULL, NULL, 'medium');
    END IF;

    -- ---- POUR TAPROOM MIDTOWN (1.02km) ----
    SELECT id INTO vid FROM venues WHERE slug ILIKE 'pour-taproom%' OR name ILIKE 'Pour Taproom%' LIMIT 1;
    IF vid IS NOT NULL THEN
        INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, price_note, confidence)
        VALUES
            (vid, '50% Off Tapwall Monday', 'daily_special', '50% off all tapwall beers, all day.', '{1}', '50% off beer', 'medium'),
            (vid, 'Wine Wednesday', 'daily_special', '50% off all wine, all day.', '{3}', '50% off wine', 'medium');
    END IF;

    -- ---- BRASSERIE MARGOT / BAR MARGOT (1.17km) ----
    SELECT id INTO vid FROM venues WHERE slug ILIKE '%margot%' OR name ILIKE '%Margot%' LIMIT 1;
    IF vid IS NOT NULL THEN
        INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, time_end, price_note, confidence)
        VALUES
            (vid, 'Happy Hour', 'happy_hour', 'Cocktail and wine specials at the Four Seasons.', '{1,2,3,4,5}', '17:00', '19:00', NULL, 'medium'),
            (vid, 'Complimentary Oysters', 'daily_special', 'Complimentary oysters after 2pm on Sundays and Mondays.', '{1,7}', '14:00', NULL, NULL, 'medium'),
            (vid, 'Bi-coastal Oyster Bar', 'recurring_deal', 'Oyster bar experience, half dozen for $30. Thursdays 6-10pm.', '{4}', '18:00', '22:00', '$30/half dozen', 'medium'),
            (vid, 'DJ Nights at Bar Margot', 'event_night', 'DJ sets Friday and Saturday nights.', '{5,6}', NULL, NULL, NULL, 'medium');
    END IF;

    -- ---- FRIENDS ON PONCE (1.29km) ----
    SELECT id INTO vid FROM venues WHERE slug ILIKE 'friends-on-ponce%' OR name ILIKE 'Friends on Ponce%' LIMIT 1;
    IF vid IS NOT NULL THEN
        INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, confidence)
        VALUES
            (vid, 'Let''s Make A Deal', 'event_night', 'Game night every Tuesday at 6pm.', '{2}', '18:00', 'medium'),
            (vid, 'Smarty Pants Trivia', 'event_night', 'Trivia every Wednesday at 8pm.', '{3}', '20:00', 'medium');
    END IF;

    -- ---- 11TH STREET PUB (1.35km) ----
    SELECT id INTO vid FROM venues WHERE slug ILIKE '11th-street%' OR name ILIKE '11th Street Pub%' LIMIT 1;
    IF vid IS NOT NULL THEN
        INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, time_end, price_note, confidence)
        VALUES
            (vid, '$5 Cheeseburger Lunch', 'daily_special', '$5 cheeseburger lunch special, daily.', '{1,2,3,4,5,6,7}', NULL, NULL, '$5 cheeseburger', 'medium'),
            (vid, 'Team Trivia', 'event_night', 'Team trivia Thursday 8-10pm.', '{4}', '20:00', '22:00', NULL, 'medium'),
            (vid, 'Game Day Wings & Brews', 'daily_special', '15 wings + 5 brews for $15, or 20 wings + 5 brews for $20 on game days.', NULL, NULL, NULL, '$15 (15 wings + 5 brews)', 'medium');
    END IF;

    -- ---- CITY WINERY (1.38km) ----
    SELECT id INTO vid FROM venues WHERE slug ILIKE 'city-winery%' OR name ILIKE 'City Winery%' LIMIT 1;
    IF vid IS NOT NULL THEN
        INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, price_note, confidence)
        VALUES
            (vid, 'Burgers & Barrels', 'daily_special', '$25 burger + glass of tap wine, Sunday through Thursday.', '{7,1,2,3,4}', '$25 burger + wine', 'medium'),
            (vid, 'Brunch with DIY Mimosa Bar', 'brunch', 'Weekend brunch with build-your-own mimosa bar.', '{6,7}', NULL, 'medium'),
            (vid, '$5 Wine Flights', 'recurring_deal', '$5 wine flights available anytime.', '{1,2,3,4,5,6,7}', '$5 wine flights', 'medium');
    END IF;

    -- ---- PONCE CITY MARKET — EL SUPER PAN (1.40km) ----
    SELECT id INTO vid FROM venues WHERE slug ILIKE 'ponce-city-market%' OR name ILIKE 'Ponce City Market%' LIMIT 1;
    IF vid IS NOT NULL THEN
        INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, time_end, price_note, confidence)
        VALUES
            (vid, 'El Super Pan Happy Hour', 'happy_hour', 'Super Pack for 4-6 people at El Super Pan, daily 4-6pm.', '{1,2,3,4,5,6,7}', '16:00', '18:00', '$39 Super Pack', 'medium');
    END IF;

    -- ---- NECESSARY PURVEYOR (1.42km) ----
    SELECT id INTO vid FROM venues WHERE slug ILIKE 'necessary%' OR name ILIKE 'Necessary Purveyor%' LIMIT 1;
    IF vid IS NOT NULL THEN
        INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, time_end, price_note, confidence)
        VALUES
            (vid, '$1.50 Oysters', 'happy_hour', '$1.50 oysters Wednesday through Sunday, 5-6pm.', '{3,4,5,6,7}', '17:00', '18:00', '$1.50 oysters', 'high');
    END IF;

    -- ---- ECCO MIDTOWN (1.44km) ----
    SELECT id INTO vid FROM venues WHERE slug ILIKE 'ecco%' OR name ILIKE 'Ecco%' LIMIT 1;
    IF vid IS NOT NULL THEN
        INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, time_end, confidence)
        VALUES
            (vid, 'Happy Hour', 'happy_hour', 'Cocktails, mocktails, wine features, and small plates. Dedicated happy hour menu.', '{1,2,3,4,5}', '16:00', '18:00', 'medium');
    END IF;

    -- ---- HOTEL CLERMONT / CLERMONT LOUNGE (1.54km) ----
    SELECT id INTO vid FROM venues WHERE slug ILIKE 'clermont%' OR name ILIKE '%Clermont%' LIMIT 1;
    IF vid IS NOT NULL THEN
        INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, price_note, confidence)
        VALUES
            (vid, 'Karaoke Night', 'event_night', 'Karaoke every Tuesday, signup at 10pm. Cash only.', '{2}', '22:00', 'Cover $10-$25, cash only', 'medium'),
            (vid, 'Disco Saturday Nights', 'event_night', 'Disco Saturday with DJ. Cash only.', '{6}', NULL, 'Cover $10-$25, cash only', 'medium');
    END IF;

    -- ---- SMITH'S OLDE BAR (1.63km) ----
    SELECT id INTO vid FROM venues WHERE slug ILIKE 'smith%olde%' OR name ILIKE 'Smith''s Olde Bar%' LIMIT 1;
    IF vid IS NOT NULL THEN
        INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, time_end, confidence)
        VALUES
            (vid, 'Happy Hour', 'happy_hour', 'Daily happy hour specials 5-7pm.', '{1,2,3,4,5,6,7}', '17:00', '19:00', 'medium'),
            (vid, 'Open Mic Monday', 'event_night', 'Open mic night.', '{1}', NULL, NULL, 'medium'),
            (vid, 'MarioKart 64 Tuesday', 'event_night', 'MarioKart 64 tournament.', '{2}', NULL, NULL, 'medium'),
            (vid, 'Industry Night Wednesday', 'event_night', 'Industry night specials.', '{3}', NULL, NULL, 'medium'),
            (vid, 'Trivia Thursday', 'event_night', 'Pub trivia.', '{4}', NULL, NULL, 'medium'),
            (vid, 'DJ Sky Late Night', 'event_night', 'DJ Sky spins 11pm-3am Friday and Saturday.', '{5,6}', '23:00', '03:00', 'medium');
    END IF;

    -- ---- FONTAINE'S OYSTER HOUSE (1.72km) ----
    SELECT id INTO vid FROM venues WHERE slug ILIKE 'fontaine%' OR name ILIKE 'Fontaine%' LIMIT 1;
    IF vid IS NOT NULL THEN
        INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, time_end, price_note, confidence)
        VALUES
            (vid, 'Happy Hour', 'happy_hour', 'Drink and food specials Monday through Friday 5-8pm.', '{1,2,3,4,5}', '17:00', '20:00', NULL, 'high'),
            (vid, '$10 Dozen Oysters Tuesday', 'daily_special', '$10 per dozen house oysters all evening on Tuesdays.', '{2}', NULL, NULL, '$10/dozen', 'high'),
            (vid, '$4 Bloody Marys Weekend', 'brunch', '$4 Bloody Marys all day Saturday and Sunday.', '{6,7}', NULL, NULL, '$4 Bloody Marys', 'high'),
            (vid, 'Half-Price Burgers', 'daily_special', 'Half-price burgers plus $7 beer & shot combo.', NULL, NULL, NULL, 'Half-price burgers, $7 beer & shot', 'high');
    END IF;

    -- ---- MOE'S & JOE'S (1.75km) ----
    SELECT id INTO vid FROM venues WHERE slug ILIKE 'moe%joe%' OR name ILIKE 'Moe''s%Joe%' LIMIT 1;
    IF vid IS NOT NULL THEN
        INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, price_note, confidence)
        VALUES
            (vid, '$3.50 PBR Pitchers Tuesday', 'daily_special', '$3.50 PBR pitchers all day Tuesday.', '{2}', '$3.50 PBR pitchers', 'medium'),
            (vid, '$2 PBR Tallboys + Trivia', 'daily_special', '$2 PBR tallboys plus trivia on Wednesday.', '{3}', '$2 PBR tallboys', 'medium'),
            (vid, '$5 Rotating Pitchers + Wings', 'daily_special', '$5 rotating pitchers and Double Dip Wings on Thursday.', '{4}', '$5 pitchers', 'medium'),
            (vid, 'Sunday Pitchers + Wings', 'daily_special', '$5 PBR pitchers and Double Dip Wings on Sunday.', '{7}', '$5 PBR pitchers', 'medium'),
            (vid, '$6 Burgers Every Day', 'daily_special', '$6 burgers available every day.', '{1,2,3,4,5,6,7}', '$6 burgers', 'medium');
    END IF;

    -- ---- RIGHTEOUS ROOM (1.86km) ----
    SELECT id INTO vid FROM venues WHERE slug ILIKE 'righteous%' OR name ILIKE 'Righteous Room%' LIMIT 1;
    IF vid IS NOT NULL THEN
        INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, time_end, price_note, confidence)
        VALUES
            (vid, 'Happy Hour', 'happy_hour', 'Half-price drinks Monday through Friday 4-7pm.', '{1,2,3,4,5}', '16:00', '19:00', 'Half-price drinks', 'high'),
            (vid, '$5 Wells After 7', 'daily_special', '$5 well drinks nightly after 7pm.', '{1,2,3,4,5,6,7}', '19:00', NULL, '$5 wells', 'high'),
            (vid, 'Reverse Happy Hour Sunday', 'happy_hour', 'Half-price drinks 8pm-2am every Sunday.', '{7}', '20:00', '02:00', 'Half-price drinks', 'high');
    END IF;

    -- ---- KROG STREET MARKET (BeltLine) ----
    SELECT id INTO vid FROM venues WHERE slug ILIKE 'krog-street%' OR name ILIKE 'Krog Street Market%' LIMIT 1;
    IF vid IS NOT NULL THEN
        INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, time_end, price_note, confidence)
        VALUES
            (vid, 'Wine Down Wednesday at Hop City', 'daily_special', '$5 wines at Hop City every Wednesday.', '{3}', NULL, NULL, '$5 wines', 'high'),
            (vid, 'Hop City Wine Tastings', 'recurring_deal', 'Wine tastings at Hop City, Friday-Saturday 3-8pm.', '{5,6}', '15:00', '20:00', NULL, 'high'),
            (vid, 'Dirty South Trivia', 'event_night', 'Free trivia every Tuesday at 7pm.', '{2}', '19:00', NULL, 'Free', 'high');
    END IF;

    -- ---- LADYBIRD GROVE & MESS HALL (BeltLine) ----
    SELECT id INTO vid FROM venues WHERE slug ILIKE 'ladybird%' OR name ILIKE 'Ladybird%' LIMIT 1;
    IF vid IS NOT NULL THEN
        INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, confidence)
        VALUES
            (vid, 'Movie Nights in the Grove', 'event_night', 'Monday movie nights with campfires and F&B specials.', '{1}', 'medium'),
            (vid, 'Guest DJ Saturdays', 'event_night', 'Rotating guest DJ 5-9pm every Saturday.', '{6}', 'medium'),
            (vid, 'Chess Knight', 'event_night', 'Atlanta Checkmate Club chess night on Wednesdays.', '{3}', 'medium'),
            (vid, 'Three-Day Weekend Brunch', 'brunch', 'Brunch available Friday through Sunday.', '{5,6,7}', 'medium');
    END IF;

    -- ---- ATLANTA EAGLE (1.15km) ----
    SELECT id INTO vid FROM venues WHERE slug ILIKE 'atlanta-eagle%' OR name ILIKE 'Atlanta Eagle%' LIMIT 1;
    IF vid IS NOT NULL THEN
        INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, price_note, confidence)
        VALUES
            (vid, 'Country Night + Trivia', 'event_night', 'Country night with lessons at 8pm plus trivia at 8:30pm.', '{2}', '20:00', NULL, 'medium'),
            (vid, 'Ruby Redd''s Birdcage Bingo', 'event_night', 'Free bingo hosted by Ruby Redd at 8pm.', '{3}', '20:00', 'Free', 'medium'),
            (vid, 'Rock House Karaoke + Midnight Mayhem', 'event_night', 'Karaoke at 9pm, Midnight Mayhem at 11pm.', '{4}', '21:00', 'Cover ~$8-10', 'medium'),
            (vid, 'Cabaret Shows', 'event_night', 'Cabaret shows Friday and Saturday at 9pm.', '{5,6}', '21:00', 'Cover ~$8-10', 'medium');
    END IF;

END $$;

-- ============================================================================
-- DOWN
-- ============================================================================
-- DELETE FROM venue_specials;
-- DELETE FROM venues WHERE slug IN ('bar-premio', 'il-premio', 'elektra-forth', 'moonlight-forth');
