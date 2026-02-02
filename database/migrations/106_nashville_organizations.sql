-- ============================================
-- MIGRATION 106: Nashville Metro Organizations
-- Import 48+ organizations for Nashville portal
-- ============================================

-- Note: This migration assumes migration 010_content_expansion.sql has been run
-- to create the event_producers table

-- Insert Nashville Metro Organizations
INSERT INTO event_producers (id, name, slug, org_type, website, city, neighborhood, categories, description, instagram, facebook, twitter) VALUES

-- MUSIC INDUSTRY ORGANIZATIONS
('country-music-association', 'Country Music Association', 'country-music-association', 'music_industry', 'https://cmaworld.com', 'Nashville', 'Music Row', ARRAY['music'], 'Trade organization supporting country music industry. Produces CMA Awards and CMA Fest, one of Nashville''s largest music events.', 'cma', 'CountryMusicAssociation', 'CountryMusic'),

('americana-music-association', 'Americana Music Association', 'americana-music-association', 'music_industry', 'https://americanamusic.org', 'Nashville', 'Downtown', ARRAY['music'], 'Professional trade organization devoted to Americana music. Produces annual AmericanaFest and Honors & Awards show.', 'americanamusic', 'americanamusicassociation', 'AmericanaMusHQ'),

('nashville-songwriters-association', 'Nashville Songwriters Association International', 'nashville-songwriters-association', 'music_industry', 'https://nashvillesongwriters.com', 'Nashville', 'Music Row', ARRAY['music'], 'World''s largest not-for-profit songwriters trade organization. Offers workshops, events, and songwriter advocacy.', 'nashvillesongwriters', 'NashvilleSongwriters', 'NSAI'),

('gospel-music-association', 'Gospel Music Association', 'gospel-music-association', 'music_industry', 'https://gospelmusic.org', 'Nashville', 'Downtown', ARRAY['music'], 'Serves the Gospel and Christian music industry. Produces Dove Awards and hosts educational events.', 'gospelmusicassociation', 'GospelMusicAssociation', 'TheGMAssoc'),

('musicians-hall-of-fame', 'Musicians Hall of Fame and Museum', 'musicians-hall-of-fame', 'music_museum', 'https://musicianshalloffame.com', 'Nashville', 'Downtown', ARRAY['music', 'art'], 'Museum and hall of fame honoring musicians of all genres. Hosts exhibits, events, and live performances.', 'musicianshallfame', 'musicianshallfame', NULL),

('nashville-music-equality', 'Nashville Music Equality', 'nashville-music-equality', 'nonprofit', 'https://nashvillemusicequality.org', 'Nashville', NULL, ARRAY['music'], 'Non-profit promoting diversity and inclusion in Nashville''s music industry through education and advocacy.', NULL, NULL, NULL),

-- ARTS & CULTURE ORGANIZATIONS
('metro-arts-nashville', 'Metro Arts Nashville', 'metro-arts-nashville', 'arts_nonprofit', 'https://www.nashville.gov/departments/metro-arts', 'Nashville', 'Downtown', ARRAY['art', 'theater', 'music'], 'Official arts commission of Metropolitan Nashville. Supports artists, grants, public art, and cultural programs citywide.', 'metroartsnashville', 'MetroArtsNashville', 'MetroArtsNash'),

('oz-arts-nashville', 'OZ Arts Nashville', 'oz-arts-nashville', 'arts_nonprofit', 'https://ozartsnashville.org', 'Nashville', 'WeGo', ARRAY['art', 'theater', 'music'], 'Contemporary arts center presenting multidisciplinary performances, exhibitions, and educational programs.', 'ozartsnashville', 'OzArtsNashville', 'OzArtsNash'),

('nashville-arts-coalition', 'Nashville Arts Coalition', 'nashville-arts-coalition', 'arts_nonprofit', 'https://nashvilleartscoalition.com', 'Nashville', NULL, ARRAY['art', 'music'], 'Collective of artists and organizations advocating for Nashville''s creative community and cultural policy.', 'nashvilleartscoalition', 'NashvilleArtsCoalition', NULL),

