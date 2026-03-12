-- ============================================
-- MIGRATION 336: Clean up Braves premium duplicates
-- ============================================
-- Deactivate weaker Ticketmaster premium-seating rows and the stale Opening Day
-- festival row when official Truist Park coverage owns the same game slot.

UPDATE events placeholder
SET is_active = false,
    updated_at = NOW()
FROM sources placeholder_source,
     sources official_source,
     events official_event
WHERE placeholder.source_id = placeholder_source.id
  AND official_event.source_id = official_source.id
  AND placeholder_source.slug = 'ticketmaster'
  AND official_source.slug = 'truist-park'
  AND placeholder.is_active = true
  AND official_event.is_active = true
  AND placeholder.venue_id = official_event.venue_id
  AND placeholder.start_date = official_event.start_date
  AND lower(placeholder.title) LIKE 'atlanta braves%'
  AND lower(placeholder.title) LIKE '%premium seating%';

UPDATE events placeholder
SET is_active = false,
    updated_at = NOW()
FROM sources placeholder_source,
     sources official_source,
     events official_event
WHERE placeholder.source_id = placeholder_source.id
  AND official_event.source_id = official_source.id
  AND placeholder_source.slug = 'atlanta-braves-opening-day'
  AND official_source.slug = 'truist-park'
  AND placeholder.is_active = true
  AND official_event.is_active = true
  AND placeholder.venue_id = official_event.venue_id
  AND placeholder.start_date = official_event.start_date;
