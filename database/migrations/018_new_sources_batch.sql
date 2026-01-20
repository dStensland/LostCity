-- Migration 018: Add 48 new event sources across multiple categories
-- Created: 2026-01-19

-- Music Venues (6)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
    ('St. James Live', 'st-james-live', 'https://www.stjameslive.com', 'scrape', 'daily', true),
    ('Basement Atlanta', 'basement-atlanta', 'https://www.basementatl.com', 'scrape', 'daily', true),
    ('Johnny''s Hideaway', 'johnnys-hideaway', 'https://www.johnnyshideaway.com', 'scrape', 'daily', true),
    ('Sound Table', 'sound-table', 'https://www.soundtable.com', 'scrape', 'daily', true),
    ('Compound Atlanta', 'compound-atlanta', 'https://www.compoundatl.com', 'scrape', 'daily', true),
    ('MJQ Concourse', 'mjq-concourse', 'https://www.mjqatlanta.com', 'scrape', 'daily', true)
ON CONFLICT (slug) DO NOTHING;

-- LGBTQ+ Venues (6)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
    ('Lore Atlanta', 'lore-atlanta', 'https://www.loreatlanta.com', 'scrape', 'daily', true),
    ('Friends on Ponce', 'friends-on-ponce', 'https://www.friendsonponce.com', 'scrape', 'daily', true),
    ('Woody''s Atlanta', 'woodys-atlanta', 'https://www.woodysatlanta.com', 'scrape', 'daily', true),
    ('Jungle Atlanta', 'jungle-atlanta', 'https://www.jungleatl.com', 'scrape', 'daily', true),
    ('Pisces Atlanta', 'pisces-atlanta', 'https://www.piscesatlanta.com', 'scrape', 'daily', true),
    ('Club Wander', 'club-wander', 'https://www.clubwander.com', 'scrape', 'daily', true)
ON CONFLICT (slug) DO NOTHING;

-- Dance Studios (6)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
    ('Academy Ballroom', 'academy-ballroom', 'https://www.academy-ballroom.com', 'scrape', 'weekly', true),
    ('Ballroom Impact', 'ballroom-impact', 'https://www.ballroomimpact.com', 'scrape', 'weekly', true),
    ('Dancing4Fun', 'dancing4fun', 'https://www.dancing4fun.com', 'scrape', 'weekly', true),
    ('Atlanta Dance Ballroom', 'atlanta-dance-ballroom', 'https://www.atlantadanceballroom.com', 'scrape', 'weekly', true),
    ('Arthur Murray Atlanta', 'arthur-murray-atlanta', 'https://www.arthurmurrayatlanta.com', 'scrape', 'weekly', true),
    ('Terminus Modern Ballet', 'terminus-modern-ballet', 'https://www.terminusmodernballet.com', 'scrape', 'weekly', true)
ON CONFLICT (slug) DO NOTHING;

-- Breweries (6)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
    ('Steady Hand Beer Co', 'steady-hand-beer', 'https://www.steadyhandbeer.com', 'scrape', 'weekly', true),
    ('Cherry Street Brewing', 'cherry-street-brewing', 'https://www.cherrystreetbrewing.com', 'scrape', 'weekly', true),
    ('Round Trip Brewing', 'round-trip-brewing', 'https://www.roundtripbrewing.com', 'scrape', 'weekly', true),
    ('Halfway Crooks', 'halfway-crooks', 'https://www.halfwaycrooks.com', 'scrape', 'weekly', true),
    ('Fire Maker Brewing', 'fire-maker-brewing', 'https://www.firemakerbrewing.com', 'scrape', 'weekly', true),
    ('Eventide Brewing', 'eventide-brewing', 'https://www.eventidebrewing.com', 'scrape', 'weekly', true)
ON CONFLICT (slug) DO NOTHING;

