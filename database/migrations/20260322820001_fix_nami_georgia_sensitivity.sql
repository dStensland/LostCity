-- Fix NAMI Georgia: un-hide public training/advocacy events.
-- Support group events stay hidden (matched by infer_is_support_group keyword check).
--
-- Strategy: first clear source-level flag (stops future propagation),
-- then un-hide existing events using POSITIVE matching on known-safe types.
-- Negative matching ("NOT ILIKE support group") is fragile -- a title like
-- "NAMI Peer-to-Peer" would slip through.

-- Clear source-level is_sensitive flag first (stops future auto-propagation)
UPDATE sources
SET is_sensitive = false
WHERE slug = 'nami-georgia';

-- Un-hide events that are clearly public (positive match on known-safe patterns)
UPDATE events
SET is_sensitive = false
WHERE source_id = (SELECT id FROM sources WHERE slug = 'nami-georgia')
  AND is_active = true
  AND start_date >= CURRENT_DATE
  AND (
    title ILIKE '%first aid%'
    OR title ILIKE '%training%'
    OR title ILIKE '%walk%'
    OR title ILIKE '%awareness%'
    OR title ILIKE '%advocacy%'
    OR title ILIKE '%volunteer%'
    OR title ILIKE '%gala%'
    OR title ILIKE '%fundrais%'
    OR title ILIKE '%conference%'
    OR title ILIKE '%workshop%'
    OR title ILIKE '%speaker%'
    OR title ILIKE '%town hall%'
    OR title ILIKE '%screening%'
  );

-- Leave all other NAMI events as-is (still is_sensitive=true).
-- The crawler re-run (after removing nami-georgia from SUPPORT_GROUP_SOURCES)
-- will correctly flag only keyword-matched support groups going forward.
