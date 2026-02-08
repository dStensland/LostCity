-- Second batch: cultural festivals, athletic events, holiday spectacles,
-- niche cons, food fests, suburban events, and motorsports

INSERT INTO festivals (id, slug, name, website, typical_month, typical_duration_days, location, neighborhood, categories, free, festival_type, description) VALUES

-- CULTURAL & HERITAGE
('atlanta-greek-festival', 'atlanta-greek-festival', 'Atlanta Greek Festival', 'https://www.atlantagreekfestival.org', 9, 3, 'Cathedral of the Annunciation', 'Buckhead', '{food_drink,community}', false, 'festival',
 'Over 50 years of authentic Greek food, pastries, live music, folk dancing, Cathedral tours, and marketplace at the Cathedral of the Annunciation. A beloved Atlanta tradition.'),

('japanfest-atlanta', 'japanfest-atlanta', 'JapanFest Atlanta', 'https://www.japanfest.org', 9, 2, 'Gas South Convention Center', 'Duluth', '{community,art,food_drink}', false, 'festival',
 'Taiko drums, traditional dance, martial arts demonstrations, Japanese cuisine, anime culture, and cultural workshops. One of the largest Japanese cultural festivals in the Southeast.'),

('juneteenth-atlanta', 'juneteenth-atlanta', 'Juneteenth Atlanta Parade & Music Festival', 'https://www.juneteenthatl.com', 6, 3, 'Piedmont Park', 'Midtown', '{community,music}', true, 'festival',
 'One of the largest Juneteenth celebrations in the country with 100,000+ visitors. Freedom Parade, 5K run, artist market, food court, STEM workshops, and live music in Piedmont Park.'),

('irishfest-atlanta', 'irishfest-atlanta', 'IrishFest Atlanta', 'https://www.irishfestatlanta.org', 11, 2, 'Roswell Cultural Arts Center', 'Roswell', '{music,community}', false, 'festival',
 'World-class Irish musicians, singers, artists, and dancers celebrate Celtic culture in Roswell. Traditional and contemporary Irish music, dance performances, and cultural exhibits.'),

('atlanta-caribbean-carnival-v2', 'atlanta-caribbean-carnival', 'Atlanta Caribbean Carnival', 'https://www.atlantacarnival.org', 5, 1, 'Downtown Atlanta', 'Downtown', '{community,music}', true, 'festival',
 'The 39th annual Caribbean carnival parade and festival celebrating Caribbean culture with steel drums, soca music, elaborate masquerade costumes, and island cuisine.'),

('hoi-cho-tet-atlanta', 'hoi-cho-tet-atlanta', 'Hoi Cho Tet Atlanta', 'https://hoichotetatlanta.com', 1, 1, 'Atlanta', 'Atlanta', '{community,food_drink}', false, 'festival',
 'Vietnamese Lunar New Year celebration with traditional music, dance, food marketplace, and cultural demonstrations honoring Vietnamese heritage and traditions.'),

('stone-mountain-lunar-new-year', 'stone-mountain-lunar-new-year', 'Stone Mountain Lunar New Year Festival', 'https://stonemountainpark.com', 2, 14, 'Stone Mountain Park', 'Stone Mountain', '{community,family}', false, 'festival',
 'Multi-week celebration honoring Korean, Chinese, and Vietnamese cultures at Stone Mountain Park. Drone light shows, lighted parade, craft activities, and cultural performances.'),

('panda-fest-atlanta', 'panda-fest-atlanta', 'Panda Fest Atlanta', 'https://pandafests.com', 4, 3, 'Atlanta', 'Atlanta', '{food_drink,community}', false, 'festival',
 'One of the largest outdoor Asian food festivals in the US. Celebrates AAPI cultures through food, art, and traditions with vendors from diverse Asian cuisines.'),

