-- ============================================
-- MIGRATION 331: Clean up Mercedes-Benz Atlanta United placeholder row
-- ============================================
-- Deactivate legacy Mercedes-Benz Stadium placeholder rows once an official
-- Atlanta United FC row exists for the same date and venue.

UPDATE events placeholder
SET is_active = false,
    updated_at = now()
FROM sources placeholder_source,
     sources official_source
WHERE placeholder.source_id = placeholder_source.id
  AND official_source.slug = 'atlanta-united-fc'
  AND placeholder_source.slug = 'mercedes-benz-stadium'
  AND placeholder.is_active = true
  AND placeholder.title ILIKE 'Atlanta United vs.%'
  AND EXISTS (
    SELECT 1
    FROM events official_event
    WHERE official_event.source_id = official_source.id
      AND official_event.venue_id = placeholder.venue_id
      AND official_event.start_date = placeholder.start_date
      AND official_event.is_active = true
      AND official_event.title ILIKE 'Atlanta United FC vs.%'
  );
