-- Add notable metro Atlanta area festivals worth traveling for
-- Focus on established events with significant draw (10k+ attendance or unique appeal)

INSERT INTO festivals (id, slug, name, website, typical_month, typical_duration_days, location, neighborhood, categories, free, festival_type, description) VALUES

-- MAJOR SUBURBAN FESTIVALS
('gwinnett-county-fair', 'gwinnett-county-fair', 'Gwinnett County Fair', 'https://www.gwinnettcountyfair.com', 9, 11, 'Gwinnett County Fairgrounds', 'Lawrenceville', '{family,food_drink,music}', false, 'festival',
 'The largest county fair in metro Atlanta with 240,000+ annual visitors. Rides, livestock shows, live entertainment, fair food, and agricultural exhibits over 11 days in September.'),

('cumming-country-fair', 'cumming-country-fair', 'Cumming Country Fair & Festival', 'https://cummingfair.squarespace.com', 10, 11, 'Cumming Fairgrounds', 'Cumming', '{family,food_drink,music}', false, 'festival',
 'Massive 11-day fair in Forsyth County drawing 250,000+ visitors. Carnival rides, agricultural exhibits, live entertainment, demolition derby, and classic fair food.'),

('duluth-fall-festival', 'duluth-fall-festival', 'Duluth Fall Festival', 'https://duluthfallfestival.org', 9, 2, 'Downtown Duluth', 'Duluth', '{community,music,art}', true, 'festival',
 'Named one of the top 24 fall festivals in the nation. Arts and crafts vendors, live music stages, food court, kids zone, and community celebration in historic downtown Duluth.'),

('brookhaven-cherry-blossom', 'brookhaven-cherry-blossom', 'Brookhaven Cherry Blossom Festival', 'https://www.brookhavenga.gov/159/Cherry-Blossom-Festival', 3, 2, 'Blackburn Park', 'Brookhaven', '{music,art,family}', true, 'festival',
 'Major spring music festival in Brookhaven''s Blackburn Park featuring national headliners, local artists, food vendors, kids area, and 5K race among the cherry blossoms.'),

('taste-of-marietta', 'taste-of-marietta', 'Taste of Marietta', 'https://www.marietta.com/calendar-of-events', 4, 1, 'Marietta Square', 'Marietta', '{food_drink,music}', true, 'festival',
 'Annual food festival on the historic Marietta Square showcasing dozens of local restaurants. Live music, kids activities, and tastings from Marietta''s best dining.'),

('dunwoody-art-festival', 'dunwoody-art-festival', 'Dunwoody Art Festival', 'https://www.discoverdunwoody.com/events/annual-events/', 5, 2, 'Brook Run Park', 'Dunwoody', '{art,family}', true, 'festival',
 'Juried fine arts festival in Brook Run Park featuring 200+ artists from across the country. Paintings, sculpture, photography, jewelry, and mixed media alongside live music and food.'),

('stone-mountain-highland-games', 'stone-mountain-highland-games', 'Stone Mountain Highland Games', 'https://www.smhg.org', 10, 3, 'Stone Mountain Park', 'Stone Mountain', '{community,music,fitness}', false, 'festival',
 'Annual Scottish Highland Games at Stone Mountain Park. Heavy athletics (caber toss, hammer throw), pipe and drum bands, Celtic music, Highland dancing, Scottish food, and clan gatherings.'),

('conyers-cherry-blossom', 'conyers-cherry-blossom', 'Conyers Cherry Blossom Festival', 'https://visitconyersga.com/cherry-blossom-festival/', 3, 2, 'Georgia International Horse Park', 'Conyers', '{community,music,family}', true, 'festival',
 'One of the oldest cherry blossom festivals in Georgia (45+ years). Held at the Georgia International Horse Park with live music, arts and crafts, food, and thousands of blooming cherry trees.'),

-- NORTH GEORGIA DESTINATION FESTIVALS
('dahlonega-gold-rush-days', 'dahlonega-gold-rush-days', 'Dahlonega Gold Rush Days', 'https://goldrushdaysfestival.com', 10, 2, 'Dahlonega Town Square', 'Dahlonega', '{community,family,music}', true, 'festival',
 'Dahlonega''s signature festival celebrating the site of America''s first major gold rush. Arts and crafts, gold panning, live entertainment, parade, and mountain food on the historic town square.'),

('dahlonega-arts-wine', 'dahlonega-arts-wine', 'Dahlonega Arts & Wine Festival', 'https://www.dahlonega.org/events/', 5, 2, 'Dahlonega Town Square', 'Dahlonega', '{art,food_drink}', false, 'festival',
 'Voted Best Festival in Georgia. Juried art show, North Georgia wine tastings from local vineyards, live music, and mountain cuisine on the Dahlonega town square.'),

('blue-ridge-blues-bbq', 'blue-ridge-blues-bbq', 'Blue Ridge Blues & BBQ Festival', 'https://www.blueridgemountains.com/events/', 9, 1, 'Downtown Blue Ridge', 'Blue Ridge', '{music,food_drink}', true, 'festival',
 'Free blues music festival in downtown Blue Ridge with BBQ cook-off competition. Multiple stages of live blues, BBQ vendors, craft beer, and mountain town atmosphere.'),

-- CHEROKEE COUNTY
('canton-wing-rock-fest', 'canton-wing-rock-fest', 'Wing & Rock Fest', 'https://www.wingandrockfest.com', 3, 2, 'Downtown Canton', 'Canton', '{food_drink,music}', false, 'festival',
 'The largest wing festival in the Southeast. Wing eating competitions, live rock music, craft beer, and food vendors in historic downtown Canton.'),

