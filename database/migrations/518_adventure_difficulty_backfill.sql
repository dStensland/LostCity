-- Migration: Adventure Difficulty Backfill
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.
--
-- Backfills difficulty_level for the 84 venue_destination_details rows where it is NULL.
--
-- Priority order:
--   1. Explicit slug → difficulty from web/config/yonder-destination-intelligence.ts (30 entries)
--   2. Fallback by destination_type for everything else
--   3. Final catch-all by venue_type on the parent venue row

-- ── Step 1: explicit slug-level overrides from the TS config ────────────────

UPDATE venue_destination_details vdd
SET difficulty_level = CASE v.slug

  -- Wave 1 (10 entries)
  WHEN 'amicalola-falls'          THEN 'moderate'
  WHEN 'tallulah-gorge'           THEN 'hard'
  WHEN 'cloudland-canyon'         THEN 'moderate'
  WHEN 'blood-mountain'           THEN 'hard'
  WHEN 'springer-mountain'        THEN 'hard'
  WHEN 'brasstown-bald'           THEN 'easy'
  WHEN 'raven-cliff-falls'        THEN 'moderate'
  WHEN 'vogel-state-park'         THEN 'easy'
  WHEN 'fort-mountain-state-park' THEN 'moderate'
  WHEN 'boat-rock'                THEN 'moderate'

  -- Wave 2 (5 entries)
  WHEN 'desoto-falls'             THEN 'moderate'
  WHEN 'helton-creek-falls'       THEN 'easy'
  WHEN 'rabun-bald'               THEN 'hard'
  WHEN 'black-rock-mountain'      THEN 'easy'
  WHEN 'cohutta-overlook'         THEN 'easy'

  -- Wave 3 (6 entries)
  WHEN 'sweetwater-creek-state-park'  THEN 'easy'
  WHEN 'panola-mountain'              THEN 'easy'
  WHEN 'cochran-shoals-trail'         THEN 'easy'
  WHEN 'shoot-the-hooch-powers-island' THEN 'easy'
  WHEN 'island-ford-crnra-boat-ramp'  THEN 'easy'
  WHEN 'chattahoochee-bend-state-park' THEN 'easy'

  -- Wave 4 (5 entries)
  WHEN 'chattahoochee-river-nra'      THEN 'easy'
  WHEN 'east-palisades-trail'         THEN 'moderate'
  WHEN 'indian-trail-entrance-east-palisades-unit-chattahoochee-nra' THEN 'easy'
  WHEN 'whitewater-express-columbus'  THEN 'moderate'
  WHEN 'etowah-river-park'            THEN 'easy'

  -- Wave 5 (5 entries)
  WHEN 'red-top-mountain-state-park'  THEN 'easy'
  WHEN 'hard-labor-creek-state-park'  THEN 'easy'
  WHEN 'fort-yargo-state-park'        THEN 'easy'
  WHEN 'don-carter-state-park'        THEN 'easy'
  WHEN 'unicoi-state-park'            THEN 'easy'

END
FROM venues v
WHERE v.id = vdd.venue_id
  AND vdd.difficulty_level IS NULL
  AND v.slug IN (
    'amicalola-falls', 'tallulah-gorge', 'cloudland-canyon', 'blood-mountain',
    'springer-mountain', 'brasstown-bald', 'raven-cliff-falls', 'vogel-state-park',
    'fort-mountain-state-park', 'boat-rock',
    'desoto-falls', 'helton-creek-falls', 'rabun-bald', 'black-rock-mountain',
    'cohutta-overlook',
    'sweetwater-creek-state-park', 'panola-mountain', 'cochran-shoals-trail',
    'shoot-the-hooch-powers-island', 'island-ford-crnra-boat-ramp',
    'chattahoochee-bend-state-park',
    'chattahoochee-river-nra', 'east-palisades-trail',
    'indian-trail-entrance-east-palisades-unit-chattahoochee-nra',
    'whitewater-express-columbus', 'etowah-river-park',
    'red-top-mountain-state-park', 'hard-labor-creek-state-park',
    'fort-yargo-state-park', 'don-carter-state-park', 'unicoi-state-park'
  );

-- ── Step 2: destination_type fallback for remaining NULL rows ────────────────
-- Covers campground children, USFS trails, Corps lakes, and any other seeded
-- destinations not explicitly named in the TS config.

UPDATE venue_destination_details
SET difficulty_level = CASE destination_type
  -- Campgrounds and water-access nodes are operationally easy.
  WHEN 'campground'     THEN 'easy'
  WHEN 'water_access'   THEN 'easy'
  WHEN 'lake'           THEN 'easy'
  -- State parks vary widely; default to easy (visitor-center / scenic-drive access).
  WHEN 'state_park'     THEN 'easy'
  -- Waterfalls typically involve trail hiking; moderate is the safe default.
  WHEN 'waterfall'      THEN 'moderate'
  -- Trails: moderate unless terrain suggests otherwise.
  WHEN 'trail'          THEN 'moderate'
  -- Climbing areas always require effort.
  WHEN 'climbing_area'  THEN 'moderate'
  -- Viewpoints/overlooks reached by scenic drive are easy.
  WHEN 'viewpoint'      THEN 'easy'
  -- Summit hikes are hard by definition.
  WHEN 'summit'         THEN 'hard'
  ELSE 'easy'
END
WHERE difficulty_level IS NULL
  AND destination_type IS NOT NULL;

-- ── Step 3: venue_type catch-all for any rows still NULL ─────────────────────
-- Applies when destination_type was also not populated.

UPDATE venue_destination_details vdd
SET difficulty_level = CASE v.venue_type
  WHEN 'campground'       THEN 'easy'
  WHEN 'trail'            THEN 'moderate'
  WHEN 'park'             THEN 'easy'
  WHEN 'summit'           THEN 'hard'
  WHEN 'viewpoint'        THEN 'easy'
  ELSE 'easy'
END
FROM venues v
WHERE v.id = vdd.venue_id
  AND vdd.difficulty_level IS NULL;

-- ── Verification query (run after applying) ──────────────────────────────────
-- SELECT difficulty_level, COUNT(*) AS cnt
-- FROM venue_destination_details
-- GROUP BY difficulty_level
-- ORDER BY cnt DESC;
--
-- Expected: no NULL rows. All values in ('easy', 'moderate', 'hard').
