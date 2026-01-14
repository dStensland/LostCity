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
-- CONVENTION CENTERS
-- =====================================================

UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'georgia-world-congress-center';
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'americasmart-convention-center';
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'cobb-galleria-centre';
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'gas-south-convention-center';
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'georgia-international-convention-center';
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'infinite-energy-arena';

-- =====================================================
-- LARGE MUSIC VENUES / CONCERT HALLS
-- =====================================================

-- The Masquerade complex (late-night, live-music)
UPDATE venues SET vibes = ARRAY['late-night', 'live-music'] WHERE slug = 'the-masquerade-heaven';
UPDATE venues SET vibes = ARRAY['late-night', 'live-music'] WHERE slug = 'the-masquerade-hell';
UPDATE venues SET vibes = ARRAY['late-night', 'live-music'] WHERE slug = 'the-masquerade-purgatory';
UPDATE venues SET vibes = ARRAY['late-night', 'live-music'] WHERE slug = 'the-masquerade-altar';
UPDATE venues SET vibes = ARRAY['late-night', 'live-music', 'outdoor-seating'] WHERE slug = 'the-masquerade-music-park';

-- Other music venues
UPDATE venues SET vibes = ARRAY['late-night', 'live-music'] WHERE slug = 'terminal-west';
UPDATE venues SET vibes = ARRAY['late-night', 'live-music'] WHERE slug = 'variety-playhouse';
UPDATE venues SET vibes = ARRAY['late-night', 'live-music'] WHERE slug = 'vinyl';
UPDATE venues SET vibes = ARRAY['late-night', 'live-music'] WHERE slug = 'the-loft';
UPDATE venues SET vibes = ARRAY['late-night', 'live-music'] WHERE slug = 'aisle-5';
UPDATE venues SET vibes = ARRAY['late-night', 'live-music', 'divey'] WHERE slug = 'smiths-olde-bar';
UPDATE venues SET vibes = ARRAY['live-music', 'late-night'] WHERE slug = 'center-stage-theater';
UPDATE venues SET vibes = ARRAY['live-music', 'late-night'] WHERE slug = 'the-eastern-ga';
UPDATE venues SET vibes = ARRAY['live-music', 'late-night'] WHERE slug = 'district-ga';
UPDATE venues SET vibes = ARRAY['live-music', 'late-night'] WHERE slug = 'buckhead-theatre';
UPDATE venues SET vibes = ARRAY['live-music', 'late-night'] WHERE slug = 'coca-cola-roxy';
UPDATE venues SET vibes = ARRAY['live-music', 'late-night'] WHERE slug = 'tabernacle';

-- Concert halls / Performing arts (date-spot, good-for-groups)
UPDATE venues SET vibes = ARRAY['date-spot', 'good-for-groups'] WHERE slug = 'fox-theatre-atlanta';
UPDATE venues SET vibes = ARRAY['date-spot', 'good-for-groups'] WHERE slug = 'atlanta-symphony-hall';
UPDATE venues SET vibes = ARRAY['date-spot', 'good-for-groups'] WHERE slug = 'symphony-hall';
UPDATE venues SET vibes = ARRAY['date-spot', 'good-for-groups'] WHERE slug = 'cobb-energy-performing-arts-centre';
UPDATE venues SET vibes = ARRAY['date-spot', 'good-for-groups'] WHERE slug = 'alliance-theatre';

-- =====================================================
-- ARENAS / STADIUMS (good-for-groups)
-- =====================================================

UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'state-farm-arena';
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'mercedes-benz-stadium';
UPDATE venues SET vibes = ARRAY['good-for-groups', 'outdoor-seating'] WHERE slug = 'truist-park';
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'gas-south-arena';
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'gas-south-theater';

-- =====================================================
-- BARS & LOUNGES
-- =====================================================

-- Cocktail bars / Upscale lounges (craft-cocktails, date-spot)
UPDATE venues SET vibes = ARRAY['craft-cocktails', 'date-spot', 'late-night'] WHERE slug = 'jojos-beloved-cocktail-lounge';

-- Dive bars / Neighborhood spots (divey, late-night)
UPDATE venues SET vibes = ARRAY['divey', 'late-night'] WHERE slug = 'buckhead-saloon';

-- Sports bars / Casual spots (good-for-groups, late-night)
UPDATE venues SET vibes = ARRAY['good-for-groups', 'late-night'] WHERE slug = 'ponce-sports-lounge';

-- Nightclubs (late-night, good-for-groups)
UPDATE venues SET vibes = ARRAY['late-night', 'good-for-groups'] WHERE slug = 'opium-nightclub';
UPDATE venues SET vibes = ARRAY['late-night', 'good-for-groups'] WHERE slug = 'domaine-atl';
UPDATE venues SET vibes = ARRAY['late-night', 'good-for-groups'] WHERE slug = 'revel-atlanta';
UPDATE venues SET vibes = ARRAY['late-night'] WHERE slug = 'soho-lounge';
UPDATE venues SET vibes = ARRAY['late-night'] WHERE slug = 'bliss-lounge';

-- =====================================================
-- BREWERIES
-- =====================================================

UPDATE venues SET vibes = ARRAY['outdoor-seating', 'dog-friendly', 'good-for-groups'] WHERE slug = 'monday-night-brewing-the-grove';
UPDATE venues SET vibes = ARRAY['outdoor-seating', 'dog-friendly', 'good-for-groups'] WHERE slug = 'atlantucky-brewing';
UPDATE venues SET vibes = ARRAY['outdoor-seating', 'dog-friendly', 'good-for-groups'] WHERE slug = 'three-taverns-imaginarium';

-- =====================================================
-- RESTAURANTS & CAFES
-- =====================================================

-- Upscale / Date spots
UPDATE venues SET vibes = ARRAY['date-spot', 'craft-cocktails'] WHERE slug = 'cafe-circa';
UPDATE venues SET vibes = ARRAY['date-spot', 'craft-cocktails'] WHERE slug = 'cafe-circa-restaurant-lounge';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'taste-wine-bar-and-market';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'bosk-coffee-wine-tapas';

-- Food halls (good-for-groups, outdoor-seating)
UPDATE venues SET vibes = ARRAY['good-for-groups', 'outdoor-seating'] WHERE slug = 'chattahoochee-food-works';

-- =====================================================
-- THEATERS
-- =====================================================

UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = '7-stages-theater';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'alliance-theatre-coca-cola-stage';

-- =====================================================
-- FILM FESTIVALS
-- =====================================================

UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'atlanta-film-festival';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'atlanta-film-society';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'atlanta-jewish-film-festival';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'out-on-film';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'buried-alive-film-fest';

-- =====================================================
-- ADDITIONAL MUSEUMS
-- =====================================================

UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'the-breman-museum';
UPDATE venues SET vibes = ARRAY['date-spot'] WHERE slug = 'atlanta-monetary-museum';
UPDATE venues SET vibes = ARRAY['good-for-groups'] WHERE slug = 'national-infantry-museum';

-- =====================================================
-- Summary (Updated)
-- =====================================================
-- Phase 1: ~70 venues
-- Phase 2: ~60 additional venues
-- Total: ~130 venues with vibes assigned
