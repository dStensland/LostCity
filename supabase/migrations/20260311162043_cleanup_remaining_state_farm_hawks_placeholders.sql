-- ============================================================
-- MIGRATION 424: Cleanup Remaining State Farm Hawks Placeholders
-- ============================================================

UPDATE events placeholder
SET is_active = false,
    updated_at = NOW()
FROM sources placeholder_source,
     sources official_source,
     events official_event
WHERE placeholder.source_id = placeholder_source.id
  AND official_event.source_id = official_source.id
  AND placeholder_source.slug = 'state-farm-arena'
  AND official_source.slug = 'atlanta-hawks'
  AND placeholder.is_active = true
  AND official_event.is_active = true
  AND placeholder.venue_id = official_event.venue_id
  AND placeholder.start_date = official_event.start_date
  AND (
    lower(placeholder.title) LIKE 'atlanta hawks vs%'
    OR lower(placeholder.title) LIKE 'atlanta hawks v.%'
    OR lower(placeholder.title) LIKE 'atlanta hawks v %'
    OR lower(placeholder.title) LIKE 'hawks vs %'
    OR lower(placeholder.title) LIKE 'hawks v. %'
    OR lower(placeholder.title) LIKE 'hawks v %'
  );
