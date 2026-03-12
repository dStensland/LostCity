-- ============================================
-- MIGRATION 335: Clean up Gladiators duplicate placeholders
-- ============================================
-- Deactivate weaker Gas South and Ticketmaster Gladiators rows when the
-- official Atlanta Gladiators source owns the same venue/date slot.

UPDATE events placeholder
SET is_active = false,
    updated_at = NOW()
FROM sources placeholder_source,
     sources official_source,
     events official_event
WHERE placeholder.source_id = placeholder_source.id
  AND official_event.source_id = official_source.id
  AND placeholder_source.slug IN ('gas-south', 'ticketmaster')
  AND official_source.slug = 'atlanta-gladiators'
  AND placeholder.is_active = true
  AND official_event.is_active = true
  AND placeholder.venue_id = official_event.venue_id
  AND placeholder.start_date = official_event.start_date
  AND (
    lower(placeholder.title) = 'atlanta gladiators'
    OR lower(placeholder.title) LIKE 'gladiators vs %suite%'
  );
