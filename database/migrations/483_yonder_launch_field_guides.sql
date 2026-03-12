-- Migration 483: Yonder launch field guides
--
-- Seed the first high-confidence external guide references for Yonder launch
-- destinations using the editorial_mentions pattern.

WITH seed(slug, source_key, article_url, article_title, mention_type, guide_name, snippet) AS (
  VALUES
    (
      'amicalola-falls',
      'atlanta_trails',
      'https://www.atlantatrails.com/amicalola-falls/',
      'Amicalola Falls State Park: top hikes and adventures',
      'guide_inclusion',
      'Waterfalls',
      'Good route-depth and overnight context for the falls, lodge, and approach trail.'
    ),
    (
      'raven-cliff-falls',
      'atlanta_trails',
      'https://www.atlantatrails.com/hiking-trails/hiking-to-raven-cliff-falls/',
      'Raven Cliff Falls Trail',
      'guide_inclusion',
      'Waterfalls',
      'Strong trail-depth reference for one of North Georgia''s signature waterfall hikes.'
    ),
    (
      'helton-creek-falls',
      'atlanta_trails',
      'https://www.atlantatrails.com/hiking-trails/helton-creek-falls-a-short-hike-to-two-waterfalls-near-helen-georgia/',
      'Helton Creek Falls: a family-friendly double waterfall hike near Helen, GA',
      'guide_inclusion',
      'Waterfalls',
      'Best quick-read route reference for this short, family-friendly waterfall stop.'
    ),
    (
      'desoto-falls',
      'atlanta_trails',
      'https://www.atlantatrails.com/hiking-trails/desoto-falls-hiking-double-waterfalls-in-georgia/',
      'Desoto Falls Trail',
      'guide_inclusion',
      'Waterfalls',
      'Useful trail-depth guide for the lower and upper falls.'
    ),
    (
      'brasstown-bald',
      'atlanta_trails',
      'https://www.atlantatrails.com/hiking-trails/brasstown-bald/',
      'Brasstown Bald',
      'guide_inclusion',
      'Summits',
      'Clear summit-trail guide for Georgia''s highest point.'
    ),
    (
      'brasstown-bald',
      'explore_georgia',
      'https://exploregeorgia.org/hiawassee/outdoors-nature/hiking/brasstown-bald-visitors-center-recreation-area',
      'Brasstown Bald Visitors Center & Recreation Area',
      'feature',
      'Scenic Landmarks',
      'Good statewide framing and practical visit context.'
    ),
    (
      'rabun-bald',
      'atlanta_trails',
      'https://www.atlantatrails.com/hiking-trails/rabun-bald-bartram-trail',
      'Rabun Bald: Hiking the Bartram Trail from Beegum Gap',
      'guide_inclusion',
      'Summits',
      'Strong guide for the fire-tower payoff and summit approach.'
    ),
    (
      'blood-mountain',
      'atlanta_trails',
      'https://www.atlantatrails.com/blood-mountain/',
      'Blood Mountain: Hiking, Backpacking & Camping Guide',
      'guide_inclusion',
      'Summits',
      'Best all-around route and planning guide for the summit.'
    ),
    (
      'springer-mountain',
      'atlanta_trails',
      'https://www.atlantatrails.com/springer-mountain/',
      'Springer Mountain: Hiking & Backpacking Guide',
      'guide_inclusion',
      'Summits',
      'Useful context for the southern Appalachian Trail terminus.'
    ),
    (
      'arabia-mountain',
      'atlanta_trails',
      'https://www.atlantatrails.com/arabia-mountain/',
      'Arabia Mountain & Panola Mountain: Our favorite hikes',
      'guide_inclusion',
      'Starter Outdoors',
      'Strong route-depth guide for the summit slab and loops.'
    ),
    (
      'arabia-mountain',
      'explore_georgia',
      'https://exploregeorgia.org/lithonia/history-heritage/african-american/arabia-mountain-national-heritage-area',
      'Arabia Mountain National Heritage Area',
      'feature',
      'Natural Wonders',
      'Good big-picture context for why the landscape matters.'
    ),
    (
      'shoot-the-hooch-powers-island',
      'atlanta_trails',
      'https://www.atlantatrails.com/hiking-trails/powers-island-trail-chattahoochee/',
      'Powers Island Trail: Hiking the Chattahoochee River',
      'guide_inclusion',
      'River Access',
      'Best trail-depth guide for the island crossing and riverside loop.'
    ),
    (
      'island-ford-crnra-boat-ramp',
      'atlanta_trails',
      'https://www.atlantatrails.com/hiking-trails/riverside-hiking-trails-island-ford-at-the-chattahoochee-river/',
      'Island Ford Park: hiking the Chattahoochee River near Roswell',
      'guide_inclusion',
      'River Access',
      'Good reference for riverside access and surrounding trails.'
    ),
    (
      'east-palisades-trail',
      'atlanta_trails',
      'https://www.atlantatrails.com/hiking-trails/hiking-east-palisades-indian-trail-at-the-chattahoochee-river/',
      'East Palisades Trail: Hiking the Chattahoochee River',
      'guide_inclusion',
      'River Access',
      'Best external guide for the bamboo grove and bluff views.'
    ),
    (
      'cochran-shoals-trail',
      'atlanta_trails',
      'https://www.atlantatrails.com/hiking-trails/cochran-shoals-trails-along-the-chattahoochee/',
      'Cochran Shoals Trail at the Chattahoochee River',
      'guide_inclusion',
      'River Access',
      'Strong route-depth guide for the shoals, marsh, and loop.'
    ),
    (
      'chattahoochee-bend-state-park',
      'atlanta_trails',
      'https://www.atlantatrails.com/hiking-trails/chattahoochee-bend-state-park/',
      'Chattahoochee Bend State Park: Riverside & Bend Trails',
      'guide_inclusion',
      'River Access',
      'Good trail-depth guide for the riverfront observation zone and park loops.'
    ),
    (
      'chattahoochee-bend-state-park',
      'explore_georgia',
      'https://exploregeorgia.org/newnan/outdoors-nature/hiking/chattahoochee-bend-state-park',
      'Chattahoochee Bend State Park',
      'feature',
      'Weekend Escapes',
      'Useful statewide framing for camping, paddling, and river frontage.'
    ),
    (
      'krog-street-tunnel',
      'atlas_obscura',
      'https://www.atlasobscura.com/places/krog-street-tunnel',
      'Krog Street Tunnel',
      'feature',
      'Secret Atlanta',
      'Best story source for the tunnel''s evolving street-art identity.'
    ),
    (
      'dolls-head-trail',
      'atlas_obscura',
      'https://www.atlasobscura.com/places/dolls-head-trail-2',
      'Doll''s Head Trail',
      'feature',
      'Secret Atlanta',
      'Strong story source for the found-art and wetlands context.'
    ),
    (
      'folk-art-park',
      'atlas_obscura',
      'https://www.atlasobscura.com/places/folk-art-park',
      'Folk Art Park',
      'feature',
      'Secret Atlanta',
      'Best story source for St. EOM and the park''s outsider-art context.'
    ),
    (
      'red-top-mountain-state-park',
      'explore_georgia',
      'https://exploregeorgia.org/acworth/outdoors-nature/hiking/red-top-mountain-state-park',
      'Red Top Mountain State Park',
      'guide_inclusion',
      'Starter Outdoors',
      'Good statewide guide for the lakeshore, trails, and easy overnight framing.'
    )
)
INSERT INTO editorial_mentions (
  venue_id,
  source_key,
  article_url,
  article_title,
  mention_type,
  guide_name,
  snippet,
  is_active
)
SELECT
  v.id,
  seed.source_key,
  seed.article_url,
  seed.article_title,
  seed.mention_type,
  seed.guide_name,
  seed.snippet,
  true
FROM seed
JOIN venues v ON v.slug = seed.slug
ON CONFLICT (article_url, venue_id) DO UPDATE
SET
  source_key = EXCLUDED.source_key,
  article_title = EXCLUDED.article_title,
  mention_type = EXCLUDED.mention_type,
  guide_name = EXCLUDED.guide_name,
  snippet = EXCLUDED.snippet,
  is_active = true,
  updated_at = now();
