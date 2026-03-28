-- ============================================================
-- MIGRATION: Add scoring_config to portals
-- ============================================================
-- Stores per-hotel scoring weights for the FORTH concierge feed.
-- Default config matches the spec defaults; individual properties
-- can be overridden with a direct DB UPDATE.

ALTER TABLE portals
  ADD COLUMN IF NOT EXISTS scoring_config JSONB DEFAULT '{}';

-- Populate existing FORTH portals with the default config.
-- The default values match the spec:
--   proximity.walkable=80, close=25, far=15
--   neighborhood_boost=20
--   category_boosts={} (neutral by default)
--   suppress_categories=["support","religious"]
UPDATE portals
SET scoring_config = '{
  "proximity": { "walkable": 80, "close": 25, "far": 15 },
  "neighborhood_boost": 20,
  "category_boosts": {},
  "suppress_categories": ["support", "religious"]
}'::jsonb
WHERE slug IN ('forth')
  AND (scoring_config IS NULL OR scoring_config = '{}'::jsonb);

-- DOWN
-- ALTER TABLE portals DROP COLUMN IF EXISTS scoring_config;
