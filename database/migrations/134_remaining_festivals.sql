-- Third batch: cultural heritage, niche hobby, food, holiday, music, suburban
-- The "leave nothing behind" pass

INSERT INTO festivals (id, slug, name, website, typical_month, typical_duration_days, location, neighborhood, categories, free, festival_type, description) VALUES

-- CULTURAL HERITAGE
('atlanta-diwali', 'atlanta-diwali', 'Atlanta Diwali Celebration', NULL, 11, 3, 'Various Venues', 'Atlanta', '{community,family}', true, 'festival',
 'Festival of Lights celebrated across metro Atlanta with flame lamps, fireworks, annakut displays, sweets, and cultural performances. Events at BAPS Mandir, Hindu Temple of Atlanta, and community venues.'),

('atlanta-holi', 'atlanta-holi', 'Atlanta Holi Festival of Colors', NULL, 3, 1, 'Atlanta', 'Atlanta', '{community,family}', false, 'festival',
 'Vibrant spring celebration with colored powders, dancing, festive foods, and music honoring the Hindu festival of colors. Multiple events across metro Atlanta.'),

('atlanta-eid-festival', 'atlanta-eid-festival', 'Atlanta Eid Festival', NULL, 3, 2, 'Various Venues', 'Atlanta', '{community,food_drink,family}', true, 'festival',
 'Eid al-Fitr celebrations across metro Atlanta marking the end of Ramadan. Community feasts, carnivals, cultural performances, and family gatherings at mosques and community centers.'),

('esfna-atlanta', 'esfna-atlanta', 'ESFNA Ethiopian Sports & Cultural Festival', NULL, 7, 5, 'Atlanta', 'Atlanta', '{fitness,community,music}', false, 'festival',
 'Ethiopian Sports Federation in North America tournament and cultural festival. Soccer competitions, Ethiopian music, traditional food, and heritage celebration drawing thousands from across the diaspora.'),

('galiff', 'galiff', 'Georgia Latino International Film Festival', 'https://galiff.org', 9, 5, 'Atlanta', 'Atlanta', '{film,community}', false, 'festival',
 'Afro-Latino curated film festival during Hispanic Heritage Month showcasing independent films from Latin America and the Latino diaspora. Screenings, filmmaker Q&As, and cultural programming.'),

('johns-creek-lunar-new-year', 'johns-creek-lunar-new-year', 'Johns Creek Lunar New Year', 'https://johnscreekga.gov', 2, 1, 'Heisman Field, Johns Creek', 'Johns Creek', '{community,food_drink,family}', true, 'festival',
 'Lunar New Year celebration with cultural performances, traditional food, local vendors, and kids activities in one of metro Atlanta''s most diverse communities.'),

('johns-creek-diwali', 'johns-creek-diwali', 'Johns Creek Diwali Celebration', 'https://johnscreekga.gov', 11, 1, 'Johns Creek', 'Johns Creek', '{community,family}', true, 'festival',
 'City-organized Diwali celebration in Johns Creek honoring the area''s significant South Asian community. Fireworks, traditional dance, food, and family activities.'),

-- MUSIC / ARTS (status varies but worth tracking)
('a3c-festival', 'a3c-festival', 'A3C Festival & Conference', 'https://a3cconference.com', 10, 4, 'Downtown Atlanta', 'Downtown', '{music,learning}', false, 'festival',
 'Atlanta''s premier hip-hop festival and music industry conference. Showcases emerging and established artists, panels on the business of music, tech, and culture. The heartbeat of Atlanta hip-hop.'),

('afropunk-atlanta', 'afropunk-atlanta', 'AfroPunk Atlanta', 'https://afropunk.com', 10, 2, 'Atlanta', 'Atlanta', '{music,art,community}', false, 'festival',
 'Celebrates Black culture and diversity through music, art, fashion, and community. Eclectic lineup spanning punk, soul, hip-hop, electronic, and everything in between.'),

('imagine-music-festival', 'imagine-music-festival', 'Imagine Music Festival', 'https://imaginefestival.com', 9, 3, 'Atlanta area', 'Atlanta', '{music}', false, 'festival',
 'Three-day EDM and electronic arts festival with camping. Multiple stages, art installations, and immersive experiences. One of the Southeast''s premier electronic music events.'),

('atlanta-maker-faire', 'atlanta-maker-faire', 'Atlanta Mini Maker Faire', 'https://makerfaireatl.com', 10, 2, 'Atlanta', 'Decatur', '{learning,art,family}', false, 'festival',
 'Celebration of makers, creators, crafters, and builders. Robotics, 3D printing, electronics, woodworking, textiles, and DIY projects. Hands-on activities for all ages.'),

('roswell-arts-festival', 'roswell-arts-festival', 'Roswell Arts Festival', 'https://www.roswellartsfestival.com', 9, 2, 'Roswell', 'Roswell', '{art,music}', true, 'festival',
 'Juried fine arts festival in historic Roswell featuring regional and national artists, live music, food vendors, and interactive art experiences.'),

