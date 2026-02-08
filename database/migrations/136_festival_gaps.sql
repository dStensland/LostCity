-- Migration 136: Fill festival & event programming gaps
--
-- Adds ~50 festivals in underrepresented categories:
--   Comedy, Fashion, Wellness/Yoga, Dance, Major Sports Events,
--   Theater/Performing Arts, Restaurant/Cocktail Weeks, July 4th,
--   and Additional Suburban festivals.
--
-- Excludes already-existing entries:
--   peachtree-road-race (133), atlanta-marathon (133), tucker-day (133),
--   taste-of-atlanta (010)

INSERT INTO festivals (id, slug, name, website, typical_month, typical_duration_days, location, neighborhood, categories, free, festival_type, description) VALUES

-- =============================================
-- COMEDY FESTIVALS
-- =============================================

('laughing-skull-comedy-fest', 'laughing-skull-comedy-fest', 'Laughing Skull Comedy Festival', 'https://www.laughingskulllounge.com', 3, 5, 'Laughing Skull Lounge / Vortex', 'Midtown', '{comedy}', false, 'festival',
 'Annual comedy festival at the Laughing Skull Lounge showcasing 100+ comedians from across the country competing for cash prizes. Stand-up, sketch, and variety acts over five days in March.'),

('atlanta-comedy-festival', 'atlanta-comedy-festival', 'Atlanta Comedy Festival', NULL, 5, 3, 'Various Venues', 'Atlanta', '{comedy,nightlife}', false, 'festival',
 'Multi-venue comedy festival spanning clubs and theaters across Atlanta. National headliners and emerging talent in stand-up, improv, and sketch comedy.'),

('dads-garage-improv-fest', 'dads-garage-improv-fest', 'Dad''s Garage Improv Festival', 'https://dadsgarage.com', 10, 4, 'Dad''s Garage Theatre', 'Old Fourth Ward', '{comedy,art}', false, 'festival',
 'Annual improv festival hosted by Dad''s Garage Theatre bringing together improv troupes from across the country. Long-form and short-form showcases, workshops, and late-night sets.'),

('whole-world-comedy-fest', 'whole-world-comedy-fest', 'Whole World Comedy Festival', 'https://www.wholeworldimprov.com', 6, 3, 'Whole World Theatre', 'Downtown', '{comedy}', false, 'festival',
 'Improv and stand-up comedy festival at Whole World Theatre featuring performers from Atlanta and beyond. Workshops, jams, and mainstage showcases.'),

-- =============================================
-- FASHION EVENTS
-- =============================================

('atlanta-fashion-week', 'atlanta-fashion-week', 'Atlanta Fashion Week', 'https://atlantafashionweek.com', 9, 5, 'Various Venues', 'Midtown', '{art,nightlife}', false, 'festival',
 'Atlanta''s premier fashion showcase featuring emerging and established designers on the runway. Shows, pop-up shops, industry mixers, and after-parties across Midtown venues.'),

('scad-fashwknd', 'scad-fashwknd', 'SCAD FASHWKND', 'https://www.scad.edu', 5, 3, 'SCAD Atlanta', 'Midtown', '{art}', false, 'festival',
 'SCAD''s annual fashion showcase highlighting senior collections from the university''s renowned fashion program. Runway shows, portfolio reviews, and industry networking.'),

('atlanta-apparel-market', 'atlanta-apparel-market', 'Atlanta Apparel Market', 'https://www.atlantamarket.com', 6, 4, 'AmericasMart Atlanta', 'Downtown', '{art,learning}', false, 'convention',
 'One of the largest apparel trade markets in the country at AmericasMart. Thousands of fashion brands, emerging designers, and industry buyers. Multiple markets per year.'),

-- =============================================
-- WELLNESS / YOGA
-- =============================================

('atlanta-yoga-festival', 'atlanta-yoga-festival', 'Atlanta Yoga Festival', NULL, 9, 2, 'Piedmont Park', 'Midtown', '{fitness,community}', false, 'festival',
 'Weekend yoga and wellness festival in Piedmont Park featuring classes from top instructors, meditation sessions, wellness vendors, and holistic health workshops.'),

('beltline-yoga-fest', 'beltline-yoga-fest', 'BeltLine Yoga & Wellness Festival', NULL, 6, 1, 'Atlanta BeltLine', 'Atlanta', '{fitness,community}', true, 'festival',
 'Free outdoor yoga and wellness event along the Atlanta BeltLine. Community yoga classes, guided meditation, wellness vendors, and healthy food trucks.'),

