-- Add niche festivals, conventions, and recurring shows for Atlanta metro
-- Covers hobby cons, cultural festivals, food events, and specialty expos

INSERT INTO festivals (id, slug, name, website, typical_month, typical_duration_days, location, neighborhood, categories, free, festival_type, description) VALUES

-- NICHE HOBBY CONVENTIONS
('ga-renaissance-festival', 'ga-renaissance-festival', 'Georgia Renaissance Festival', 'https://www.garenfest.com', 4, 49, 'Fairburn, GA', 'Fairburn', '{community,family}', false, 'festival',
 'One of the largest Renaissance faires in the Southeast. Eight themed weekends of jousting, turkey legs, artisan crafts, and period entertainment on a 32-acre permanent village site in Fairburn.'),

('southern-fried-gaming-expo', 'southern-fried-gaming-expo', 'Southern-Fried Gaming Expo', 'https://gameatl.com', 7, 3, 'Cobb Galleria Centre', 'Cumberland', '{gaming,family}', false, 'convention',
 'Atlanta''s retro and modern gaming convention featuring 400+ free-play arcade and pinball machines, tabletop gaming, tournaments, live music, and indie game showcases.'),

('dreamhack-atlanta', 'dreamhack-atlanta', 'DreamHack Atlanta', 'https://dreamhack.com/atlanta', 5, 3, 'Georgia World Congress Center', 'Downtown', '{gaming,music}', false, 'convention',
 'Major esports and gaming festival at GWCC featuring IEM Counter-Strike, Call of Duty League, Halo championships, BYOC LAN party, cosplay, and live music.'),

('repticon-atlanta', 'repticon-atlanta', 'Repticon Atlanta', 'https://repticon.com/georgia/atlanta/', 1, 2, 'Gwinnett County Fairgrounds', 'Lawrenceville', '{family,learning}', false, 'convention',
 'Reptile and exotic animal expo with breeders, vendors, and educational seminars. Snakes, lizards, turtles, amphibians, and invertebrates. Multiple shows per year in Gwinnett.'),

('atlanta-tattoo-arts-festival', 'atlanta-tattoo-arts-festival', 'Atlanta Tattoo Arts Festival', 'https://villainarts.com/atlanta-tattoo-arts-convention/', 3, 3, 'Atlanta Convention Center at AmericasMart', 'Downtown', '{art,nightlife}', false, 'convention',
 'Three-day tattoo convention bringing together hundreds of tattoo artists from around the world. Live tattooing, competitions, sideshow performances, and vendor marketplace.'),

('toylanta', 'toylanta', 'Toylanta', 'https://www.toylanta.net', 3, 3, 'Peachtree Corners', 'Peachtree Corners', '{gaming,family}', false, 'convention',
 'Annual toy and collectible convention celebrating action figures, vintage toys, model kits, and pop culture memorabilia. Vendor hall, celebrity guests, and customizer workshops.'),

('monsterama-con', 'monsterama-con', 'Monsterama Con', 'https://monsteramacon.com', 8, 3, 'Atlanta Marriott Northeast', 'Brookhaven', '{film,community}', false, 'convention',
 'Retro horror and sci-fi convention celebrating classic monster movies, B-films, and genre entertainment. Celebrity guests, film screenings, vendor room, and costume contests.'),

('daggercon', 'daggercon', 'DaggerCon', 'https://dagger-con.com', 3, 2, 'Renaissance Atlanta Midtown Hotel', 'Midtown', '{gaming,art}', false, 'convention',
 'Atlanta anime and cosplay convention featuring voice actor panels, cosplay competitions, artist alley, gaming rooms, and Japanese cultural programming.'),

('atlanta-horror-film-fest', 'atlanta-horror-film-fest', 'Atlanta Horror Film Festival', 'https://atlantahorrorfilmfest.com', 10, 3, 'Atlanta', 'Downtown', '{film}', false, 'festival',
 'Annual horror film festival showcasing independent horror, thriller, and dark sci-fi films from around the world. Features screenings, filmmaker Q&As, and industry networking.'),

('ga-mineral-society-show', 'ga-mineral-society-show', 'Georgia Mineral Society Show', 'https://www.gamineral.org/showmain.html', 5, 3, 'Cobb Civic Center', 'Marietta', '{learning,family}', false, 'convention',
 'Annual gem, mineral, fossil, and jewelry show. Dealers, educational exhibits, demonstrations, and specimens from around the world. Held Mother''s Day weekend at the Cobb Civic Center.'),