('frist-art-museum', 'Frist Art Museum', 'frist-art-museum', 'museum', 'https://fristartmuseum.org', 'Nashville', 'Downtown', ARRAY['art'], 'Premier visual arts museum in a stunning Art Deco building. Rotating exhibitions, family programs, and art classes.', 'fristartmuseum', 'FristArtMuseum', 'FristArtMuseum'),

('tennessee-performing-arts-center', 'Tennessee Performing Arts Center', 'tennessee-performing-arts-center', 'performing_arts', 'https://tpac.org', 'Nashville', 'Downtown', ARRAY['theater', 'music'], 'Major performing arts center hosting Broadway tours, Nashville Ballet, Nashville Opera, and special events.', 'tpacnashville', 'TPAC', 'TPAC'),

('nashville-symphony', 'The Nashville Symphony', 'nashville-symphony', 'performing_arts', 'https://nashvillesymphony.org', 'Nashville', 'Downtown', ARRAY['music'], 'Grammy-winning orchestra performing classical, pops, and film concerts at Schermerhorn Symphony Center.', 'nashvillesymphony', 'NashvilleSymphony', 'NashSymphony'),

('nashville-ballet', 'Nashville Ballet', 'nashville-ballet', 'performing_arts', 'https://nashvilleballet.com', 'Nashville', 'Downtown', ARRAY['theater'], 'Professional ballet company presenting classical and contemporary works at TPAC and regional venues.', 'nashvilleballet', 'NashvilleBallet', 'NashvilleBallet'),

('nashville-opera', 'Nashville Opera', 'nashville-opera', 'performing_arts', 'https://nashvilleopera.org', 'Nashville', 'Downtown', ARRAY['music', 'theater'], 'Opera company presenting classic and contemporary productions at TPAC and community venues.', 'nashvilleopera', 'NashvilleOpera', 'NashvilleOpera'),

-- COMMUNITY NONPROFITS
('nashville-public-library', 'Nashville Public Library', 'nashville-public-library', 'library', 'https://library.nashville.org', 'Nashville', 'Downtown', ARRAY['community', 'family'], 'Public library system with 21 branches offering programs, events, maker spaces, and community resources.', 'nashvillepubliclibrary', 'NashvillePublicLibrary', 'Nashville_Lib'),

('hands-on-nashville', 'Hands On Nashville', 'hands-on-nashville', 'nonprofit', 'https://hon.org', 'Nashville', NULL, ARRAY['community'], 'Volunteer organization connecting people with service opportunities. Hosts annual GiveCamp and volunteer events.', 'handsonnashville', 'HandsOnNashville', 'HandsOnNash'),

('nashville-rescue-mission', 'Nashville Rescue Mission', 'nashville-rescue-mission', 'nonprofit', 'https://nashvillerescuemission.org', 'Nashville', NULL, ARRAY['community'], 'Homeless services organization offering shelter, meals, recovery programs, and community support.', 'nrmnashville', 'NashvilleRescueMission', NULL),

('second-harvest-food-bank', 'Second Harvest Food Bank of Middle Tennessee', 'second-harvest-food-bank', 'nonprofit', 'https://secondharvestmidtn.org', 'Nashville', NULL, ARRAY['community'], 'Regional food bank serving 46 counties. Organizes food drives, volunteer opportunities, and hunger-relief events.', 'secondharvestmidtn', 'SecondHarvestMiddleTN', '2HarvestMiddleTN'),

('habitat-for-humanity-nashville', 'Habitat for Humanity Nashville', 'habitat-for-humanity-nashville', 'nonprofit', 'https://habitatnashville.org', 'Nashville', NULL, ARRAY['community'], 'Affordable housing nonprofit organizing build days, ReStore events, and home dedication ceremonies.', 'habitatnashville', 'GreaterNashvilleHabitat', 'HabitatNash'),