('atlanta-wellness-festival', 'atlanta-wellness-festival', 'Atlanta Wellness Festival', NULL, 4, 2, 'Atlanta', 'Midtown', '{fitness,learning}', false, 'festival',
 'Holistic health and wellness expo featuring fitness classes, nutrition workshops, mindfulness sessions, and wellness product marketplace. Local practitioners and national speakers.'),

-- =============================================
-- DANCE
-- =============================================

('atlanta-fringe-festival', 'atlanta-fringe-festival', 'Atlanta Fringe Festival', 'https://www.atlantafringe.org', 6, 10, 'Various Venues', 'Little Five Points', '{art,music,comedy}', false, 'festival',
 'Open-access performing arts festival featuring theater, dance, comedy, music, and spoken word. 100+ uncensored performances across Little Five Points venues. Anyone can perform.'),

('atlanta-salsa-congress', 'atlanta-salsa-congress', 'Atlanta International Salsa Congress', NULL, 8, 3, 'Atlanta', 'Downtown', '{music,fitness}', false, 'festival',
 'Three-day Latin dance congress featuring salsa, bachata, and kizomba workshops with world-class instructors. Social dancing, performances, and competitions drawing dancers from across the Southeast.'),

-- =============================================
-- MAJOR SPORTS EVENTS
-- =============================================

('chick-fil-a-peach-bowl', 'chick-fil-a-peach-bowl', 'Chick-fil-A Peach Bowl', 'https://www.chick-fil-apeachbowl.com', 12, 1, 'Mercedes-Benz Stadium', 'Downtown', '{fitness}', false, 'festival',
 'One of the six College Football Playoff bowls and a New Year''s Six game. A marquee college football event at Mercedes-Benz Stadium drawing 75,000+ fans annually since 1968.'),

('sec-championship-game', 'sec-championship-game', 'SEC Championship Game', 'https://www.secsports.com', 12, 1, 'Mercedes-Benz Stadium', 'Downtown', '{fitness}', false, 'festival',
 'Annual SEC Conference championship football game at Mercedes-Benz Stadium. The biggest weekend in college football brings 75,000+ fans and transforms Downtown Atlanta.'),

('chick-fil-a-kickoff-game', 'chick-fil-a-kickoff-game', 'Chick-fil-A Kickoff Game', 'https://www.chick-fil-akickoffgame.com', 9, 1, 'Mercedes-Benz Stadium', 'Downtown', '{fitness}', false, 'festival',
 'Premier season-opening college football game at Mercedes-Benz Stadium featuring top-ranked teams. Labor Day weekend tradition with 70,000+ fans.'),

('tour-championship-pga', 'tour-championship-pga', 'TOUR Championship', 'https://www.tourchampionship.com', 8, 4, 'East Lake Golf Club', 'East Lake', '{fitness}', false, 'festival',
 'The final event of the PGA TOUR FedExCup Playoffs at historic East Lake Golf Club. The top 30 golfers in the world compete for the season title in Atlanta every August.'),

('atlanta-supercross', 'atlanta-supercross', 'Monster Energy AMA Supercross', 'https://www.supercrosslive.com', 3, 1, 'Mercedes-Benz Stadium', 'Downtown', '{fitness}', false, 'festival',
 'AMA Supercross Championship round at Mercedes-Benz Stadium. Dirt bike racing on a custom-built indoor track with massive jumps, whoops, and rhythm sections. 60,000+ fans.'),

('nascar-atlanta', 'nascar-atlanta', 'NASCAR at Atlanta Motor Speedway', 'https://www.atlantamotorspeedway.com', 3, 3, 'Atlanta Motor Speedway', 'Hampton', '{fitness}', false, 'festival',
 'NASCAR Cup Series race weekend at the 1.5-mile Atlanta Motor Speedway. Pack racing, Xfinity Series, Camping World Truck Series, and fan activities across a full weekend.'),

('atlanta-united-season-opener', 'atlanta-united-season-opener', 'Atlanta United FC Season Opener', 'https://www.atlutd.com', 2, 1, 'Mercedes-Benz Stadium', 'Downtown', '{fitness,community}', false, 'festival',
 'MLS season opener at Mercedes-Benz Stadium with 70,000+ in the supporter-driven atmosphere of the Five Stripes. March to the match, tifo displays, and Atlanta''s soccer culture on full display.'),

