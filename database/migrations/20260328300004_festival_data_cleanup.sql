-- Migration: Festival Data Cleanup
--
-- Audit of 148 festivals found 48 misclassified entities:
--   19 ghosts (empty stubs), 27 expos/cons → events,
--   2 recurring series → series, 1 venue record.
-- After cleanup: ~100 true festivals remain.
--
-- Keep this file mirrored in database/migrations and supabase/migrations.

BEGIN;

-- ============================================================
-- 0. Add 'recreation' category for hobby expos, cons, etc.
-- ============================================================
INSERT INTO categories (id, name, display_order, icon, color)
VALUES ('recreation', 'Recreation', 18, '🎯', '#8B5CF6')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 1. Delete ghosts (19 rows)
--    These have ≤1 data field, zero events, zero meaningful content.
--    events.festival_id has ON DELETE SET NULL, so event refs auto-clear.
--    Explicitly nullify series.festival_id to be safe.
-- ============================================================

-- Clear series references for ghost festivals
UPDATE series SET festival_id = NULL
WHERE festival_id IN (
  'repticon-atlanta',
  'african-film-festival-atlanta',
  'atlanta-toy-model-train-show',
  'atlantacon',
  'bellpoint-gem-show',
  'blade-show',
  'conjuration',
  'critical-materials-minerals-expo',
  'explore-newnan-coweta',
  'georgia-renaissance-festival',
  'greater-atlanta-coin-show',
  'lenox-square-fourth-of-july-fireworks',
  'shaky-knees',
  'southern-fried-queer-pride',
  'stamp-scrapbook-expo',
  'west-end-comedy-fest',
  'atl-blues-festival',
  'atl-doc-film-fest',
  'atlanta-holi'
);

-- Delete ghosts (ON DELETE SET NULL handles events.festival_id)
DELETE FROM festivals
WHERE id IN (
  'repticon-atlanta',
  'african-film-festival-atlanta',
  'atlanta-toy-model-train-show',
  'atlantacon',
  'bellpoint-gem-show',
  'blade-show',
  'conjuration',
  'critical-materials-minerals-expo',
  'explore-newnan-coweta',
  'georgia-renaissance-festival',
  'greater-atlanta-coin-show',
  'lenox-square-fourth-of-july-fireworks',
  'shaky-knees',
  'southern-fried-queer-pride',
  'stamp-scrapbook-expo',
  'west-end-comedy-fest',
  'atl-blues-festival',
  'atl-doc-film-fest',
  'atlanta-holi'
);

-- ============================================================
-- 2. Delete venue record (1 row)
--    Georgia International Convention Center is a place, not a festival.
-- ============================================================
UPDATE series SET festival_id = NULL
WHERE festival_id = 'georgia-international-convention-center';

DELETE FROM festivals
WHERE id = 'georgia-international-convention-center';

-- ============================================================
-- 3. Reclassify expos/cons as events (27 rows)
--    Create event stubs from festival metadata, then delete festivals.
-- ============================================================

-- Clear series references first
UPDATE series SET festival_id = NULL
WHERE festival_id IN (
  '50-shades-of-black-anime',
  'atlanta-bead-show',
  'atlanta-comic-convention',
  'atlanta-home-show-spring',
  'atlanta-international-auto-show',
  'atlanta-model-train-show',
  'atlanta-motoring-festival',
  'atlanta-orchid-show',
  'atlanta-pen-show',
  'atlanta-sci-fi-fantasy-expo',
  'collect-a-con-atlanta-fall',
  'collect-a-con-atlanta-spring',
  'conyers-kennel-club-dog-show',
  'daggercon',
  'furry-weekend-atlanta',
  'georgia-mineral-society-show',
  'georgia-vegfest',
  'healing-psychic-fair-atlanta',
  'intergalactic-bead-show-atlanta',
  'international-woodworking-fair',
  'momocon',
  'original-sewing-quilt-expo',
  'southeast-reptile-expo',
  'southeastern-stamp-expo',
  'world-oddities-expo-atlanta',
  'wreckcon',
  'georgia-technology-summit'
);

-- Temporarily disable triggers that reference old venue_id column
ALTER TABLE events DISABLE TRIGGER event_adult_flag_trigger;
ALTER TABLE events DISABLE TRIGGER trg_inherit_venue_is_adult;

-- Insert events from festival data
-- source_url and start_date are NOT NULL, so we use fallbacks
INSERT INTO events (
  title,
  description,
  start_date,
  end_date,
  category_id,
  source_url,
  ticket_url,
  image_url,
  is_active,
  portal_id
)
SELECT
  f.name,
  f.description,
  COALESCE(f.announced_start, '2099-01-01'::date),
  f.announced_end,
  'recreation',
  COALESCE(f.website, f.ticket_url, 'https://lostcity.app/festivals/' || f.slug),
  f.ticket_url,
  f.image_url,
  true,
  COALESCE(f.portal_id, (SELECT id FROM portals WHERE slug = 'atlanta'))
