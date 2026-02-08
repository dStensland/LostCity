-- Migration: 148_festival_crawl_readiness.sql
-- Purpose: Create missing festival records and activate sources for crawling
-- Date: 2026-02-08

BEGIN;

-- ============================================================================
-- PART 1: Create missing festival records for existing sources
-- ============================================================================

INSERT INTO festivals (id, slug, name, festival_type) VALUES
  -- Film Festivals
  ('ajff', 'ajff', 'Atlanta Jewish Film Festival', 'film'),
  ('buried-alive', 'buried-alive', 'Buried Alive Film Festival', 'film'),

  -- Music Festivals
  ('atlanta-jazz-festival', 'atlanta-jazz-festival', 'Atlanta Jazz Festival', 'music'),
  ('music-midtown', 'music-midtown', 'Music Midtown', 'music'),

  -- Food & Drink Festivals
  ('atlanta-food-wine', 'atlanta-food-wine', 'Atlanta Food & Wine Festival', 'food_drink'),

  -- Arts & Culture Festivals
  ('atlanta-dogwood', 'atlanta-dogwood', 'Atlanta Dogwood Festival', 'arts_culture'),
  ('render-atl', 'render-atl', 'Render ATL', 'conference'),

  -- Conference / Tech Festivals
  ('atlanta-tech-week', 'atlanta-tech-week', 'Atlanta Tech Week', 'conference'),

  -- Community Festivals
  ('atlanta-pride', 'atlanta-pride', 'Atlanta Pride', 'community'),
  ('candler-park-fest', 'candler-park-fest', 'Candler Park Fall Fest', 'community'),
  ('grant-park-festival', 'grant-park-festival', 'Grant Park Summer Shade Festival', 'community'),
  ('sweet-auburn-springfest', 'sweet-auburn-springfest', 'Sweet Auburn Springfest', 'community')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- PART 2: Activate 11 inactive sources for crawling
-- ============================================================================

UPDATE sources SET is_active = true WHERE slug IN (
  'a3c-festival',
  'afropunk-atlanta',
  'atlanta-greek-festival',
  'atlanta-tattoo-arts-festival',
  'blade-show',
  'furry-weekend-atlanta',
  'ga-renaissance-festival',
  'imagine-music-festival',
  'japanfest-atlanta',
  'southern-fried-gaming-expo',
  'stone-mountain-highland-games'
);

-- ============================================================================
-- PART 3: Activate candler-park-fest source
-- ============================================================================

UPDATE sources SET is_active = true WHERE slug = 'candler-park-fest';

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (run separately to check results)
-- ============================================================================

-- Check festival records created:
-- SELECT id, name, festival_type FROM festivals
-- WHERE slug IN (
--   'ajff', 'atlanta-dogwood', 'atlanta-food-wine', 'atlanta-jazz-festival',
--   'atlanta-pride', 'atlanta-tech-week', 'buried-alive', 'candler-park-fest',
--   'grant-park-festival', 'music-midtown', 'render-atl', 'sweet-auburn-springfest'
-- )
-- ORDER BY name;

-- Check activated sources:
-- SELECT slug, name, is_active FROM sources
-- WHERE slug IN (
--   'a3c-festival', 'afropunk-atlanta', 'atlanta-greek-festival',
--   'atlanta-tattoo-arts-festival', 'blade-show', 'candler-park-fest',
--   'furry-weekend-atlanta', 'ga-renaissance-festival', 'imagine-music-festival',
--   'japanfest-atlanta', 'southern-fried-gaming-expo', 'stone-mountain-highland-games'
-- )
-- ORDER BY slug;

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================

-- DELETE FROM festivals WHERE slug IN (
--   'ajff', 'atlanta-dogwood', 'atlanta-food-wine', 'atlanta-jazz-festival',
--   'atlanta-pride', 'atlanta-tech-week', 'buried-alive', 'candler-park-fest',
--   'grant-park-festival', 'music-midtown', 'render-atl', 'sweet-auburn-springfest'
-- );

-- UPDATE sources SET is_active = false WHERE slug IN (
--   'a3c-festival', 'afropunk-atlanta', 'atlanta-greek-festival',
--   'atlanta-tattoo-arts-festival', 'blade-show', 'candler-park-fest',
--   'furry-weekend-atlanta', 'ga-renaissance-festival', 'imagine-music-festival',
--   'japanfest-atlanta', 'southern-fried-gaming-expo', 'stone-mountain-highland-games'
-- );