('atlanta-braves-opening-day', 'atlanta-braves-opening-day', 'Atlanta Braves Opening Day', 'https://www.mlb.com/braves', 3, 1, 'Truist Park', 'Cumberland', '{fitness,community}', false, 'festival',
 'The annual rite of spring at Truist Park. Opening Day festivities at The Battery Atlanta with pregame concerts, ceremonial first pitch, and the start of a new Braves season.'),

('atlanta-hawks-home-opener', 'atlanta-hawks-home-opener', 'Atlanta Hawks Home Opener', 'https://www.nba.com/hawks', 10, 1, 'State Farm Arena', 'Downtown', '{fitness,community}', false, 'festival',
 'NBA season opener at State Farm Arena. Pregame entertainment, team introductions, and the start of a new Hawks season in the newly-renovated arena.'),

('college-football-playoff-natl', 'college-football-playoff-natl', 'College Football Playoff National Championship', 'https://collegefootballplayoff.com', 1, 1, 'Mercedes-Benz Stadium', 'Downtown', '{fitness}', false, 'festival',
 'When Atlanta hosts the CFP National Championship, the city becomes the center of college football. Championship game plus a week of fan events, concerts, and tailgating across Downtown.'),

-- =============================================
-- THEATER / PERFORMING ARTS FESTIVALS
-- =============================================

('essential-theatre-play-fest', 'essential-theatre-play-fest', 'Essential Theatre Play Festival', 'https://www.essentialtheatre.com', 7, 21, 'Various Venues', 'Atlanta', '{art}', false, 'festival',
 'Atlanta''s only festival dedicated entirely to new plays by Georgia writers. Three weeks of world premieres, staged readings, and playwright discussions each summer since 1999.'),

('horizon-new-south-fest', 'horizon-new-south-fest', 'Horizon Theatre New South Play Festival', 'https://www.horizontheatre.com', 1, 7, 'Horizon Theatre', 'Little Five Points', '{art}', false, 'festival',
 'Annual festival of new play readings showcasing emerging Southern playwrights. Audience talkbacks, workshops, and staged readings of works in development at Horizon Theatre.'),

('alliance-collision-project', 'alliance-collision-project', 'Alliance Theatre Palefsky Collision Project', 'https://www.alliancetheatre.org', 7, 14, 'Alliance Theatre', 'Midtown', '{art,learning}', false, 'festival',
 'Summer intensive where teen artists create and perform an original musical in two weeks at the Alliance Theatre. A celebrated pipeline for emerging theater talent.'),

('atlanta-one-minute-play-fest', 'atlanta-one-minute-play-fest', 'Atlanta One-Minute Play Festival', NULL, 11, 2, 'Various Venues', 'Atlanta', '{art}', false, 'festival',
 'Fast-paced theater festival featuring dozens of original one-minute plays performed back-to-back by Atlanta''s theater community. A snapshot of the city''s creative pulse.'),

-- =============================================
-- RESTAURANT / COCKTAIL WEEKS
-- =============================================

('atlanta-restaurant-week', 'atlanta-restaurant-week', 'Atlanta Restaurant Week', 'https://atlantarestaurantweek.com', 7, 10, 'Various Restaurants', 'Atlanta', '{food_drink}', false, 'festival',
 'Twice-annual prix fixe dining event with 50+ participating restaurants offering multi-course meals at set prices. Summer and winter editions showcase Atlanta''s diverse dining scene.'),

('atlanta-cocktail-week', 'atlanta-cocktail-week', 'Atlanta Cocktail Week', NULL, 2, 7, 'Various Bars', 'Atlanta', '{food_drink,nightlife}', false, 'festival',
 'Week-long celebration of Atlanta''s cocktail culture. Specialty menus, guest bartenders, industry parties, cocktail competitions, and spirit tastings at bars across the city.'),

('atlanta-wine-week', 'atlanta-wine-week', 'Atlanta Food & Wine Festival', 'https://atlfoodandwinefestival.com', 5, 3, 'Midtown', 'Midtown', '{food_drink,learning}', false, 'festival',
 'Three-day celebration of Southern food and wine culture. Tasting tents, chef demonstrations, wine seminars, and dinner events highlighting the region''s best culinary talent.'),

-- =============================================
-- JULY 4TH & SEASONAL
-- =============================================

