-- Migration 139: Add verified new festivals from gap research
--
-- All entries confirmed active via web research (Feb 2026).
-- Categories filled: music sub-genres, comedy, fashion, literary,
-- gaming, beer/spirits, film.

INSERT INTO festivals (id, slug, name, website, typical_month, typical_duration_days, location, neighborhood, categories, free, festival_type, description) VALUES

-- =============================================
-- MUSIC SUB-GENRE FESTIVALS
-- =============================================

('bereggae-festival', 'bereggae-festival', 'BeREGGAE Music & Arts Festival', 'https://www.midtownatl.com/do/bereggae-music-and-arts-festival', 8, 3, 'Piedmont Park', 'Midtown', '{music,art,community}', true, 'festival',
 'The largest reggae festival in the South. Three-day celebration of music, arts, culture, and business bringing together the Afro-Caribbean and African Diaspora communities. Free and family-friendly in Piedmont Park.'),

('atl-hip-hop-day-fest', 'atl-hip-hop-day-fest', 'Atlanta Hip Hop Day Festival', 'https://www.atlantahiphopdayfestival.com', 9, 2, 'Historic Fourth Ward Park', 'Old Fourth Ward', '{music,community,art}', true, 'festival',
 '17th annual celebration of Atlanta''s foundational contribution to hip-hop culture. Live performances, DJs, breakdancing, graffiti art, and community gathering at Historic Fourth Ward Park.'),

('breakaway-atlanta', 'breakaway-atlanta', 'Breakaway Music Festival Atlanta', 'https://www.breakawayfestival.com/festival/atlanta-2026', 5, 2, 'Center Parc Stadium', 'Downtown', '{music}', false, 'festival',
 'Two-day EDM and electronic music festival at Center Parc Stadium. Major headliners across multiple stages with production rivaling the biggest electronic festivals.'),

('atl-blues-festival', 'atl-blues-festival', 'ATL Blues Festival', 'https://www.cobbenergycentre.com', 4, 1, 'Cobb Energy Performing Arts Centre', 'Cumberland', '{music}', false, 'festival',
 '20th annual celebration of Southern Soul and modern Blues. Features top blues artists at the Cobb Energy Performing Arts Centre.'),

('ga-gospel-music-fest', 'ga-gospel-music-fest', 'Georgia Gospel Music Festival', 'https://www.gagospelmusicfest.com', NULL, 2, 'Eagles Landing First Baptist Church', 'McDonough', '{music,community}', false, 'festival',
 'Two-day, three-session gospel music celebration featuring nationally known gospel, Southern gospel, and contemporary Christian artists. A gathering of faith and music in south metro Atlanta.'),

-- =============================================
-- COMEDY
-- =============================================

('all-the-laughs-fest', 'all-the-laughs-fest', 'All The Laughs (ATL) Comedy Festival', 'https://atl.tix.page/', 10, 3, 'Various Venues', 'Atlanta', '{comedy,nightlife}', false, 'festival',
 'Multi-day comedy festival showcasing stand-up, improv, and sketch comedy across Atlanta venues. Features emerging and established comedians competing and performing.'),

('atl-comedy-film-fest', 'atl-comedy-film-fest', 'Atlanta Comedy Film Festival', 'https://filmfreeway.com/AtlantaComedyFilmFestival', 4, 2, '7 Stages Theatre', 'Little Five Points', '{comedy,film}', false, 'festival',
 'Filmmaker-first celebration of comedy at 7 Stages Theatre. Screenings, Q&As, workshops, and networking for comedy filmmakers and fans.'),

-- =============================================
-- FASHION
-- =============================================

('black-fashion-weekend', 'black-fashion-weekend', 'Black Fashion Weekend', 'https://www.blackfashionweekend.com', 10, 2, 'Atlanta', 'Atlanta', '{art,community}', false, 'festival',
 'Celebration of Black designers and Black-owned fashion brands. Runway shows, pop-up shops, and networking events highlighting the diversity and creativity of Black fashion in Atlanta.'),

-- =============================================
-- LITERARY
-- =============================================

('national-book-club-conf', 'national-book-club-conf', 'National Book Club Conference', 'https://nationalbookclubconference.com', 7, 4, 'Atlanta', 'Atlanta', '{learning,community}', false, 'convention',
 'Premier annual literary event featuring African American authors and readers. Four days of author panels, book signings, workshops, and literary celebrations drawing book clubs from across the country.'),

