-- 262_network_feeds.sql
-- Independent Atlanta network: curated RSS sources and their posts.
-- Powers the "Atlanta Independents" feed on the homepage/portal.

-- ── network_sources ─────────────────────────────────────────────────
CREATE TABLE network_sources (
  id SERIAL PRIMARY KEY,
  portal_id UUID NOT NULL REFERENCES portals(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  feed_url TEXT NOT NULL,
  website_url TEXT,
  description TEXT,
  logo_url TEXT,
  categories TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_fetched_at TIMESTAMPTZ,
  fetch_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_network_sources_portal ON network_sources(portal_id);
CREATE INDEX idx_network_sources_active ON network_sources(is_active) WHERE is_active = true;

-- ── network_posts ───────────────────────────────────────────────────
CREATE TABLE network_posts (
  id SERIAL PRIMARY KEY,
  source_id INT NOT NULL REFERENCES network_sources(id) ON DELETE CASCADE,
  portal_id UUID NOT NULL REFERENCES portals(id),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  author TEXT,
  summary TEXT,
  image_url TEXT,
  published_at TIMESTAMPTZ,
  guid TEXT,                          -- RSS guid for dedup
  tags TEXT[] DEFAULT '{}',
  raw_description TEXT,               -- original feed content before summarization
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_network_posts_guid ON network_posts(source_id, guid) WHERE guid IS NOT NULL;
CREATE UNIQUE INDEX idx_network_posts_url ON network_posts(source_id, url);
CREATE INDEX idx_network_posts_portal ON network_posts(portal_id);
CREATE INDEX idx_network_posts_published ON network_posts(published_at DESC);
CREATE INDEX idx_network_posts_source ON network_posts(source_id);

-- ── RLS ─────────────────────────────────────────────────────────────
ALTER TABLE network_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_posts ENABLE ROW LEVEL SECURITY;

-- Public read access (these are public-facing feeds)
CREATE POLICY network_sources_public_read ON network_sources FOR SELECT
  USING (true);
CREATE POLICY network_posts_public_read ON network_posts FOR SELECT
  USING (true);

-- Service role can do everything (crawler writes via service key)
CREATE POLICY network_sources_service ON network_sources FOR ALL
  USING (auth.role() = 'service_role');
CREATE POLICY network_posts_service ON network_posts FOR ALL
  USING (auth.role() = 'service_role');

-- ── Seed data: Atlanta sources ──────────────────────────────────────
-- Portal ID will need to match your Atlanta portal.
-- Using a subquery to look it up by slug.

INSERT INTO network_sources (portal_id, name, slug, feed_url, website_url, description, categories) VALUES
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'Rough Draft Atlanta',
    'rough-draft-atlanta',
    'https://roughdraftatlanta.com/feed/',
    'https://roughdraftatlanta.com',
    'Hyperlocal metro Atlanta news covering food, arts, festivals, and neighborhoods.',
    ARRAY['news', 'food', 'arts', 'neighborhoods']
  ),
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'Atlanta Community Press Collective',
    'atlanta-community-press-collective',
    'https://atlpresscollective.com/feed/',
    'https://atlpresscollective.com',
    'Nonprofit community journalism holding power to account and centering marginalized voices.',
    ARRAY['news', 'civic', 'community']
  ),
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'City on Purpose',
    'city-on-purpose',
    'https://cityonpurpose.substack.com/feed',
    'https://cityonpurpose.substack.com',
    'Weekly newsletter and podcast covering fun things to do in Atlanta.',
    ARRAY['events', 'culture', 'community']
  ),
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'Burnaway',
    'burnaway',
    'https://burnaway.org/feed/',
    'https://burnaway.org',
    'Nonprofit magazine covering contemporary art and criticism from the American South.',
    ARRAY['arts', 'culture']
  ),
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'Apostrophe ATL',
    'apostrophe-atl',
    'https://apostropheatl.substack.com/feed',
    'https://apostropheatl.substack.com',
    'Atlanta''s literary newsletter — open mics, workshops, and local writers.',
    ARRAY['literary', 'arts', 'culture']
  ),
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'Canopy Atlanta',
    'canopy-atlanta',
    'https://canopyatlanta.org/feed/',
    'https://canopyatlanta.org',
    'Community journalism nonprofit partnering with underserved Atlanta neighborhoods.',
    ARRAY['news', 'neighborhoods', 'community']
  ),
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'The Atlanta Objective',
    'the-atlanta-objective',
    'https://theatlantaobjective.substack.com/feed',
    'https://theatlantaobjective.substack.com',
    'George Chidi''s one-man investigative newsletter on Atlanta crime, politics, and policy.',
    ARRAY['news', 'politics', 'investigative']
  ),
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'Atlanta Restaurant Blog',
    'atlanta-restaurant-blog',
    'https://atlantarestaurantblog.com/feed/',
    'https://atlantarestaurantblog.com',
    'Independent restaurant reviews and dining coverage across Atlanta.',
    ARRAY['food', 'restaurants']
  ),
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'Mainline',
    'mainline-atl',
    'https://mainlineatl.com/feed/',
    'https://www.mainlineatl.com',
    'News, activism, culture, and music coverage in the Atlanta area.',
    ARRAY['music', 'culture', 'news', 'activism']
  );