FROM festivals f
WHERE f.id IN (
  '50-shades-of-black-anime',
  'atlanta-bead-show',
  'atlanta-comic-convention',
  'atlanta-home-show-spring',
  'atlanta-international-auto-show',
  'atlanta-model-train-show',
  'atlanta-motoring-festival',
  'atlanta-orchid-show',
  'atlanta-pen-show',
  'atlanta-sci-fi-fantasy-expo',
  'collect-a-con-atlanta-fall',
  'collect-a-con-atlanta-spring',
  'conyers-kennel-club-dog-show',
  'daggercon',
  'furry-weekend-atlanta',
  'georgia-mineral-society-show',
  'georgia-vegfest',
  'healing-psychic-fair-atlanta',
  'intergalactic-bead-show-atlanta',
  'international-woodworking-fair',
  'momocon',
  'original-sewing-quilt-expo',
  'southeast-reptile-expo',
  'southeastern-stamp-expo',
  'world-oddities-expo-atlanta',
  'wreckcon',
  'georgia-technology-summit'
);

-- Re-enable triggers
ALTER TABLE events ENABLE TRIGGER event_adult_flag_trigger;
ALTER TABLE events ENABLE TRIGGER trg_inherit_venue_is_adult;

-- Now delete the reclassified festivals (events.festival_id auto-nullified)
DELETE FROM festivals
WHERE id IN (
  '50-shades-of-black-anime',
  'atlanta-bead-show',
  'atlanta-comic-convention',
  'atlanta-home-show-spring',
  'atlanta-international-auto-show',
  'atlanta-model-train-show',
  'atlanta-motoring-festival',
  'atlanta-orchid-show',
  'atlanta-pen-show',
  'atlanta-sci-fi-fantasy-expo',
  'collect-a-con-atlanta-fall',
  'collect-a-con-atlanta-spring',
  'conyers-kennel-club-dog-show',
  'daggercon',
  'furry-weekend-atlanta',
  'georgia-mineral-society-show',
  'georgia-vegfest',
  'healing-psychic-fair-atlanta',
  'intergalactic-bead-show-atlanta',
  'international-woodworking-fair',
  'momocon',
  'original-sewing-quilt-expo',
  'southeast-reptile-expo',
  'southeastern-stamp-expo',
  'world-oddities-expo-atlanta',
  'wreckcon',
  'georgia-technology-summit'
);

-- ============================================================
-- 4. Reclassify recurring series (2 rows)
--    NASCAR and Supercross → series with their events reassigned.
-- ============================================================

-- Create series from Supercross
INSERT INTO series (slug, title, description, series_type, image_url, is_active)
SELECT
  f.slug,
  f.name,
  f.description,
  'recurring_show',
  f.image_url,
  true
FROM festivals f
WHERE f.id = 'atlanta-supercross';

-- Reassign Supercross events to new series
UPDATE events
SET series_id = (SELECT id FROM series WHERE slug = 'atlanta-supercross'),
    festival_id = NULL
WHERE festival_id = 'atlanta-supercross';

-- Clear series references
UPDATE series SET festival_id = NULL
WHERE festival_id = 'atlanta-supercross';

-- Delete Supercross festival
DELETE FROM festivals WHERE id = 'monster-energy-ama-supercross';

-- Create series from NASCAR
INSERT INTO series (slug, title, description, series_type, image_url, is_active)
SELECT
  f.slug,
  f.name,
  f.description,
  'recurring_show',
  f.image_url,
  true
FROM festivals f
WHERE f.id = 'nascar-atlanta';

-- Reassign NASCAR events to new series
UPDATE events
SET series_id = (SELECT id FROM series WHERE slug = 'nascar-atlanta'),
    festival_id = NULL
WHERE festival_id = 'nascar-atlanta';

-- Clear series references
UPDATE series SET festival_id = NULL
WHERE festival_id = 'nascar-atlanta';

-- Delete NASCAR festival
DELETE FROM festivals WHERE id = 'nascar-at-atlanta-motor-speedway';

-- ============================================================
-- 5. Fix Render ATL dates (likely multi-day, flagged as single-day)
-- ============================================================
-- Render ATL is a major tech conference — typically 3-4 days.
-- If announced_start == announced_end, the end date is wrong.
-- Set end_date 3 days after start as a reasonable default.
UPDATE festivals
SET announced_end = announced_start + INTERVAL '3 days'
WHERE id = 'render-atl'
  AND announced_start IS NOT NULL
  AND announced_start = announced_end;

-- ============================================================
-- 6. Verification queries (run these after migration)
-- ============================================================
-- SELECT count(*) FROM festivals;  -- expect ~99
-- SELECT count(*) FROM events WHERE festival_id IS NOT NULL;  -- should be reduced
-- SELECT count(*) FROM series WHERE festival_id IS NOT NULL;  -- should be 0 for deleted festivals
-- SELECT * FROM events WHERE category_id = 'recreation' ORDER BY title;  -- new events

COMMIT;