-- Farmers Markets (6)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
    ('EAV Farmers Market', 'eav-farmers-market', 'https://www.eavfm.org', 'scrape', 'weekly', true),
    ('Decatur Farmers Market', 'decatur-farmers-market', 'https://www.decaturfarmersmarket.com', 'scrape', 'weekly', true),
    ('Morningside Farmers Market', 'morningside-farmers-market', 'https://www.morningsidemarket.com', 'scrape', 'weekly', true),
    ('Grant Park Farmers Market', 'grant-park-farmers-market', 'https://www.grantparkmarket.org', 'scrape', 'weekly', true),
    ('Peachtree Road Farmers Market', 'peachtree-road-farmers-market', 'https://www.peachtreeroadfarmersmarket.com', 'scrape', 'weekly', true),
    ('Freedom Farmers Market', 'freedom-farmers-market', 'https://www.freedomfarmersmarket.com', 'scrape', 'weekly', true)
ON CONFLICT (slug) DO NOTHING;

-- Running/Cycling (5)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
    ('Big Peach Running Co', 'big-peach-running', 'https://www.bigpeachrunningco.com', 'scrape', 'weekly', true),
    ('Peachtree City Running Club', 'ptc-running-club', 'https://www.ptcrc.org', 'scrape', 'weekly', true),
    ('Monday Night Run Club', 'monday-night-run-club', 'https://www.mondaynightbrewing.com', 'scrape', 'weekly', true),
    ('Atlanta Cycling', 'atlanta-cycling', 'https://www.atlantacycling.com', 'scrape', 'weekly', true),
    ('Bicycle Tours of Atlanta', 'bicycle-tours-atlanta', 'https://www.bicycletoursofatlanta.com', 'scrape', 'weekly', true)
ON CONFLICT (slug) DO NOTHING;

-- Esports/Gaming (4)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
    ('EEG Arena', 'eeg-arena', 'https://www.eeg.com', 'scrape', 'weekly', true),
    ('Level Up Gaming Lounge', 'level-up-gaming', 'https://www.levelupatl.com', 'scrape', 'weekly', true),
    ('Token Gaming Pub', 'token-gaming-pub', 'https://www.tokengamingpub.com', 'scrape', 'weekly', true),
    ('ATL Gaming', 'atl-gaming', 'https://www.atlgaming.com', 'scrape', 'weekly', true)
ON CONFLICT (slug) DO NOTHING;

-- Art Galleries (5)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
    ('Poem88 Gallery', 'poem88-gallery', 'https://www.poem88.com', 'scrape', 'weekly', true),
    ('Kai Lin Art', 'kai-lin-art', 'https://www.kailinart.com', 'scrape', 'weekly', true),
    ('Marcia Wood Gallery', 'marcia-wood-gallery', 'https://www.marciawoodgallery.com', 'scrape', 'weekly', true),
    ('Hathaway Contemporary', 'hathaway-contemporary', 'https://www.hathawaycontemporary.com', 'scrape', 'weekly', true),
    ('Mason Fine Art', 'mason-fine-art', 'https://www.masonfineart.com', 'scrape', 'weekly', true)
ON CONFLICT (slug) DO NOTHING;

-- Theaters (4)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
    ('OnStage Atlanta', 'onstage-atlanta', 'https://www.onstageatlanta.com', 'scrape', 'weekly', true),
    ('PushPush Theater', 'pushpush-theater', 'https://www.pushpushtheater.com', 'scrape', 'weekly', true),
    ('Working Title Playwrights', 'working-title-playwrights', 'https://www.workingtitleplaywrights.com', 'scrape', 'weekly', true),
    ('Pinch ''n'' Ouch Theatre', 'pinch-n-ouch-theatre', 'https://www.pinchnouchtheatre.org', 'scrape', 'weekly', true)
ON CONFLICT (slug) DO NOTHING;

-- Summary: 48 new sources added
-- Music Venues: 6
-- LGBTQ+ Venues: 6
-- Dance Studios: 6
-- Breweries: 6
-- Farmers Markets: 6
-- Running/Cycling: 5
-- Esports/Gaming: 4
-- Art Galleries: 5
-- Theaters: 4