('atlanta-rare-book-fair', 'atlanta-rare-book-fair', 'Atlanta Rare Book Fair', 'https://finefairs.com/atlanta', 2, 2, 'Oglethorpe University', 'Brookhaven', '{learning,art}', false, 'convention',
 'Annual antiquarian book fair featuring rare books, maps, prints, and ephemera from dealers across the country. Hosted at Oglethorpe University in Brookhaven.'),

-- RECURRING SHOWS & MARKETS
('scott-antique-markets', 'scott-antique-markets', 'Scott Antique Markets', 'https://www.scottantiquemarket.com', NULL, 2, 'Atlanta Expo Center', 'Jonesboro', '{art,community}', false, 'festival',
 'One of the largest indoor antique shows in the country. Over 2,400 dealer booths across two buildings. Held the second weekend of every month at Atlanta Expo Center.'),

-- CULTURAL FESTIVALS
('atlanta-korean-festival', 'atlanta-korean-festival', 'Atlanta Korean Festival', 'https://www.koreanfestivalfoundation.com', 10, 1, 'Gwinnett Place Mall area', 'Duluth', '{community,food_drink}', true, 'festival',
 'The Southeast''s largest Korean heritage festival celebrating Korean culture, food, music, and traditions. Traditional performances, K-pop, Korean cuisine, and cultural demonstrations.'),

('atlanta-caribbean-carnival', 'atlanta-caribbean-carnival', 'Atlanta Caribbean Carnival', NULL, 5, 1, 'Downtown Atlanta', 'Downtown', '{community,music}', true, 'festival',
 'Annual Memorial Day weekend Caribbean carnival parade and festival celebrating Caribbean culture with steel drums, soca music, elaborate costumes, and island cuisine.'),

-- FOOD & DRINK FESTIVALS
('suwanee-beer-fest', 'suwanee-beer-fest', 'Suwanee Beer Fest', 'https://suwaneebeerfest.com', 3, 1, 'Town Center Park, Suwanee', 'Suwanee', '{food_drink,music}', false, 'festival',
 'One of the top beer festivals in Georgia with 400+ craft beers, live music, and food trucks in Suwanee''s Town Center Park. Features local and national breweries.'),

('chomp-and-stomp', 'chomp-and-stomp', 'Chomp & Stomp', 'https://chompandstomp.com', 11, 1, 'Cabbagetown', 'Cabbagetown', '{food_drink,music}', true, 'festival',
 'Cabbagetown''s beloved chili cook-off and bluegrass festival. Teams compete for chili supremacy while live bluegrass bands play. Includes a 5K run and neighborhood celebration.'),

('pigs-and-peaches-bbq', 'pigs-and-peaches-bbq', 'Pigs & Peaches BBQ Festival', NULL, 8, 1, 'Kennesaw', 'Kennesaw', '{food_drink,community}', true, 'festival',
 'KCBS-sanctioned BBQ competition and Georgia State Championship. Pro and backyard BBQ teams compete while attendees enjoy samples, live music, and family activities.'),

-- SPECIALTY EXPOS
('atlanta-boat-show', 'atlanta-boat-show', 'Discover Boating Atlanta Boat Show', 'https://www.atlantaboatshow.com', 1, 4, 'Georgia World Congress Center', 'Downtown', '{family}', false, 'convention',
 'Annual boat show at GWCC featuring hundreds of boats from fishing boats to luxury yachts. Boating seminars, fishing simulators, and marine accessories.'),

('ga-celebrates-quilts', 'ga-celebrates-quilts', 'Georgia Celebrates Quilts', 'https://www.georgiacelebratesquilts.com', 6, 3, 'Cobb Civic Center', 'Marietta', '{art,learning}', false, 'convention',
 'The largest quilt show in Georgia featuring hundreds of quilts on display, workshops, lectures, and a vendor mall. Celebrates traditional and contemporary quilting arts.'),

('atlanta-plant-fest', 'atlanta-plant-fest', 'Atlanta Plant Fest', NULL, 4, 1, 'Pittsburgh Yards', 'Pittsburgh', '{community,learning}', true, 'festival',
 'Plant swap and festival bringing together plant enthusiasts for trading, buying, and learning about houseplants and gardening. Local plant vendors and workshops.'),

('atlanta-home-show', 'atlanta-home-show', 'Atlanta Home Show', 'https://www.atlantahomeshow.com', 3, 3, 'Cobb Galleria Centre', 'Cumberland', '{learning}', false, 'convention',
 'Semi-annual home and garden expo featuring contractors, designers, and home improvement vendors. Spring and fall editions at Cobb Galleria Centre.')

ON CONFLICT (slug) DO NOTHING;