-- NICHE HOBBY CONVENTIONS
('atlanta-coin-show', 'atlanta-coin-show', 'Greater Atlanta Coin Show', 'http://atlcoin.com', NULL, 1, 'IAM Union Hall', 'Marietta', '{learning}', true, 'convention',
 'Monthly coin show with 40+ dealers offering coins, currency, bullion, and jewelry. Free admission. Held most months at IAM Union Hall in Marietta.'),

('atlanta-model-train-show', 'atlanta-model-train-show', 'Atlanta Model Train Show', NULL, 1, 1, 'Gas South Convention Center', 'Duluth', '{family,learning}', false, 'convention',
 'Twice-yearly model train show at Gas South featuring operating layouts, dealers, clinics, and displays. One of the largest model railroad events in the Southeast.'),

('southeastern-stamp-expo', 'southeastern-stamp-expo', 'Southeastern Stamp Expo', 'http://www.sefsc.org', 1, 3, 'Hilton Atlanta Northeast', 'Peachtree Corners', '{learning}', false, 'convention',
 'Annual philatelic exhibition featuring stamp dealers, exhibits, and educational programs for collectors of all levels.'),

('atlanta-bead-show', 'atlanta-bead-show', 'Atlanta Bead Show', NULL, 1, 2, 'Gwinnett County Fairgrounds', 'Lawrenceville', '{art,learning}', false, 'convention',
 'Rare beads, gems, precious stones, crystals, pearls, and finished jewelry from dealers across the country. Classes and demonstrations for beaders of all skill levels.'),

('atlanta-record-show', 'atlanta-record-show', 'Atlanta Record & CD Show', NULL, NULL, 1, 'IAM Union Hall', 'Marietta', '{music}', false, 'convention',
 'Quarterly vinyl record and CD show with 100+ vendor tables. Crate diggers'' paradise for rare pressings, vintage vinyl, and music memorabilia.'),

('international-woodworking-fair', 'international-woodworking-fair', 'International Woodworking Fair', 'https://www.iwfatlanta.com', 8, 4, 'Georgia World Congress Center', 'Downtown', '{art,learning}', false, 'convention',
 'North America''s largest woodworking technology and design trade show with 30,000+ attendees. Machinery, tools, materials, and techniques for woodworking professionals and enthusiasts.'),

('conyers-kennel-club', 'conyers-kennel-club', 'Conyers Kennel Club Dog Show', 'https://conyerskennelclub.org/events', 6, 4, 'Atlanta Expo Center', 'Jonesboro', '{family}', false, 'convention',
 'AKC-sanctioned dog show featuring conformation, obedience, rally, agility, and breed judging. Watch hundreds of breeds compete for Best in Show.'),

('atlanta-camping-rv-show', 'atlanta-camping-rv-show', 'Atlanta Camping & RV Show', 'https://atlantarvshow.com', 1, 4, 'Georgia World Congress Center', 'Downtown', '{family}', false, 'convention',
 'Annual RV and camping show at GWCC featuring 150+ fully-staged new RVs, camping gear, outdoor recreation exhibits, and destination planning.'),

('rk-gun-show-atlanta', 'rk-gun-show-atlanta', 'R.K. Atlanta Gun Show', 'https://rkshows.com', NULL, 2, 'Atlanta Expo Center', 'Jonesboro', '{learning}', false, 'convention',
 'Bimonthly firearms show at Atlanta Expo Center with dealers selling firearms, ammunition, accessories, and outdoor gear. One of the largest gun shows in the Southeast.'),

-- FOOD FESTIVALS
('atlanta-pizza-festival', 'atlanta-pizza-festival', 'Atlanta Pizza Festival', NULL, 5, 1, 'Atlantic Station', 'Midtown', '{food_drink,family}', false, 'festival',
 'Top pizzerias showcase their best slices and pies. Pizza competitions, craft beer, live music, and family activities at Atlantic Station.'),

('smyrna-oysterfest', 'smyrna-oysterfest', 'Smyrna Oysterfest', 'https://atkinspark.com', 1, 3, 'Atkins Park Smyrna', 'Smyrna', '{food_drink,music}', false, 'festival',
 'Mardi Gras-inspired oyster festival in Smyrna. Raw, grilled, and fried oysters, Abita beer, live music, and New Orleans-style revelry. A winter highlight.'),

('atlanta-mac-cheese-fest', 'atlanta-mac-cheese-fest', 'Atlanta Mac & Cheese Festival', NULL, 11, 1, 'Atlanta', 'Atlanta', '{food_drink,family}', false, 'festival',
 'Top chefs and food trucks compete for mac and cheese supremacy. Unlimited tastings of creative mac and cheese creations alongside live music.'),