('canton-riverfest', 'canton-riverfest', 'Canton Riverfest', 'https://serviceleague.net/fundraisers/riverfest/', 9, 2, 'Heritage Park, Canton', 'Canton', '{music,community,family}', true, 'festival',
 'Annual festival along the Etowah River drawing 25,000+ visitors. Live music, arts and crafts, kayak races, kids activities, and food vendors at Heritage Park.'),

-- GWINNETT
('norcross-art-splash', 'norcross-art-splash', 'Norcross Art Splash', 'https://www.norcrossga.net/2061/Events', 10, 1, 'Downtown Norcross', 'Norcross', '{art,music}', true, 'festival',
 'One of metro Atlanta''s biggest juried art festivals in charming downtown Norcross. Fine art vendors, live music, interactive art projects, and food in the historic district.'),

('suwanee-arts-festival', 'suwanee-arts-festival', 'Suwanee Arts Festival', 'https://www.suwaneeartscenter.org/suwaneeartsfest', 4, 2, 'Town Center Park, Suwanee', 'Suwanee', '{art,music,family}', true, 'festival',
 'Juried fine art festival in Suwanee''s Town Center Park featuring 150+ artists, interactive kids area, live entertainment, and food trucks.'),

-- COBB COUNTY
('chalktoberfest', 'chalktoberfest', 'Chalktoberfest', 'https://chalktoberfest.com', 10, 2, 'Marietta Square', 'Marietta', '{art,food_drink}', true, 'festival',
 'Unique chalk art festival on the Marietta Square. Professional and amateur artists transform the streets into massive chalk murals. Combined with Oktoberfest food, beer, and live music.'),

('smyrna-jonquil-festival', 'smyrna-jonquil-festival', 'Smyrna Spring Jonquil Festival', 'https://www.smyrnacity.com', 4, 2, 'Village Green, Smyrna', 'Smyrna', '{community,music,family}', true, 'festival',
 'Smyrna''s signature spring festival celebrating the blooming jonquils. Carnival rides, live music, arts and crafts, food vendors, and the famous bed race through the Village Green.'),

('acworth-dragon-boat-festival', 'acworth-dragon-boat-festival', 'Acworth Dragon Boat Festival', 'https://www.acworth.com', 5, 1, 'Lake Acworth', 'Acworth', '{fitness,community}', false, 'festival',
 'Dragon boat racing on Lake Acworth with teams competing in the ancient Chinese sport. Cultural demonstrations, food, and lakeside spectating in the Lake City.'),

-- SOUTH METRO
('geranium-festival', 'geranium-festival', 'Geranium Festival', 'https://geraniumfestival.com', 5, 2, 'McDonough Square', 'McDonough', '{community,art,family}', true, 'festival',
 'McDonough''s beloved spring festival drawing 25,000+ visitors to the historic square. 325 exhibitors, arts and crafts, live entertainment, kids activities, and of course, geraniums.'),

('newnan-porchfest', 'newnan-porchfest', 'Newnan Porchfest', 'https://explorenewnancoweta.com/things-to-do/events/', 5, 1, 'Historic Newnan', 'Newnan', '{music,community}', true, 'festival',
 'Free walking music festival where bands play on porches and lawns throughout historic downtown Newnan. Stroll between stages and discover local and regional musicians.'),

-- DEKALB
('lemonade-days', 'lemonade-days', 'Lemonade Days', 'https://www.dunwoodyga.gov', 4, 5, 'Brook Run Park', 'Dunwoody', '{family,community}', true, 'festival',
 'Dunwoody''s week-long spring celebration at Brook Run Park. Carnival rides, live music, food vendors, 5K run, art shows, and family activities culminating in a weekend festival.'),

-- CULTURAL
('johns-creek-international-fest', 'johns-creek-international-fest', 'Johns Creek International Festival', 'https://johnscreekga.gov/events/', 5, 1, 'Heisman Field, Johns Creek', 'Johns Creek', '{community,food_drink,music}', true, 'festival',
 'Celebration of Johns Creek''s remarkable diversity with cultural performances, international food, music from around the world, and heritage showcases from the community''s many cultures.'),

('covington-vampire-diaries-fest', 'covington-vampire-diaries-fest', 'Vampire Diaries Festival', 'https://creationent.com', 3, 2, 'Downtown Covington', 'Covington', '{film,community}', false, 'convention',
 'Fan convention in Covington — the real-life filming location of The Vampire Diaries. Celebrity guests, filming location tours, photo ops, and panels in Mystic Falls itself.'),

-- UNIQUE NICHE
('smoke-on-the-lake', 'smoke-on-the-lake', 'Smoke on the Lake BBQ Festival', 'https://www.smokeonthelake.org', 5, 1, 'Cauble Park, Acworth', 'Acworth', '{food_drink,music}', false, 'festival',
 'KCBS-sanctioned BBQ competition on the shores of Lake Acworth. Pro pitmasters compete while attendees enjoy samples, craft beer, live music, and lakeside atmosphere. Mother''s Day weekend.'),

('blue-ridge-trout-fest', 'blue-ridge-trout-fest', 'Blue Ridge Trout & Outdoor Adventures Festival', 'https://blueridgetroutfest.com', 4, 1, 'Downtown Blue Ridge', 'Blue Ridge', '{community,family}', true, 'festival',
 'Celebration of North Georgia''s outdoor lifestyle. Fly fishing demos, trout cooking competitions, outdoor gear vendors, live music, and mountain culture in downtown Blue Ridge.')

ON CONFLICT (slug) DO NOTHING;
