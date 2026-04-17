-- Migration: Music Place Dedupe
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.
--
-- Scope: music-venue-relevant duplicate place records with non-trivial event traffic.
-- Policy: canonical = row with more events; merge event + child FKs; mark dupe inactive.
--
-- Audit (2026-04-17) surfaced these music-relevant active dupe pairs:
--   terminal-west: id 121 (112 events, canonical) vs id 365 (0 events, dupe slug 'terminal-west-test')
--   the-earl:      id 1   ( 44 events, canonical) vs id 370 (0 events, dupe slug 'the-earl-test')
--
-- Other venue dupes (restaurants, etc.) remain as data-quality follow-up; out of scope
-- for the music tiering work. Fox Theatre (seeded slug 'fox-theatre-atlanta') already
-- has its '-test' dupe (id 369) marked inactive — no action needed.

DO $$
DECLARE
  v_canon_id integer;
  v_dupe_id  integer;
BEGIN
  -- ═══ Terminal West ═══════════════════════════════════════════════════════
  v_canon_id := 121;  -- slug 'terminal-west'
  v_dupe_id  := 365;  -- slug 'terminal-west-test'

  UPDATE events SET place_id = v_canon_id WHERE place_id = v_dupe_id;
  UPDATE places SET parent_place_id = v_canon_id WHERE parent_place_id = v_dupe_id;
  UPDATE places SET
    is_active = false,
    slug      = slug || '-dupe-' || v_dupe_id,
    name      = name || ' [DEDUPED]'
  WHERE id = v_dupe_id;

  -- ═══ The Earl ════════════════════════════════════════════════════════════
  v_canon_id := 1;    -- slug 'the-earl'
  v_dupe_id  := 370;  -- slug 'the-earl-test'

  UPDATE events SET place_id = v_canon_id WHERE place_id = v_dupe_id;
  UPDATE places SET parent_place_id = v_canon_id WHERE parent_place_id = v_dupe_id;
  UPDATE places SET
    is_active = false,
    slug      = slug || '-dupe-' || v_dupe_id,
    name      = name || ' [DEDUPED]'
  WHERE id = v_dupe_id;
END $$;