('lenox-july-4th-parade', 'lenox-july-4th-parade', 'Lenox Square July 4th Parade', NULL, 7, 1, 'Lenox Square to Phipps Plaza', 'Buckhead', '{community,family}', true, 'festival',
 'Buckhead''s annual Independence Day parade along Peachtree Road from Lenox Square to Phipps Plaza. Marching bands, floats, local organizations, and patriotic fun since the 1960s.'),

('stone-mountain-fantastic-fourth', 'stone-mountain-fantastic-fourth', 'Fantastic Fourth Celebration', 'https://stonemountainpark.com', 7, 4, 'Stone Mountain Park', 'Stone Mountain', '{family,music}', false, 'festival',
 'Stone Mountain''s signature July 4th celebration with the famous Lasershow Spectacular fireworks, live music, food vendors, and family activities. One of the largest Independence Day events in the Southeast.'),

('decatur-beach-party', 'decatur-beach-party', 'Decatur Beach Party', 'https://decaturartsalliance.org', 7, 1, 'Decatur Square', 'Decatur', '{community,music,family}', true, 'festival',
 'Annual July 4th beach party on the Decatur Square — complete with truckloads of real sand. Live music, water slides, food vendors, and fireworks. Decatur''s beloved Independence Day tradition.'),

('centennial-park-july-4th', 'centennial-park-july-4th', 'Centennial Olympic Park July 4th', 'https://www.gwcca.org', 7, 1, 'Centennial Olympic Park', 'Downtown', '{music,family}', true, 'festival',
 'Downtown Atlanta''s Independence Day celebration at Centennial Olympic Park with live music, food vendors, family activities, and a massive fireworks display over the park.'),

('dunwoody-july-4th', 'dunwoody-july-4th', 'Dunwoody 4th of July Parade & Fireworks', 'https://www.dunwoodyga.gov', 7, 1, 'Brook Run Park', 'Dunwoody', '{community,family}', true, 'festival',
 'Family-friendly July 4th celebration with morning parade through Dunwoody Village, evening fireworks spectacular at Brook Run Park, and food trucks throughout the day.'),

-- =============================================
-- ADDITIONAL SUBURBAN
-- =============================================

('lilburn-daze', 'lilburn-daze', 'Lilburn Daze', 'https://www.lilburnbusinessassociation.com', 10, 1, 'Downtown Lilburn', 'Lilburn', '{community,music,family}', true, 'festival',
 'Annual fall festival in downtown Lilburn featuring live music, arts and crafts vendors, food, rides, and community celebration. A Gwinnett County tradition for over 40 years.'),

('woodstock-summer-concert-series', 'woodstock-summer-concert-series', 'Woodstock Summer Concert Series', 'https://www.woodstockga.gov', 6, 60, 'Downtown Woodstock', 'Woodstock', '{music,community}', true, 'festival',
 'Free outdoor concert series on summer Thursday and Friday evenings in Downtown Woodstock. Local and regional bands, food trucks, and family-friendly atmosphere. June through August.'),

('peachtree-city-dragon-boat', 'peachtree-city-dragon-boat', 'Peachtree City Dragon Boat Festival', NULL, 9, 1, 'Lake Peachtree', 'Peachtree City', '{fitness,community}', false, 'festival',
 'Dragon boat racing on Lake Peachtree with corporate and community teams competing. Asian cultural demonstrations, food vendors, and lakeside festivities in Peachtree City.'),

('milton-hometown-jubilee', 'milton-hometown-jubilee', 'Milton Hometown Jubilee', 'https://www.cityofmiltonga.us', 10, 1, 'Bell Memorial Park, Milton', 'Milton', '{community,family}', true, 'festival',
 'Milton''s annual hometown celebration at Bell Memorial Park. Parade, live music, vendor village, carnival rides, food trucks, and community awards honoring the city''s semi-rural character.'),

('snellville-days', 'snellville-days', 'Snellville Days', 'https://www.snellville.org', 5, 2, 'Snellville Towne Green', 'Snellville', '{community,music,family}', true, 'festival',
 'Annual spring festival on the Snellville Towne Green with live music, carnival rides, arts and crafts, food vendors, and family activities.'),

('johns-creek-arts-fest', 'johns-creek-arts-fest', 'Johns Creek Arts Festival', 'https://johnscreekga.gov', 10, 2, 'Newtown Park, Johns Creek', 'Johns Creek', '{art,music}', true, 'festival',
 'Juried fine arts festival at Newtown Park featuring 100+ artists, live music, food trucks, and interactive art activities. One of north Fulton''s premier cultural events.')

ON CONFLICT (slug) DO NOTHING;