-- HOLIDAY / SEASONAL
('countdown-over-atl', 'countdown-over-atl', 'Countdown Over ATL', 'https://www.atlantaga.gov', 12, 1, 'Downtown Atlanta', 'Downtown', '{music,community}', true, 'festival',
 'Atlanta''s New Year''s Eve celebration replacing the traditional Peach Drop. Drone peach display at 11:45pm, citywide synchronized fireworks at midnight, and live entertainment across Downtown and Midtown.'),

('stone-mountain-dino-fest', 'stone-mountain-dino-fest', 'Dino Fest at Stone Mountain', 'https://stonemountainpark.com', 3, 49, 'Stone Mountain Park', 'Stone Mountain', '{family,learning}', false, 'festival',
 'Interactive dinosaur experience at Stone Mountain Park running weekends from March through April. Life-size animatronic dinosaurs, fossil dig, dino encounters, and educational activities.'),

('lake-lanier-oktoberfest', 'lake-lanier-oktoberfest', 'Lake Lanier Oktoberfest', 'https://www.lanierislands.com', 10, 2, 'Lanier Islands Resort', 'Buford', '{food_drink,music}', false, 'festival',
 'Bavarian-themed festival at Lake Lanier with German beer, bratwurst, pretzels, traditional music, stein-holding competitions, and lakeside atmosphere.'),

-- SUBURBAN
('taste-of-tucker', 'taste-of-tucker', 'Taste of Tucker', 'https://downtowntucker.com', 10, 2, 'Downtown Tucker', 'Tucker', '{food_drink,music}', false, 'festival',
 'Local restaurants showcase their best dishes in downtown Tucker. Live music, craft vendors, and community celebration benefiting local charities.'),

('norcross-irish-fest', 'norcross-irish-fest', 'Norcross Irish Fest', 'https://www.norcrossga.net', 3, 1, 'Downtown Norcross', 'Norcross', '{music,food_drink,community}', true, 'festival',
 'St. Patrick''s Day celebration in charming downtown Norcross with Irish music, dancers, food, beer, and green-themed festivities.'),

('acworth-beer-wine-fest', 'acworth-beer-wine-fest', 'Acworth Beer & Wine Festival', 'https://www.acworth.com', 10, 1, 'Downtown Acworth', 'Acworth', '{food_drink,music}', false, 'festival',
 'Craft beer and wine tasting in historic downtown Acworth. Local breweries, Georgia wineries, live music, and food vendors on the lake.'),

-- ADULT / NICHE CONS
('frolicon', 'frolicon', 'Frolicon', 'https://frolicon.com', 5, 4, 'Sheraton Atlanta Hotel', 'Downtown', '{community}', false, 'convention',
 'Four-day adults-only sci-fi and fantasy convention blending genre fandom with alternative lifestyle programming. Workshops, panels, parties, and social gatherings.'),

-- VENUE SPECIAL EVENTS (festival-scale)
('braves-fest', 'braves-fest', 'Braves Fest', 'https://www.mlb.com/braves', 1, 1, 'Truist Park / The Battery', 'Cumberland', '{fitness,family}', false, 'festival',
 'Annual fan festival at Truist Park and The Battery. Player meet-and-greets, autograph sessions, interactive exhibits, kids activities, and first look at the upcoming Braves season.'),

('braves-country-fest', 'braves-country-fest', 'Braves Country Fest', 'https://www.mlb.com/braves/fans/music-fest', 6, 1, 'Truist Park', 'Cumberland', '{music}', false, 'festival',
 'Country music festival at Truist Park featuring major country artists. Full concert experience in the ballpark with food, drinks, and Braves-themed fun.'),

('sips-under-the-sea', 'sips-under-the-sea', 'Sips Under the Sea', 'https://www.georgiaaquarium.org', 2, 1, 'Georgia Aquarium', 'Downtown', '{food_drink}', false, 'festival',
 'Adults-only evening at the Georgia Aquarium with cocktails, live music, and DJ sets surrounded by whale sharks, manta rays, and beluga whales. Multiple themed nights throughout the year.'),

('fernbank-after-dark', 'fernbank-after-dark', 'Fernbank After Dark', 'https://fernbankmuseum.org', NULL, 1, 'Fernbank Museum', 'Druid Hills', '{learning,food_drink}', false, 'festival',
 'Monthly adults-only Friday night event at Fernbank Museum. Cocktails, live music, DJs, and after-hours access to exhibits including the dinosaur galleries. Rotating themes.'),

('pullman-yards-atlanta-art-fair', 'pullman-yards-atlanta-art-fair', 'Atlanta Art Fair', 'https://www.pullmanyards.com/events', 10, 4, 'Pullman Yards', 'Kirkwood', '{art}', false, 'festival',
 'Contemporary art fair at the atmospheric Pullman Yards featuring galleries and independent artists from around the world. Immersive installations, performances, and artist talks.')

ON CONFLICT (slug) DO NOTHING;