('stone-mountain-latino-fest', 'stone-mountain-latino-fest', 'Stone Mountain Latino Family Festival', 'https://stonemountainpark.com', 4, 2, 'Stone Mountain Park', 'Stone Mountain', '{community,family,music}', false, 'festival',
 'Drone light shows, parade, Aztec dancers, Colombian and Mexican ballet, Flamenco, Mariachi bands, and Latin food celebrating Hispanic heritage at Stone Mountain Park.'),

('southern-fried-queer-pride', 'southern-fried-queer-pride', 'Southern Fried Queer Pride', 'https://www.southernfriedqueerpride.com', 6, 7, 'Little Five Points', 'Little Five Points', '{community,music,art}', true, 'festival',
 'Week-long LGBTQ+ arts and culture festival in Little Five Points featuring performances, art shows, community gatherings, and celebrations of queer Southern identity.'),

-- ATHLETIC EVENTS
('peachtree-road-race', 'peachtree-road-race', 'AJC Peachtree Road Race', 'https://www.atlantatrackclub.org/peachtree', 7, 1, 'Buckhead to Piedmont Park', 'Buckhead', '{fitness,community}', false, 'festival',
 'The world''s largest 10K race with 60,000+ runners on July 4th. A dozen bands and DJs along the 6.2-mile route from Buckhead to Piedmont Park. Atlanta''s quintessential Independence Day tradition.'),

('atlanta-marathon', 'atlanta-marathon', 'Publix Atlanta Marathon', 'https://www.atlantatrackclub.org', 2, 2, 'Downtown Atlanta', 'Downtown', '{fitness}', false, 'festival',
 'Marathon, half marathon, 5K, and kids race through Atlanta''s iconic neighborhoods. The half marathon is a USATF Championship event. Finish at Home Depot Backyard.'),

('thanksgiving-half-marathon', 'thanksgiving-half-marathon', 'Atlanta Thanksgiving Day Half Marathon', 'https://www.atlantatrackclub.org', 11, 1, 'Center Parc Stadium', 'Downtown', '{fitness}', false, 'festival',
 'Thanksgiving morning tradition running 13.1 miles through Inman Park, Old Fourth Ward, Grant Park, and Little Five Points. One of the country''s premier Turkey Trot events.'),

('spartan-race-atlanta', 'spartan-race-atlanta', 'Spartan Race Atlanta', 'https://www.spartan.com', 3, 2, 'Georgia International Horse Park', 'Conyers', '{fitness}', false, 'festival',
 'Sprint, Super, Beast, and Kids obstacle course races on the rolling hills and red clay of the Georgia International Horse Park in Conyers.'),

('aids-walk-atlanta', 'aids-walk-atlanta', 'AIDS Walk Atlanta & 5K Run', 'https://www.aidatlanta.org/aidswalk', 9, 1, 'Piedmont Park', 'Midtown', '{fitness,community}', false, 'festival',
 '5K walk and run in Piedmont Park benefiting HIV/AIDS organizations. Music festival, AIDS Memorial Quilt display, food trucks, and community gathering.'),

-- HOLIDAY SPECTACLES
('stone-mountain-christmas', 'stone-mountain-christmas', 'Stone Mountain Christmas', 'https://stonemountainpark.com', 11, 56, 'Stone Mountain Park', 'Stone Mountain', '{family}', false, 'festival',
 'Two million lights, the world''s largest Christmas light display, drone shows, Skyride to the North Pole, Snow Mountain tubing, and holiday entertainment at Stone Mountain Park.'),

('lake-lanier-lights', 'lake-lanier-lights', 'Magical Nights of Lights', 'https://www.lanierislands.com', 11, 50, 'Lanier Islands Resort', 'Buford', '{family}', false, 'festival',
 'Six-mile drive-through with over a million lights at Lake Lanier. Santa visits, ice skating, snow tubing, and holiday festivities from mid-November through early January.'),

('garden-lights-holiday-nights', 'garden-lights-holiday-nights', 'Garden Lights, Holiday Nights', 'https://atlantabg.org', 11, 56, 'Atlanta Botanical Garden', 'Midtown', '{art,family}', false, 'festival',
 'Synchronized light and sound shows, enchanted trees, glowing orbs, and thousands of lights transforming the Atlanta Botanical Garden into a winter wonderland.'),