('mjcca-book-festival', 'mjcca-book-festival', 'Book Festival of the MJCCA', 'https://www.atlantajcc.org/our-programs/arts-authors/book-festival/', 11, 14, 'Marcus Jewish Community Center', 'Dunwoody', '{learning,community}', false, 'festival',
 'Annual book festival at the Marcus JCC featuring dozens of renowned authors across multiple events. Author talks, book signings, and literary discussions spanning two weeks each November.'),

('love-yall-book-fest', 'love-yall-book-fest', 'LOVE Y''ALL Romance Book Festival', 'https://www.loveyallfest.com', 5, 2, 'Atlanta', 'Atlanta', '{learning,community}', false, 'festival',
 'Romance book festival created by three indie Atlanta booksellers celebrating romance literature. Author panels, book signings, reader meetups, and community building for romance readers and writers.'),

-- =============================================
-- GAMING
-- =============================================

('dice-and-diversions', 'dice-and-diversions', 'Dice + Diversions', 'https://diceanddiversions.com', 1, 3, 'Atlanta Marriott Northwest at Galleria', 'Cumberland', '{gaming}', false, 'convention',
 'Atlanta''s largest tabletop gaming event. Board games, RPGs, miniatures, card games, and more across three days. Open gaming library, tournaments, and game demos.'),

-- =============================================
-- BEER / SPIRITS
-- =============================================

('ga-craft-brewers-fest', 'ga-craft-brewers-fest', 'Georgia Craft Brewers Festival', 'https://www.georgiacraftbrewersguild.org', 4, 1, 'Downtown Woodstock', 'Woodstock', '{food_drink,music}', false, 'festival',
 'Annual festival by the Georgia Craft Brewers Guild featuring 50 Georgia breweries pouring 150+ unique beers. Collaboration brews, food vendors, and live music in Downtown Woodstock.'),

('atl-magazine-whiskey-fest', 'atl-magazine-whiskey-fest', 'Atlanta Magazine Whiskey Festival', 'https://www.atlantamagazine.com/atlanta-magazine-whiskey-festival-2026/', NULL, 1, 'Atlanta', 'Atlanta', '{food_drink,music}', false, 'festival',
 'Ninth annual whiskey celebration by Atlanta Magazine. Top-shelf whiskey, bourbon, and rum samples, signature cocktails, live music, cigars, and food pairings. VIP hour with exclusive pours.'),

('ga-food-wine-festival', 'ga-food-wine-festival', 'Georgia Food & Wine Festival', 'https://www.georgiafoodandwinefestival.com', 3, 3, 'Jim R. Miller Park', 'Marietta', '{food_drink,music}', false, 'festival',
 'Three-day food and wine festival at Jim R. Miller Park in Marietta. Celebrity chefs, wine tastings, craft spirits, local vendors, cooking demonstrations, and live entertainment.'),

-- =============================================
-- FILM
-- =============================================

('atl-doc-film-fest', 'atl-doc-film-fest', 'ATL DOC - Atlanta Documentary Film Festival', NULL, 3, 3, 'Atlanta', 'Atlanta', '{film}', false, 'festival',
 '21st annual documentary film festival showcasing nonfiction storytelling from around the world. Screenings, filmmaker Q&As, and industry panels celebrating the art of documentary filmmaking.'),

('atlanta-underground-film-fest', 'atlanta-underground-film-fest', 'Atlanta Underground Film Festival', 'https://auff.org', 8, 3, 'Limelight Theater', 'Atlanta', '{film,art}', false, 'festival',
 '23rd annual underground film festival — one of the longest-running in the country. Independent and experimental films, shorts, music videos, and animation at the Limelight Theater.'),

('atlanta-shortsfest', 'atlanta-shortsfest', 'Atlanta Shortsfest', 'https://atlantashortsfest.com', 6, 2, 'Limelight Theater', 'Atlanta', '{film}', false, 'festival',
 '17th annual short film festival at the Limelight Theater. Curated selection of short films from emerging and established filmmakers across all genres.')

ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- CLASSIFY NEW FESTIVALS
-- =============================================

-- Music
UPDATE festivals SET primary_type = 'music_festival', experience_tags = '{live_music,cultural_heritage,outdoor}', audience = 'all_ages', size_tier = 'major', indoor_outdoor = 'outdoor', price_tier = 'free'
WHERE slug = 'bereggae-festival';

UPDATE festivals SET primary_type = 'music_festival', experience_tags = '{live_music,art_exhibits,outdoor}', audience = 'all_ages', size_tier = 'major', indoor_outdoor = 'outdoor', price_tier = 'free'
WHERE slug = 'atl-hip-hop-day-fest';

