-- Venue vibes population
-- Generated with AI-assisted categorization based on venue name, type, and neighborhood

-- =====================================================
-- GAMES / ENTERTAINMENT VENUES
-- =====================================================

-- Arcade bars and gaming lounges (late-night, good-for-groups, often divey)
UPDATE venues SET vibes = ARRAY['late-night', 'good-for-groups'] WHERE slug = 'joystick-gamebar';
UPDATE venues SET vibes = ARRAY['late-night', 'good-for-groups'] WHERE slug = 'big-boss-arcade-bar';
UPDATE venues SET vibes = ARRAY['late-night', 'good-for-groups'] WHERE slug = 'battle-and-brew';
UPDATE venues SET vibes = ARRAY['late-night', 'good-for-groups'] WHERE slug = 'versus-atl';

-- Bowling and entertainment centers (good-for-groups)
UPDATE venues SET vibes = ARRAY['good-for-groups', 'late-night'] WHERE slug = 'bowlero-atlanta';
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'stars-and-strikes-dacula';
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'stars-and-strikes-cumming';
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'round1-north-point';
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'round1-perimeter';

-- Upscale games (date-spot, good-for-groups, craft-cocktails)
UPDATE venues SET vibes = ARRAY['date-spot', 'craft-cocktails', 'good-for-groups'] WHERE slug = 'painted-pin';
UPDATE venues SET vibes = ARRAY['date-spot', 'craft-cocktails', 'good-for-groups'] WHERE slug = 'painted-duck';
UPDATE venues SET vibes = ARRAY['date-spot', 'good-for-groups'] WHERE slug = 'puttshack-atlanta';
UPDATE venues SET vibes = ARRAY['date-spot', 'good-for-groups'] WHERE slug = 'flight-club-atlanta';

-- Family entertainment centers (good-for-groups)
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'andretti-marietta';
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'andretti-buford';
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'main-event-alpharetta';
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'main-event-sandy-springs';
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'dave-and-busters-marietta';
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'dave-and-busters-lawrenceville';
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'monster-mini-golf-marietta';

-- Escape rooms (good-for-groups)
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'breakout-games-atlanta';
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'escape-the-room-atlanta';

-- Topgolf (outdoor-seating, good-for-groups)
UPDATE venues SET vibes = ARRAY['outdoor-seating', 'good-for-groups'] WHERE slug = 'topgolf-midtown';
UPDATE venues SET vibes = ARRAY['outdoor-seating', 'good-for-groups'] WHERE slug = 'topgolf-alpharetta';

-- =====================================================
-- MUSIC VENUES
-- =====================================================

UPDATE venues SET vibes = ARRAY['late-night', 'live-music', 'divey'] WHERE slug = 'the-earl';
UPDATE venues SET vibes = ARRAY['late-night', 'live-music'] WHERE slug = '529';
UPDATE venues SET vibes = ARRAY['live-music', 'date-spot'] WHERE slug = 'city-winery-atlanta';
UPDATE venues SET vibes = ARRAY['live-music', 'date-spot'] WHERE slug = 'eddies-attic';

-- =====================================================
-- COMEDY CLUBS
-- =====================================================

UPDATE venues SET vibes = ARRAY['late-night', 'date-spot', 'good-for-groups'] WHERE slug = 'laughing-skull-lounge';
UPDATE venues SET vibes = ARRAY['late-night', 'date-spot', 'good-for-groups'] WHERE slug = 'punchline-comedy-club';

-- =====================================================
-- THEATERS
-- =====================================================

UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'dads-garage';

-- =====================================================
-- CINEMAS
-- =====================================================

UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'landmark-midtown-art-cinema';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'plaza-theatre';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'tara-theatre';

-- =====================================================
-- GALLERIES
-- =====================================================

UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'atlanta-contemporary';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'whitespace-gallery';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'kai-lin-art';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'mason-fine-art';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'sandler-hudson-gallery';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'marcia-wood-gallery';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'alan-avery-art';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'tew-galleries';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'poem-88';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'besharat-gallery';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'notch8-gallery';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'zucot-gallery';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'get-this-gallery';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'dashboard-co-op';

-- =====================================================
-- MUSEUMS
-- =====================================================

-- Museums that are good for groups/families
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'georgia-aquarium';
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'world-of-coca-cola';
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'childrens-museum-atlanta';
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'fernbank-museum';
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'fernbank-science-center';
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'college-football-hall-of-fame';
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'delta-flight-museum';

-- Museums that are good date spots
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'high-museum-of-art';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'center-for-civil-and-human-rights';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'atlanta-history-center';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'michael-c-carlos-museum';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'moda-atlanta';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'hammonds-house-museum';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'apex-museum';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'margaret-mitchell-house';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'wrens-nest-museum';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'carter-presidential-library';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'mlk-national-historical-park';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'center-for-puppetry-arts';

-- =====================================================
-- OUTDOOR VENUES
-- =====================================================

UPDATE venues SET vibes = ARRAY['outdoor-seating', 'dog-friendly'] WHERE slug = 'atlanta-beltline';
UPDATE venues SET vibes = ARRAY['outdoor-seating', 'good-for-groups'] WHERE slug = 'centennial-olympic-park';
UPDATE venues SET vibes = ARRAY['outdoor-seating', 'date-spot'] WHERE slug = 'atlanta-botanical-garden';

-- =====================================================
-- Summary
-- =====================================================
-- Games venues: ~24 venues with vibes
-- Music venues: ~4 venues with vibes
-- Comedy clubs: ~2 venues with vibes
-- Theaters: ~1 venue with vibes
-- Cinemas: ~3 venues with vibes
-- Galleries: ~14 venues with vibes
-- Museums: ~19 venues with vibes
-- Outdoor: ~3 venues with vibes
-- Total: ~70 venues with vibes assigned