('illuminights-zoo', 'illuminights-zoo', 'IllumiNights at the Zoo', 'https://zooatlanta.org', 11, 45, 'Zoo Atlanta', 'Grant Park', '{family,art}', false, 'festival',
 'Mile-long trail of illuminated wildlife lanterns at Zoo Atlanta. Marshmallow roasts, carousel rides, and festive activities on select nights through mid-January.'),

('atlanta-christkindl-market', 'atlanta-christkindl-market', 'Atlanta Christkindl Market', 'https://www.christkindlmarket.org', 11, 35, 'Downtown Lawrenceville', 'Lawrenceville', '{food_drink,family}', false, 'festival',
 'German Christmas market with 20-30 vendors, Ferris wheel, live music, and holiday food. Authentically modeled after traditional European Weihnachtsmarkt.'),

-- FOOD & DRINK
('beer-bourbon-bbq', 'beer-bourbon-bbq', 'Beer, Bourbon & BBQ Festival', 'https://atlanta.beerandbourbon.com', 2, 1, 'Atlantic Station', 'Midtown', '{food_drink,music}', false, 'festival',
 '60+ craft beers, 40+ bourbons, BBQ from top pitmasters, live music, and bourbon seminars at Atlantic Station.'),

('taste-of-alpharetta', 'taste-of-alpharetta', 'Taste of Alpharetta', 'https://tasteofalpharettaga.com', 5, 1, 'Downtown Alpharetta', 'Alpharetta', '{food_drink,music}', false, 'festival',
 'One of north metro''s biggest food events with 60+ restaurants, 25,000+ attendees, live music, kids zone, and cooking demos in downtown Alpharetta.'),

('atlanta-ice-cream-festival', 'atlanta-ice-cream-festival', 'Atlanta Ice Cream Festival', 'https://atlantaicecreamfestival.com', 7, 1, 'Piedmont Park', 'Midtown', '{food_drink,family}', true, 'festival',
 'Annual celebration of ice cream in Piedmont Park with food vendors, live music, wellness activities, and of course, endless ice cream sampling.'),

('decatur-wine-festival', 'decatur-wine-festival', 'Decatur Wine Festival', 'https://decaturartsalliance.org', 5, 1, 'Decatur Square', 'Decatur', '{food_drink}', false, 'festival',
 '350+ wines from 70 tasting tables benefiting the Decatur Arts Alliance. Held on the charming Decatur Square.'),

('georgia-vegfest', 'georgia-vegfest', 'Georgia VegFest', 'https://vegfestexpos.com', 11, 1, 'Marietta', 'Marietta', '{food_drink,learning}', false, 'festival',
 'Plant-based food festival with vegan and vegetarian vendors, cooking demonstrations, speakers, and wellness exhibitors.'),

('chateau-elan-vineyard-fest', 'chateau-elan-vineyard-fest', 'Chateau Elan Vineyard Fest', 'https://chateauelan.com/vineyardfest/', 11, 2, 'Chateau Elan Winery & Resort', 'Braselton', '{food_drink,music}', false, 'festival',
 'Wine and food festival at Chateau Elan with 30+ wines, chef-crafted bites, live performances, and workshops at North Georgia''s premier winery.'),

-- NICHE CONVENTIONS
('anime-weekend-atlanta', 'anime-weekend-atlanta', 'Anime Weekend Atlanta', 'https://awa-con.com', 11, 4, 'Georgia World Congress Center', 'Downtown', '{gaming,art}', false, 'convention',
 'The Southeast''s largest anime convention. 24-hour programming with AMV contests, concerts, cosplay competitions, artist alley, gaming, and Japanese cultural events at GWCC.'),

