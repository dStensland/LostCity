-- Migration 484: Yonder landmark wave 1
--
-- Seed two clean launch-tier landmarks that should behave as standalone
-- Yonder places: Driftwood Beach and Milledge Fountain.

INSERT INTO venues (
  name,
  slug,
  address,
  neighborhood,
  city,
  state,
  zip,
  lat,
  lng,
  venue_type,
  spot_type,
  website,
  short_description,
  description,
  image_url,
  explore_blurb,
  planning_notes,
  typical_duration_minutes,
  active
)
VALUES
  (
    'Driftwood Beach',
    'driftwood-beach',
    'N Beachview Dr',
    'Jekyll Island',
    'Jekyll Island',
    'GA',
    '31527',
    31.1034113,
    -81.4038548,
    'landmark',
    'landmark',
    'https://www.jekyllisland.com/activities/beaches/driftwood-beach/',
    'Jekyll Island shoreline famous for massive driftwood trunks, sunrise walks, and one of Georgia''s most photogenic coastal landscapes.',
    'Coastal Georgia landmark where weathered trees, broad beach access, and changing tides create one of the state''s clearest big-payoff, low-friction outdoor experiences.',
    'https://www.jekyllisland.com/wp-content/uploads/2021/02/beach-driftwood-1-1024x683.jpg',
    'Coastal artifact-level beach stop with strong visual payoff and easy starter-quest energy.',
    'Best promoted as a sunrise, golden-hour, or easy coastal walk stop. Pair with broader Jekyll or St. Simons planning rather than treating it as an all-day destination by itself.',
    90,
    true
  ),
  (
    'Milledge Fountain',
    'milledge-fountain',
    'Cherokee Ave SE & Milledge Ave SE',
    'Grant Park',
    'Atlanta',
    'GA',
    NULL,
    33.7388671,
    -84.3733545,
    'landmark',
    'landmark',
    NULL,
    'Grant Park fountain and stonework landmark that works as a low-friction urban artifact stop on a walk through the neighborhood.',
    'Historic Grant Park landmark with strong visual character and an easy fit inside Yonder''s Secret Atlanta and starter-outdoors lanes.',
    'https://lh3.googleusercontent.com/place-photos/AL8-SNFDQQca7i66I-o7rJApwPxKCm_Fe7w0zfxQG3a87lzNrudxDy4Fy_acAYKwjbZyucfgZEL64D8JTKYdXe8_zlnAVGt-ZG3_nOrFzUefAvxlfdMSYhLV0c1XXKCMm1hQU-l1O4_lgFnIMf1j=s4800-w800',
    'Grant Park oddity/landmark stop with low activation energy and strong neighborhood character.',
    'Best used as a support landmark inside a Grant Park, Oakland, or Secret Atlanta outing rather than a standalone trip purpose.',
    20,
    true
  )
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  neighborhood = EXCLUDED.neighborhood,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  zip = EXCLUDED.zip,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  venue_type = EXCLUDED.venue_type,
  spot_type = EXCLUDED.spot_type,
  website = EXCLUDED.website,
  short_description = EXCLUDED.short_description,
  description = EXCLUDED.description,
  image_url = EXCLUDED.image_url,
  explore_blurb = EXCLUDED.explore_blurb,
  planning_notes = EXCLUDED.planning_notes,
  typical_duration_minutes = EXCLUDED.typical_duration_minutes,
  active = true;

UPDATE venues
SET parent_venue_id = (
  SELECT id
  FROM venues
  WHERE slug = 'grant-park'
  LIMIT 1
)
WHERE slug = 'milledge-fountain';

WITH guide_seed(slug, source_key, article_url, article_title, mention_type, guide_name, snippet) AS (
  VALUES
    (
      'driftwood-beach',
      'explore_georgia',
      'https://exploregeorgia.org/jekyll-island/outdoors-nature/beaches/driftwood-beach',
      'Driftwood Beach',
      'guide_inclusion',
      'Starter Outdoors',
      'Good statewide framing for one of Georgia''s clearest low-friction coastal payoffs.'
    ),
    (
      'milledge-fountain',
      'atlas_obscura',
      'https://www.atlasobscura.com/places/milledge-fountain',
      'Milledge Fountain',
      'feature',
      'Secret Atlanta',
      'Best story source for the fountain''s hidden-landmark context inside Grant Park.'
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
  guide_seed.source_key,
  guide_seed.article_url,
  guide_seed.article_title,
  guide_seed.mention_type,
  guide_seed.guide_name,
  guide_seed.snippet,
  true
FROM guide_seed
JOIN venues v ON v.slug = guide_seed.slug
ON CONFLICT (article_url, venue_id) DO UPDATE
SET
  source_key = EXCLUDED.source_key,
  article_title = EXCLUDED.article_title,
  mention_type = EXCLUDED.mention_type,
  guide_name = EXCLUDED.guide_name,
  snippet = EXCLUDED.snippet,
  is_active = true,
  updated_at = now();
