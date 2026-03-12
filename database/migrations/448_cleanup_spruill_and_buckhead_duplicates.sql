-- ============================================================
-- MIGRATION 448: Cleanup Spruill duplicate source + Buckhead TM overlap
-- ============================================================

-- Move future active Spruill rows onto the canonical source record.
UPDATE events e
SET source_id = canonical_source.id,
    portal_id = canonical_source.owner_portal_id,
    updated_at = NOW()
FROM sources canonical_source,
     sources legacy_source
WHERE canonical_source.slug = 'spruill-center-for-the-arts'
  AND legacy_source.slug = 'spruill-center'
  AND e.source_id = legacy_source.id
  AND e.is_active = true
  AND e.start_date >= current_date;

-- Deactivate the duplicate legacy source once ownership is consolidated.
UPDATE sources
SET is_active = false
WHERE slug = 'spruill-center'
  AND is_active = true;

-- Deactivate Ticketmaster duplicates when Buckhead Theatre owns the exact same
-- venue/date/time/title slot.
UPDATE events ticketmaster_event
SET is_active = false,
    updated_at = NOW()
FROM sources tm_source,
     sources official_source,
     events official_event
WHERE tm_source.slug = 'ticketmaster'
  AND official_source.slug = 'buckhead-theatre'
  AND ticketmaster_event.source_id = tm_source.id
  AND official_event.source_id = official_source.id
  AND ticketmaster_event.is_active = true
  AND official_event.is_active = true
  AND ticketmaster_event.venue_id = official_event.venue_id
  AND ticketmaster_event.start_date = official_event.start_date
  AND COALESCE(ticketmaster_event.start_time::text, '') = COALESCE(official_event.start_time::text, '')
  AND lower(ticketmaster_event.title) = lower(official_event.title)
  AND ticketmaster_event.id <> official_event.id;