('furry-weekend-atlanta', 'furry-weekend-atlanta', 'Furry Weekend Atlanta', 'https://furryweekend.com', 5, 4, 'Atlanta Marriott Marquis', 'Downtown', '{art,community}', false, 'convention',
 'One of the largest furry conventions in the world with 17,000+ attendees. Art shows, dance competitions, charity events, and a Georgia Aquarium takeover.'),

('blade-show', 'blade-show', 'Blade Show', 'https://bladeshow.com', 6, 3, 'Cobb Galleria Centre', 'Cumberland', '{art,learning}', false, 'convention',
 'The world''s largest knife show with 900+ exhibitors. Custom knives, competitions, forging demonstrations, and workshops. The premier event for blade enthusiasts globally.'),

('jordancon', 'jordancon', 'JordanCon', 'https://www.jordancon.org', 4, 3, 'Crowne Plaza Atlanta Perimeter', 'Dunwoody', '{learning,community}', false, 'convention',
 'Fantasy and sci-fi literature convention founded in honor of Robert Jordan (Wheel of Time). Author panels, readings, cosplay, gaming, and literary discussions.'),

('atlanta-brick-con', 'atlanta-brick-con', 'Atlanta Brick Con', 'https://atlantabrickcon.com', 2, 2, 'Gas South Convention Center', 'Duluth', '{family,art}', false, 'convention',
 'The South''s largest LEGO fan event with spectacular displays, build zones, games, speakers, and a STEM zone. Fun for builders of all ages.'),

('atlanta-pen-show', 'atlanta-pen-show', 'Atlanta Pen Show', 'https://www.atlantapenshow.info', 3, 3, 'Sonesta Atlanta Northwest Galleria', 'Cumberland', '{art,learning}', false, 'convention',
 'Weekend gathering for fountain pen enthusiasts featuring vendors, workshops, ink testing, and pen restoration. A niche paradise for stationery lovers.'),

('atlanta-orchid-show', 'atlanta-orchid-show', 'Atlanta Orchid Show', 'https://www.atlantaorchidsociety.org/atlanta-orchid-show/', 3, 3, 'Atlanta Botanical Garden', 'Midtown', '{learning,art}', false, 'convention',
 'The 64th annual orchid show at the Atlanta Botanical Garden. Rare orchid exhibits, sales, and displays from passionate growers. Themed "The Art of Orchids."'),

('southeast-reptile-expo', 'southeast-reptile-expo', 'Southeast Reptile Expo', 'https://www.southeastreptileexpo.com', 1, 2, 'Gas South Convention Center', 'Duluth', '{family,learning}', false, 'convention',
 'Major reptile and exotic animal expo at Gas South. Breeders, vendors, educational exhibits featuring snakes, lizards, turtles, amphibians, and exotic plants.'),

('original-sewing-quilt-expo', 'original-sewing-quilt-expo', 'Original Sewing & Quilt Expo', 'https://www.sewingexpo.com/Events/Atlanta-GA', 3, 3, 'Gas South Convention Center', 'Duluth', '{art,learning}', false, 'convention',
 'Latest sewing, quilting, and embroidery trends with machines, fabrics, patterns, lectures, and hands-on workshops at Gas South.'),

-- MOTORSPORTS
('petit-le-mans', 'petit-le-mans', 'Motul Petit Le Mans', 'https://michelinracewayroadatlanta.com/motul-petit-le-mans', 10, 4, 'Michelin Raceway Road Atlanta', 'Braselton', '{fitness}', false, 'festival',
 'The IMSA WeatherTech Championship season finale — a grueling 10-hour endurance race at Road Atlanta. Four days of racing action drawing 140,000+ motorsport enthusiasts.'),

('caffeine-and-octane-fest', 'caffeine-and-octane-fest', 'Caffeine and Octane', 'https://www.caffeineandoctane.com/c-o-atlanta', NULL, 1, 'Town Center at Cobb', 'Kennesaw', '{community}', true, 'festival',
 'America''s largest monthly car show. 2,500+ vehicles and 30,000+ fans gather the first Sunday of every month in Kennesaw. All makes, models, and eras welcome. Free admission.'),