('nashville-farmers-market', 'Nashville Farmers'' Market', 'nashville-farmers-market', 'public_market', 'https://nashvillefarmersmarket.org', 'Nashville', 'Germantown', ARRAY['food_drink', 'community'], 'Year-round farmers market with vendors, restaurants, special events, and seasonal programming.', 'nashvillefarmersmarket', 'NashvilleFarmersMarket', 'ShopNFM'),

-- BUSINESS & PROFESSIONAL
('nashville-chamber', 'Nashville Area Chamber of Commerce', 'nashville-chamber', 'business', 'https://nashvillechamber.com', 'Nashville', 'Downtown', ARRAY['community'], 'Business advocacy and economic development organization. Hosts networking events, policy forums, and business conferences.', 'nashvillechamber', 'NashvilleChamber', 'NashvilleChamber'),

('nashville-technology-council', 'Nashville Technology Council', 'nashville-technology-council', 'business', 'https://nashvilletechnologycouncil.com', 'Nashville', NULL, ARRAY['community'], 'Tech industry association hosting networking events, educational programs, and startup support.', 'nashvilletechcouncil', 'nashvilletechnologycouncil', 'NashvilleTech'),

('nashville-entrepreneur-center', 'Nashville Entrepreneur Center', 'nashville-entrepreneur-center', 'business', 'https://ec.co', 'Nashville', 'Downtown', ARRAY['community'], 'Startup hub offering coworking, accelerators, mentorship, and entrepreneurial events and workshops.', 'thenec', 'nashvilleentrepreneursclub', 'TheNEC'),

('music-city-center', 'Music City Center', 'music-city-center', 'convention_center', 'https://nashvillemcc.com', 'Nashville', 'Downtown', ARRAY['community'], 'Major convention center hosting conferences, trade shows, concerts, and large public events.', 'musiccitycenter', 'MusicCityCenter', 'MusicCityCenter'),

-- LGBTQ+ ORGANIZATIONS
('nashville-pride', 'Nashville Pride', 'nashville-pride', 'lgbtq', 'https://nashvillepride.org', 'Nashville', NULL, ARRAY['community', 'nightlife'], 'Organizes annual Pride Festival & Parade, year-round events supporting LGBTQ+ community and equality.', 'nashvillepride', 'NashvillePride', 'NashvillePride'),

('tennessee-equality-project', 'Tennessee Equality Project', 'tennessee-equality-project', 'lgbtq', 'https://tnequality.org', 'Nashville', NULL, ARRAY['community'], 'Statewide LGBTQ+ advocacy organization working for equality through policy, education, and community events.', 'tnequality', 'TNEquality', 'TNEquality'),

('outmemphis-nashville', 'OUTMemphis Nashville', 'outmemphis-nashville', 'lgbtq', 'https://outmemphis.org', 'Nashville', NULL, ARRAY['community'], 'LGBTQ+ community center (expanded from Memphis) offering social events, support groups, and resources.', 'outmemphis', 'OUTMemphis', NULL),

-- SUBURBAN/REGIONAL
('downtown-franklin-association', 'Downtown Franklin Association', 'downtown-franklin-association', 'business', 'https://downtownfranklintn.com', 'Franklin', NULL, ARRAY['community'], 'Manages events and promotions for historic downtown Franklin including Dickens of a Christmas and Main Street Festival.', 'downtownfranklintn', 'DowntownFranklinTN', NULL),

('heritage-foundation-franklin', 'Heritage Foundation of Franklin and Williamson County', 'heritage-foundation-franklin', 'nonprofit', 'https://historicfranklin.com', 'Franklin', NULL, ARRAY['community', 'art'], 'Preserves and promotes local history through museums, tours, and educational events in Williamson County.', 'historicfranklin', 'HeritageFoundationTN', NULL),