UPDATE festivals SET primary_type = 'music_festival', experience_tags = '{live_music}', audience = 'all_ages', size_tier = 'major', indoor_outdoor = 'outdoor', price_tier = 'moderate'
WHERE slug = 'breakaway-atlanta';

UPDATE festivals SET primary_type = 'music_festival', experience_tags = '{live_music}', audience = 'all_ages', size_tier = 'major', indoor_outdoor = 'indoor', price_tier = 'moderate'
WHERE slug = 'atl-blues-festival';

UPDATE festivals SET primary_type = 'music_festival', experience_tags = '{live_music,cultural_heritage}', audience = 'all_ages', size_tier = 'local', indoor_outdoor = 'indoor', price_tier = 'moderate'
WHERE slug = 'ga-gospel-music-fest';

-- Comedy
UPDATE festivals SET primary_type = 'comedy_festival', experience_tags = '{nightlife}', audience = 'adults_only', size_tier = 'local', indoor_outdoor = 'indoor', price_tier = 'moderate'
WHERE slug = 'all-the-laughs-fest';

UPDATE festivals SET primary_type = 'film_festival', experience_tags = '{film_screenings,workshops}', audience = 'all_ages', size_tier = 'intimate', indoor_outdoor = 'indoor', price_tier = 'budget'
WHERE slug = 'atl-comedy-film-fest';

-- Fashion
UPDATE festivals SET primary_type = 'fashion_event', experience_tags = '{shopping,cultural_heritage,nightlife}', audience = 'all_ages', size_tier = 'local', indoor_outdoor = 'indoor', price_tier = 'moderate'
WHERE slug = 'black-fashion-weekend';

-- Literary
UPDATE festivals SET primary_type = 'cultural_festival', experience_tags = '{speakers,workshops,shopping}', audience = 'all_ages', size_tier = 'major', indoor_outdoor = 'indoor', price_tier = 'moderate'
WHERE slug = 'national-book-club-conf';

UPDATE festivals SET primary_type = 'cultural_festival', experience_tags = '{speakers,workshops}', audience = 'all_ages', size_tier = 'local', indoor_outdoor = 'indoor', price_tier = 'budget'
WHERE slug = 'mjcca-book-festival';

UPDATE festivals SET primary_type = 'cultural_festival', experience_tags = '{speakers,shopping}', audience = 'all_ages', size_tier = 'intimate', indoor_outdoor = 'indoor', price_tier = 'budget'
WHERE slug = 'love-yall-book-fest';

-- Gaming
UPDATE festivals SET primary_type = 'hobby_expo', experience_tags = '{gaming,shopping}', audience = 'all_ages', size_tier = 'local', indoor_outdoor = 'indoor', price_tier = 'budget'
WHERE slug = 'dice-and-diversions';

-- Beer/Spirits
UPDATE festivals SET primary_type = 'food_festival', experience_tags = '{food_tasting,live_music,outdoor}', audience = '21_plus', size_tier = 'major', indoor_outdoor = 'outdoor', price_tier = 'moderate'
WHERE slug = 'ga-craft-brewers-fest';

UPDATE festivals SET primary_type = 'food_festival', experience_tags = '{food_tasting,live_music}', audience = '21_plus', size_tier = 'local', indoor_outdoor = 'indoor', price_tier = 'moderate'
WHERE slug = 'atl-magazine-whiskey-fest';

UPDATE festivals SET primary_type = 'food_festival', experience_tags = '{food_tasting,live_music,outdoor}', audience = '21_plus', size_tier = 'major', indoor_outdoor = 'both', price_tier = 'moderate'
WHERE slug = 'ga-food-wine-festival';

-- Film
UPDATE festivals SET primary_type = 'film_festival', experience_tags = '{film_screenings,speakers}', audience = 'all_ages', size_tier = 'local', indoor_outdoor = 'indoor', price_tier = 'budget'
WHERE slug = 'atl-doc-film-fest';

UPDATE festivals SET primary_type = 'film_festival', experience_tags = '{film_screenings,art_exhibits}', audience = 'all_ages', size_tier = 'local', indoor_outdoor = 'indoor', price_tier = 'budget'
WHERE slug = 'atlanta-underground-film-fest';

UPDATE festivals SET primary_type = 'film_festival', experience_tags = '{film_screenings}', audience = 'all_ages', size_tier = 'intimate', indoor_outdoor = 'indoor', price_tier = 'budget'
WHERE slug = 'atlanta-shortsfest';
