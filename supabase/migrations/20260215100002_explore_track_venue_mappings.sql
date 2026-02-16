-- Map existing venues into explore tracks
-- Uses venue slugs and venue_type to auto-populate tracks

-- Helper: Insert a track-venue mapping by slug match
-- Skips if venue not found (no error on missing venues)

-- ============================================================================
-- Track 1: Welcome to Atlanta (Classic tourist hits)
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, editorial_blurb)
SELECT t.id, v.id, row_number() OVER (ORDER BY v.name), true, v.explore_blurb
FROM explore_tracks t, venues v
WHERE t.slug = 'welcome-to-atlanta'
  AND v.slug IN (
    'georgia-aquarium',
    'world-of-coca-cola',
    'centennial-olympic-park',
    'zoo-atlanta',
    'fox-theatre',
    'ponce-city-market',
    'skyview-atlanta',
    'atlanta-botanical-garden',
    'piedmont-park',
    'stone-mountain-park'
  )
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- Track 2: Good Trouble (Civil Rights)
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, editorial_blurb)
SELECT t.id, v.id, row_number() OVER (ORDER BY v.name), true, v.explore_blurb
FROM explore_tracks t, venues v
WHERE t.slug = 'good-trouble'
  AND v.slug IN (
    'national-center-for-civil-and-human-rights',
    'martin-luther-king-jr-national-historical-park',
    'ebenezer-baptist-church',
    'sweet-auburn-curb-market',
    'atlanta-history-center',
    'apex-museum',
    'oakland-cemetery',
    'hammonds-house-museum',
    'herndon-home-museum'
  )
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- Track 3: The South Got Something to Say (Hip-Hop and Music)
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, editorial_blurb)
SELECT t.id, v.id, row_number() OVER (ORDER BY v.name), true, v.explore_blurb
FROM explore_tracks t, venues v
WHERE t.slug = 'the-south-got-something-to-say'
  AND v.slug IN (
    'the-tabernacle',
    'terminal-west',
    'eddies-attic',
    'the-earl',
    'variety-playhouse',
    'center-stage',
    'criminal-records',
    'aisle-5',
    'the-masquerade',
    'vinyl-atlanta'
  )
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- Also add music venues by type
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured)
SELECT t.id, v.id, 50 + row_number() OVER (ORDER BY v.name), false
FROM explore_tracks t, venues v
WHERE t.slug = 'the-south-got-something-to-say'
  AND v.venue_type = 'music_venue'
  AND NOT EXISTS (
    SELECT 1 FROM explore_track_venues etv
    WHERE etv.track_id = t.id AND etv.venue_id = v.id
  )
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- Track 4: Keep Moving Forward (BeltLine)
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, editorial_blurb)
SELECT t.id, v.id, row_number() OVER (ORDER BY v.name), true, v.explore_blurb
FROM explore_tracks t, venues v
WHERE t.slug = 'keep-moving-forward'
  AND v.slug IN (
    'ponce-city-market',
    'krog-street-market',
    'new-realm-brewing',
    'monday-night-brewing',
    'orpheus-brewing',
    'paris-on-ponce',
    'dad-s-garage-theatre',
    'historic-fourth-ward-park'
  )
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- Track 5: The Itis (Food Scene)
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, editorial_blurb)
SELECT t.id, v.id, row_number() OVER (ORDER BY v.name), true, v.explore_blurb
FROM explore_tracks t, venues v
WHERE t.slug = 'the-itis'
  AND v.slug IN (
    'ponce-city-market',
    'krog-street-market',
    'sweet-auburn-curb-market',
    'municipal-market',
    'buford-highway-farmers-market',
    'the-varsity',
    'mary-macs-tea-room',
    'busy-bee-cafe',
    'hattie-b-s-hot-chicken'
  )
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- Add food halls by type
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured)
SELECT t.id, v.id, 50 + row_number() OVER (ORDER BY v.name), false
FROM explore_tracks t, venues v
WHERE t.slug = 'the-itis'
  AND v.venue_type = 'food_hall'
  AND NOT EXISTS (
    SELECT 1 FROM explore_track_venues etv
    WHERE etv.track_id = t.id AND etv.venue_id = v.id
  )
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- Track 6: City in a Forest (Great Outdoors)
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, editorial_blurb)
SELECT t.id, v.id, row_number() OVER (ORDER BY v.name), true, v.explore_blurb
FROM explore_tracks t, venues v
WHERE t.slug = 'city-in-a-forest'
  AND v.slug IN (
    'piedmont-park',
    'sweetwater-creek-state-park',
    'stone-mountain-park',
    'atlanta-botanical-garden',
    'fernbank-forest',
    'chattahoochee-river-national-recreation-area',
    'grant-park',
    'chastain-park'
  )
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- Add parks by type
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured)
SELECT t.id, v.id, 50 + row_number() OVER (ORDER BY v.name), false
FROM explore_tracks t, venues v
WHERE t.slug = 'city-in-a-forest'
  AND v.venue_type IN ('park', 'garden', 'outdoor_venue')
  AND NOT EXISTS (
    SELECT 1 FROM explore_track_venues etv
    WHERE etv.track_id = t.id AND etv.venue_id = v.id
  )
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- Track 7: Tomorrow Is Another Day (Museums and Curiosities)
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, editorial_blurb)
SELECT t.id, v.id, row_number() OVER (ORDER BY v.name), true, v.explore_blurb
FROM explore_tracks t, venues v
WHERE t.slug = 'tomorrow-is-another-day'
  AND v.slug IN (
    'high-museum-of-art',
    'center-for-puppetry-arts',
    'fernbank-museum',
    'fernbank-science-center',
    'atlanta-history-center',
    'michael-c-carlos-museum',
    'museum-of-design-atlanta',
    'william-breman-jewish-heritage-museum',
    'margaret-mitchell-house'
  )
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- Add museums and galleries by type
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured)
SELECT t.id, v.id, 50 + row_number() OVER (ORDER BY v.name), false
FROM explore_tracks t, venues v
WHERE t.slug = 'tomorrow-is-another-day'
  AND v.venue_type IN ('museum', 'gallery')
  AND NOT EXISTS (
    SELECT 1 FROM explore_track_venues etv
    WHERE etv.track_id = t.id AND etv.venue_id = v.id
  )
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- Track 8: Hard in Da Paint (Street Art)
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, editorial_blurb)
SELECT t.id, v.id, row_number() OVER (ORDER BY v.name), true, v.explore_blurb
FROM explore_tracks t, venues v
WHERE t.slug = 'hard-in-da-paint'
  AND v.slug IN (
    'krog-street-tunnel',
    'atlanta-contemporary',
    'whitespace-gallery',
    'paris-on-ponce'
  )
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- Add galleries by type
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured)
SELECT t.id, v.id, 50 + row_number() OVER (ORDER BY v.name), false
FROM explore_tracks t, venues v
WHERE t.slug = 'hard-in-da-paint'
  AND v.venue_type = 'gallery'
  AND NOT EXISTS (
    SELECT 1 FROM explore_track_venues etv
    WHERE etv.track_id = t.id AND etv.venue_id = v.id
  )
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- Track 9: A Beautiful Mosaic (International Atlanta)
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, editorial_blurb)
SELECT t.id, v.id, row_number() OVER (ORDER BY v.name), true, v.explore_blurb
FROM explore_tracks t, venues v
WHERE t.slug = 'a-beautiful-mosaic'
  AND v.slug IN (
    'buford-highway-farmers-market',
    'plaza-fiesta',
    'jimmy-carter-presidential-library',
    'dekalb-farmers-market'
  )
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- Track 10: Devil Went Down to Georgia (Craft Beer)
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, editorial_blurb)
SELECT t.id, v.id, row_number() OVER (ORDER BY v.name), true, v.explore_blurb
FROM explore_tracks t, venues v
WHERE t.slug = 'the-devil-went-down-to-georgia'
  AND v.slug IN (
    'monday-night-brewing',
    'sweetwater-brewing-company',
    'orpheus-brewing',
    'new-realm-brewing',
    'wild-heaven-beer',
    'three-taverns-craft-brewery',
    'scofflaw-brewing',
    'monday-night-garage',
    'asi-atlanta-brewing-co'
  )
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- Add breweries and distilleries by type
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured)
SELECT t.id, v.id, 50 + row_number() OVER (ORDER BY v.name), false
FROM explore_tracks t, venues v
WHERE t.slug = 'the-devil-went-down-to-georgia'
  AND v.venue_type IN ('brewery', 'distillery', 'winery')
  AND NOT EXISTS (
    SELECT 1 FROM explore_track_venues etv
    WHERE etv.track_id = t.id AND etv.venue_id = v.id
  )
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- Track 11: Too Busy to Hate (LGBTQ+ Atlanta)
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, editorial_blurb)
SELECT t.id, v.id, row_number() OVER (ORDER BY v.name), true, v.explore_blurb
FROM explore_tracks t, venues v
WHERE t.slug = 'too-busy-to-hate'
  AND v.slug IN (
    'atlanta-pride-committee',
    'my-sisters-room',
    'piedmont-park'
  )
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- Track 12: The Midnight Train (Atlanta Gets Weird)
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, editorial_blurb)
SELECT t.id, v.id, row_number() OVER (ORDER BY v.name), true, v.explore_blurb
FROM explore_tracks t, venues v
WHERE t.slug = 'the-midnight-train'
  AND v.slug IN (
    'clermont-lounge',
    'oakland-cemetery',
    'doll-s-head-trail'
  )
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- Track 13: Keep Swinging (Sports)
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, editorial_blurb)
SELECT t.id, v.id, row_number() OVER (ORDER BY v.name), true, v.explore_blurb
FROM explore_tracks t, venues v
WHERE t.slug = 'keep-swinging'
  AND v.slug IN (
    'mercedes-benz-stadium',
    'state-farm-arena',
    'truist-park',
    'atlanta-motor-speedway',
    'bobby-dodd-stadium'
  )
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- Add arenas and stadiums by type
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured)
SELECT t.id, v.id, 50 + row_number() OVER (ORDER BY v.name), false
FROM explore_tracks t, venues v
WHERE t.slug = 'keep-swinging'
  AND v.venue_type IN ('arena', 'stadium')
  AND NOT EXISTS (
    SELECT 1 FROM explore_track_venues etv
    WHERE etv.track_id = t.id AND etv.venue_id = v.id
  )
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- Track 14: Lifes Like a Movie (Kids and Family)
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, editorial_blurb)
SELECT t.id, v.id, row_number() OVER (ORDER BY v.name), true, v.explore_blurb
FROM explore_tracks t, venues v
WHERE t.slug = 'lifes-like-a-movie'
  AND v.slug IN (
    'center-for-puppetry-arts',
    'fernbank-museum',
    'fernbank-science-center',
    'zoo-atlanta',
    'georgia-aquarium',
    'childrens-museum-of-atlanta',
    'legoland-discovery-center',
    'imagine-it-childrens-museum'
  )
ON CONFLICT (track_id, venue_id) DO NOTHING;