('rutherford-arts-alliance', 'Rutherford Arts Alliance', 'rutherford-arts-alliance', 'arts_nonprofit', 'https://rutherfordartsalliance.org', 'Murfreesboro', NULL, ARRAY['art', 'music', 'theater'], 'Supports artists and arts programming in Rutherford County. Hosts events, exhibitions, and workshops.', NULL, 'RutherfordArtsAlliance', NULL),

('williamson-county-parks', 'Williamson County Parks and Recreation', 'williamson-county-parks', 'government', 'https://www.wcparksandrec.com', 'Franklin', NULL, ARRAY['fitness', 'family', 'community'], 'Public parks system offering nature programs, sports leagues, fitness classes, and outdoor events.', 'wcparksandrec', 'WilliamsonCountyParks', NULL),

-- FILM & THEATER
('nashville-film-festival', 'Nashville Film Festival', 'nashville-film-festival', 'film_society', 'https://nashvillefilmfestival.org', 'Nashville', 'Downtown', ARRAY['film'], 'Annual film festival showcasing independent cinema. Year-round film screenings and filmmaker events.', 'nashvillefilmfest', 'NashvilleFilmFestival', 'NashFilmFest'),

('nashville-repertory-theatre', 'Nashville Repertory Theatre', 'nashville-repertory-theatre', 'performing_arts', 'https://nashvillerep.org', 'Nashville', 'TPAC District', ARRAY['theater'], 'Professional theater company producing contemporary and classic plays at TPAC''s Johnson Theater.', 'nashvillerep', 'NashvilleRepertoryTheatre', 'NashvilleRep'),

('circle-players-nashville', 'Circle Players Nashville', 'circle-players-nashville', 'performing_arts', 'https://circleplayers.net', 'Nashville', NULL, ARRAY['theater'], 'Community theater company producing musicals, comedies, and dramas with local talent.', NULL, 'CirclePlayersNashville', NULL),

('nashville-childrens-theatre', 'Nashville Children''s Theatre', 'nashville-childrens-theatre', 'performing_arts', 'https://nashvillechildrenstheatre.org', 'Nashville', NULL, ARRAY['theater', 'family'], 'Theater dedicated to young audiences. Professional productions, drama classes, and education programs.', 'nashvillechildrenstheatre', 'NashvilleChildrensTheatre', 'NCTNashville'),

-- CULTURAL & HERITAGE
('national-museum-african-american-music', 'National Museum of African American Music', 'national-museum-african-american-music', 'museum', 'https://nmaam.org', 'Nashville', 'Downtown', ARRAY['music', 'art'], 'Museum celebrating Black music genres and artists. Interactive exhibits, live performances, educational programs.', 'nmaamuseum', 'NMAAMuseum', 'NMAAMuseum'),

('country-music-hall-of-fame', 'Country Music Hall of Fame and Museum', 'country-music-hall-of-fame', 'museum', 'https://countrymusichalloffame.org', 'Nashville', 'Downtown', ARRAY['music', 'art'], 'Iconic museum preserving country music history. Exhibits, archives, concerts, and Hatch Show Print letterpress.', 'countrymusichof', 'CountryMusicHallofFame', 'CountryMusicHOF'),

('rca-studio-b', 'Historic RCA Studio B', 'rca-studio-b', 'museum', 'https://countrymusichalloffame.org/rca-studio-b', 'Nashville', 'Music Row', ARRAY['music', 'art'], 'Legendary recording studio where Elvis, Dolly Parton, and thousands of hits were made. Guided tours available.', NULL, NULL, NULL),

('cheekwood-estate-gardens', 'Cheekwood Estate & Gardens', 'cheekwood-estate-gardens', 'museum', 'https://cheekwood.org', 'Nashville', 'West Nashville', ARRAY['art', 'family'], 'Historic mansion, art museum, and 55-acre botanical garden. Seasonal exhibitions, concerts, and family events.', 'cheekwood', 'Cheekwood', 'Cheekwood'),

