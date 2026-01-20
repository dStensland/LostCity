-- Add 30 new sources for Lost City crawlers
-- Run this in Supabase SQL Editor

-- ===== Additional Theaters =====
INSERT INTO sources (name, slug, url, source_type, crawl_frequency) VALUES
  ('Aurora Theatre', 'aurora-theatre', 'https://www.auroratheatre.com', 'scrape', 'daily'),
  ('Horizon Theatre', 'horizon-theatre', 'https://www.horizontheatre.com', 'scrape', 'daily'),
  ('Actor''s Express', 'actors-express', 'https://www.actorsexpress.com', 'scrape', 'daily'),
  ('Out of Box Theatre', 'out-of-box-theatre', 'https://www.outofboxtheatre.com', 'scrape', 'daily'),
  ('Stage Door Players', 'stage-door-players', 'https://www.stagedoorplayers.net', 'scrape', 'daily');

-- ===== Additional Music Venues =====
INSERT INTO sources (name, slug, url, source_type, crawl_frequency) VALUES
  ('The Eastern', 'the-eastern', 'https://www.easternatl.com', 'scrape', 'daily'),
  ('Venkman''s', 'venkmans', 'https://www.venkmans.com', 'scrape', 'daily'),
  ('Northside Tavern', 'northside-tavern', 'https://www.northsidetavern.com', 'scrape', 'daily'),
  ('Red Light Cafe', 'red-light-cafe', 'https://www.redlightcafe.com', 'scrape', 'daily');

-- ===== Additional Breweries =====
INSERT INTO sources (name, slug, url, source_type, crawl_frequency) VALUES
  ('Scofflaw Brewing', 'scofflaw-brewing', 'https://www.scofflawbeer.com', 'scrape', 'daily'),
  ('Second Self Beer Company', 'second-self-brewing', 'https://www.secondselfbeer.com', 'scrape', 'daily'),
  ('Bold Monk Brewing', 'bold-monk-brewing', 'https://www.boldmonkbrewing.com', 'scrape', 'daily'),
  ('Reformation Brewery', 'reformation-brewery', 'https://www.reformationbrewery.com', 'scrape', 'daily');

-- ===== University Venues =====
INSERT INTO sources (name, slug, url, source_type, crawl_frequency) VALUES
  ('Ferst Center for the Arts', 'ferst-center', 'https://arts.gatech.edu', 'scrape', 'daily'),
  ('Schwartz Center for Performing Arts', 'schwartz-center', 'https://arts.emory.edu', 'scrape', 'daily'),
  ('Rialto Center for the Arts', 'rialto-center', 'https://rfrialto.gsu.edu', 'scrape', 'daily');

-- ===== Additional Festivals =====
INSERT INTO sources (name, slug, url, source_type, crawl_frequency) VALUES
  ('Atlanta Food & Wine Festival', 'atlanta-food-wine', 'https://www.atlantafoodandwinefestival.com', 'scrape', 'weekly'),
  ('Peachtree Road Race', 'peachtree-road-race', 'https://www.atlantatrackclub.org/peachtree', 'scrape', 'weekly'),
  ('Decatur Book Festival', 'decatur-book-festival', 'https://www.decaturbookfestival.com', 'scrape', 'weekly'),
  ('Sweet Auburn Springfest', 'sweet-auburn-springfest', 'https://www.sweetauburn.com', 'scrape', 'weekly'),
  ('Grant Park Summer Shade Festival', 'grant-park-festival', 'https://www.grantparkfestival.org', 'scrape', 'weekly'),
  ('Candler Park Fall Fest', 'candler-park-fest', 'https://www.candlerparkfest.org', 'scrape', 'weekly'),
  ('East Atlanta Strut', 'east-atlanta-strut', 'https://www.eastatlantastrut.com', 'scrape', 'weekly');

-- ===== Attractions =====
INSERT INTO sources (name, slug, url, source_type, crawl_frequency) VALUES
  ('Georgia Aquarium', 'georgia-aquarium', 'https://www.georgiaaquarium.org', 'scrape', 'daily'),
  ('Zoo Atlanta', 'zoo-atlanta', 'https://www.zooatlanta.org', 'scrape', 'daily'),
  ('Chattahoochee Nature Center', 'chattahoochee-nature', 'https://www.chattnaturecenter.org', 'scrape', 'daily');

-- ===== Nightlife =====
INSERT INTO sources (name, slug, url, source_type, crawl_frequency) VALUES
  ('Opera Nightclub', 'opera-nightclub', 'https://www.operaatlanta.com', 'scrape', 'daily'),
  ('District Atlanta', 'district-atlanta', 'https://www.districtatlanta.com', 'scrape', 'daily'),
  ('Ravine Atlanta', 'ravine-atlanta', 'https://www.ravineatlanta.com', 'scrape', 'daily');

-- ===== Trade & Convention =====
INSERT INTO sources (name, slug, url, source_type, crawl_frequency) VALUES
  ('AmericasMart Atlanta', 'americasmart', 'https://www.americasmart.com', 'scrape', 'daily');
