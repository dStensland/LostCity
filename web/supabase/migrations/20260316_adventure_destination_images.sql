-- Migration: Adventure destination image fixes
-- Fixes Recreation.gov/county placeholder images with real Wikimedia Commons photos.
-- Targets venues by slug, matching the slugs used in yonder-destination-intelligence.ts
-- and yonder-launch-destination-nodes.ts.

-- DeSoto Falls Recreation Area
-- Previously showed a Recreation.gov Facebook OG placeholder image.
-- Wikimedia Commons: Lower DeSoto Falls, Lumpkin County, Georgia (CC BY-SA 4.0)
UPDATE venues
SET hero_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Desoto_Falls_Lower_Lumpkin_County.jpg/1280px-Desoto_Falls_Lower_Lumpkin_County.jpg'
WHERE slug IN ('desoto-falls', 'desoto-falls-recreation-area');

-- Constitution Lakes Park
-- Previously showed a DeKalb County generic location icon placeholder.
-- Wikimedia Commons: Doll's Head Trail at Constitution Lakes (CC BY-SA 4.0)
-- Using the trail photo since it's the park's most visually distinctive feature.
UPDATE venues
SET hero_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Dolls_Head_Trail.jpg/1280px-Dolls_Head_Trail.jpg'
WHERE slug = 'constitution-lakes';

-- -----------------------------------------------------------------------
-- Destinations that still need manual image sourcing (no image_url OR
-- hero_image_url currently set, and no freely-licensed Wikimedia photo
-- confirmed available without external API access):
--
--   chattahoochee-bend-state-park  — state park, no prominent Wikimedia photo
--   cochran-shoals-trail           — no distinct Wikimedia coverage
--   island-ford-crnra-boat-ramp    — NPS unit, no good Wikimedia photo
--   red-top-mountain-state-park    — no prominent Wikimedia photo
--   panther-creek-falls            — no confirmed Wikimedia photo
--   helton-creek-falls             — no confirmed Wikimedia photo
--
-- Action: source photos via Georgia State Parks Flickr (CC BY 2.0),
-- NPS public domain photo library, or commission original photography.
-- -----------------------------------------------------------------------