('the-parthenon-nashville', 'The Parthenon', 'the-parthenon-nashville', 'museum', 'https://www.nashville.gov/departments/parks/parthenon', 'Nashville', 'West End', ARRAY['art'], 'Full-scale replica of Athens Parthenon in Centennial Park. Art museum with rotating exhibits and Athena statue.', NULL, NULL, NULL),

('adventure-science-center', 'Adventure Science Center', 'adventure-science-center', 'museum', 'https://adventuresci.org', 'Nashville', NULL, ARRAY['family', 'community'], 'Hands-on science museum with planetarium. Interactive exhibits, space programs, and STEM education events.', 'adventuresci', 'AdventureScienceCenter', 'AdventureSci'),

-- SPORTS & RECREATION
('nashville-sports-council', 'Nashville Sports Council', 'nashville-sports-council', 'nonprofit', 'https://nashvillesports.com', 'Nashville', NULL, ARRAY['sports'], 'Recruits and manages sporting events for Nashville. Organizes races, tournaments, and athletic competitions.', 'nashvillesportscouncil', 'NashvilleSports', 'NashvilleSports'),

('music-city-runners', 'Music City Runners Club', 'music-city-runners', 'nonprofit', 'https://www.musiccityrunners.com', 'Nashville', NULL, ARRAY['sports', 'fitness'], 'Running club organizing group runs, training programs, and local race events.', NULL, 'MusicCityRunnersClub', NULL),

-- NEIGHBORHOOD ASSOCIATIONS
('east-nashville-business', 'East Nashville Business Association', 'east-nashville-business', 'business', 'https://www.eastnashvillebiz.com', 'Nashville', 'East Nashville', ARRAY['community'], 'Promotes East Nashville businesses and organizes community events, shop local campaigns, and networking.', 'eastnashvillebiz', 'EastNashvilleBusinessAssociation', NULL),

('12-south-neighborhood', '12 South Neighborhood Association', '12-south-neighborhood', 'neighborhood', 'https://12southnashville.com', 'Nashville', '12 South', ARRAY['community'], 'Supports vibrant 12 South district with events, beautification projects, and neighborhood initiatives.', '12southnashville', '12SouthNashville', NULL),

('the-nations-neighborhood', 'The Nations Neighborhood', 'the-nations-neighborhood', 'neighborhood', NULL, 'Nashville', 'The Nations', ARRAY['community'], 'Growing neighborhood west of Germantown with community events, art projects, and local business support.', NULL, 'TheNationsNashville', NULL),

-- FOOD & BEVERAGE
('nashville-craft-distillery', 'Nashville Craft Distillery', 'nashville-craft-distillery', 'business', 'https://nashvillecraftdistillery.com', 'Nashville', 'Wedgewood-Houston', ARRAY['food_drink'], 'Craft distillery offering tours, tastings, and special events showcasing local spirits production.', 'nashvillecraftdistillery', 'NashvilleCraftDistillery', NULL),

('tennessee-craft', 'Tennessee Craft', 'tennessee-craft', 'nonprofit', 'https://tennesseecraft.org', 'Nashville', NULL, ARRAY['art', 'food_drink'], 'Supports local craft artisans, brewers, and makers. Hosts Tennessee Craft Fair and craft beverage events.', 'tennesseecraft', 'TennesseeCraft', NULL)

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  org_type = EXCLUDED.org_type,
  website = EXCLUDED.website,
  city = EXCLUDED.city,
  neighborhood = EXCLUDED.neighborhood,
  categories = EXCLUDED.categories,
  description = EXCLUDED.description,
  instagram = EXCLUDED.instagram,
  facebook = EXCLUDED.facebook,
  twitter = EXCLUDED.twitter;

-- Add comment
COMMENT ON TABLE event_producers IS 'Nashville Metro import (migration 106) added 48 organizations including music industry, arts, community nonprofits, LGBTQ+, suburban, and business organizations serving the 14-county Nashville metropolitan area.';
