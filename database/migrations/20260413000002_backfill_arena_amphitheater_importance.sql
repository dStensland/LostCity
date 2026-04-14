-- =============================================================================
-- Backfill: promote arena/amphitheater shows from standard → major
--
-- Root cause: _maybe_infer_importance() in crawlers/db/events.py read
-- event_data.get("category") but after _step_finalize() the key is renamed
-- to category_id. Both new inserts and smart-update paths passed the
-- post-finalize dict, so category was always "", causing every capacity-based
-- upgrade to silently no-op.
--
-- Fix: crawlers/db/events.py now reads
--   event_data.get("category") or event_data.get("category_id")
-- so the inference works for both dict shapes going forward.
--
-- This migration backfills the existing events that were missed.
-- Criteria mirrors the live inference logic exactly:
--   Tier 5 venues (arenas/stadiums): music, theater, comedy, art, food_drink, family
--   Tier 4 venues (amphitheaters):   music only
-- Excludes: classes, sports, title-noise patterns.
-- Only applies to future active events not already elevated.
-- =============================================================================

-- ============================================================================
-- Tier 5: arena/stadium shows (State Farm Arena, Mercedes-Benz Stadium, Truist Park)
-- ============================================================================
UPDATE events e
SET importance = 'major'
FROM places p
WHERE e.place_id = p.id
  AND p.capacity_tier >= 5
  AND e.importance = 'standard'
  AND e.is_active = true
  AND e.start_date >= CURRENT_DATE
  AND e.category_id IN ('music', 'theater', 'comedy', 'art', 'food_drink', 'family')
  AND COALESCE(e.is_class, false) = false
  AND e.title NOT ILIKE 'tours:%'
  AND e.title NOT ILIKE '%open gym%'
  AND e.title NOT ILIKE '%workout day%'
  AND e.title NOT ILIKE '%select-a-seat%'
  AND e.title NOT ILIKE '%symposium%'
  AND e.title NOT ILIKE '%conference%'
  AND e.title NOT ILIKE '%training event%'
  AND e.title NOT ILIKE '%member open%'
  AND e.title NOT ILIKE '%suite season%'
  AND e.title NOT ILIKE '%sth deposit%'
  AND e.title NOT ILIKE 'event for calendar%';

-- ============================================================================
-- Tier 4: amphitheater shows (Ameris Bank Amphitheatre, Chastain Park,
--         Lakewood Amphitheatre, Gas South Arena)
-- Music only — sports at tier 4 (Gladiators, Vibe) stay standard.
-- ============================================================================
UPDATE events e
SET importance = 'major'
FROM places p
WHERE e.place_id = p.id
  AND p.capacity_tier = 4
  AND e.importance = 'standard'
  AND e.is_active = true
  AND e.start_date >= CURRENT_DATE
  AND e.category_id = 'music'
  AND COALESCE(e.is_class, false) = false
  AND e.title NOT ILIKE 'tours:%'
  AND e.title NOT ILIKE '%open gym%'
  AND e.title NOT ILIKE '%workout day%'
  AND e.title NOT ILIKE '%suite season%'
  AND e.title NOT ILIKE '%sth deposit%'
  AND e.title NOT ILIKE 'event for calendar%';