('atlanta-auto-show', 'atlanta-auto-show', 'Atlanta International Auto Show', 'https://goautoshow.com', 3, 4, 'Georgia World Congress Center', 'Downtown', '{family}', false, 'convention',
 'Annual auto show at GWCC showcasing new models from major manufacturers. Test drives, concept cars, and automotive technology displays.'),

-- COMMUNITY EVENTS
('atlanta-streets-alive', 'atlanta-streets-alive', 'Atlanta Streets Alive', 'https://atlantastreetsalive.org', NULL, 1, 'Various Atlanta streets', 'Atlanta', '{fitness,community}', true, 'festival',
 'Free car-free streets events for bikes, walking, skating, and community gathering. Multiple events per year on different routes including Peachtree Street and BeltLine corridors.'),

('beltline-lantern-parade', 'beltline-lantern-parade', 'Atlanta BeltLine Lantern Parade', 'https://beltline.org', 9, 1, 'Atlanta BeltLine', 'Atlanta', '{art,community}', true, 'festival',
 'Tens of thousands walk the BeltLine carrying handmade lanterns in one of Atlanta''s most magical community events. A celebration of art, light, and neighborhood connection.'),

-- FAIRS
('north-georgia-state-fair', 'north-georgia-state-fair', 'North Georgia State Fair', 'https://www.northgeorgiastatefair.com', 9, 11, 'Jim R. Miller Park', 'Marietta', '{family,food_drink}', false, 'festival',
 'Eleven days of carnival rides, livestock shows, live entertainment, demolition derby, pig races, and classic fair food in Marietta.'),

-- SUBURBAN FESTIVALS
('virginia-highland-summerfest', 'virginia-highland-summerfest', 'Virginia-Highland Summerfest', NULL, 6, 2, 'Virginia-Highland', 'Virginia-Highland', '{art,music,food_drink}', true, 'festival',
 'One of Atlanta''s most popular neighborhood arts and music festivals in the charming Virginia-Highland district. Juried artists market, multiple music stages, and local food vendors.'),

('decatur-arts-festival', 'decatur-arts-festival', 'Decatur Arts Festival', 'https://decaturartsalliance.org', 5, 3, 'Decatur Square', 'Decatur', '{art,music}', true, 'festival',
 'Memorial Day weekend arts festival on and around the Decatur Square. Juried artists market, live music, literary events, kids activities, and the famous ArtWalk.'),

('tucker-day', 'tucker-day', 'Tucker Day', 'https://downtowntucker.com', 5, 1, 'Downtown Tucker', 'Tucker', '{community,music}', true, 'festival',
 'Tucker''s oldest and most beloved community event since 1959. Parade, concerts, food, arts and crafts, and neighborhood celebration in downtown Tucker.'),

('lawrenceville-boogie', 'lawrenceville-boogie', 'Lawrenceville Boogie', 'https://downtownlawrencevillega.com', 4, 1, 'Lawrenceville Square', 'Lawrenceville', '{music,art}', true, 'festival',
 'Free music and arts festival on the Lawrenceville Square. Jazz in the Alley, Beyond the Ribbon Car Show, food trucks, and live entertainment.'),

('bluesberry-norcross', 'bluesberry-norcross', 'Bluesberry Beer & Music Festival', 'https://bluesberrybeerfestival.com', 4, 1, 'Betty Mauldin Park, Norcross', 'Norcross', '{music,food_drink}', false, 'festival',
 'Blues music and blueberry-themed food and drinks in downtown Norcross. Live blues on multiple stages with craft beer and BBQ.'),

('covington-vampire-diaries', 'covington-vampire-diaries', 'Vampire Diaries Festival Covington', 'https://creationent.com', 3, 2, 'Downtown Covington', 'Covington', '{film,community}', false, 'convention',
 'Fan convention in Covington — the real-life filming location of The Vampire Diaries. Celebrity guests, filming location tours, photo ops, and panels in Mystic Falls itself.')

ON CONFLICT (slug) DO NOTHING;
