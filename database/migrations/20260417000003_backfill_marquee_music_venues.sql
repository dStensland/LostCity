-- Migration: Backfill Marquee Music Venues
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.
--
-- Context: Plan 1 (migration 20260417150000_music_venue_classification_seed)
-- seeded the editorial tier of music venues (listening_room, curated_indie,
-- jazz_club, dj_electronic, drive_in_amph) and backfilled `capacity` for the
-- marquee tier — but it left `music_programming_style` NULL on the marquee
-- venues. The Live Tonight rebuild gates the loaders on
-- `music_programming_style IS NOT NULL`; without backfill, that gate would
-- drop legitimate marquee venues like the Tabernacle.
--
-- This migration:
--   1. Extends `music_programming_style_enum` with a new 'marquee' value.
--   2. Backfills `music_programming_style = 'marquee'` on the marquee/arena-tier
--      Atlanta music venues that 20260417150000 left NULL.
--
-- Slug list mirrors the canonical slugs in 20260417150000 §"MARQUEE" exactly.
-- Each UPDATE is scoped with `music_programming_style IS NULL` AND
-- `is_active = true` so an editorial classification cannot be overwritten and
-- deduped/inactive rows are not touched.

-- ═══ 1. Extend enum ═════════════════════════════════════════════════════
-- PG 12+ allows the new enum value to be used in the same transaction
-- (Supabase runs PG 15+).
ALTER TYPE music_programming_style_enum ADD VALUE IF NOT EXISTS 'marquee';

-- ═══ 2. Backfill marquee venues ═════════════════════════════════════════

UPDATE places SET music_programming_style = 'marquee'
  WHERE slug = 'tabernacle'
    AND is_active = true
    AND music_programming_style IS NULL;

UPDATE places SET music_programming_style = 'marquee'
  WHERE slug = 'the-eastern'
    AND is_active = true
    AND music_programming_style IS NULL;

UPDATE places SET music_programming_style = 'marquee'
  WHERE slug = 'buckhead-theatre'
    AND is_active = true
    AND music_programming_style IS NULL;

UPDATE places SET music_programming_style = 'marquee'
  WHERE slug = 'coca-cola-roxy'
    AND is_active = true
    AND music_programming_style IS NULL;

UPDATE places SET music_programming_style = 'marquee'
  WHERE slug = 'center-stage-atlanta'
    AND is_active = true
    AND music_programming_style IS NULL;

UPDATE places SET music_programming_style = 'marquee'
  WHERE slug = 'fox-theatre-atlanta'
    AND is_active = true
    AND music_programming_style IS NULL;

UPDATE places SET music_programming_style = 'marquee'
  WHERE slug = 'state-farm-arena'
    AND is_active = true
    AND music_programming_style IS NULL;

UPDATE places SET music_programming_style = 'marquee'
  WHERE slug = 'lakewood-amphitheatre'
    AND is_active = true
    AND music_programming_style IS NULL;

UPDATE places SET music_programming_style = 'marquee'
  WHERE slug = 'ameris-bank-amphitheatre'
    AND is_active = true
    AND music_programming_style IS NULL;

UPDATE places SET music_programming_style = 'marquee'
  WHERE slug = 'believe-music-hall'
    AND is_active = true
    AND music_programming_style IS NULL;

-- Verification (commented — uncomment when running by hand):
-- SELECT slug, name, capacity, music_programming_style
-- FROM places
-- WHERE music_programming_style = 'marquee'
-- ORDER BY capacity DESC NULLS LAST;
