-- Deactivate Georgia STAND-UP source.
--
-- Investigation (2026-03-22):
--   - Site is still Wix (confirmed via Playwright), no bot blocking.
--   - Wix Events widget returns [data-hook='EVENTS_ROOT_NODE'] with
--     "No events at the moment" — the calendar has been empty since the
--     source was registered on 2026-03-10.
--   - 12 crawl runs across 12 days, all events_found=0, 0 events ever
--     stored from this source.
--   - The crawler correctly detects the empty state via _body_has_no_events()
--     so there is no extraction bug — the org simply has no public events
--     scheduled right now.
--   - Georgia STAND-UP uses their site primarily for resources and organizing
--     rather than as a live event calendar. Their event cadence appears
--     irregular and infrequent.
--   - Keeping this source active wastes expensive Playwright cycles on every
--     crawl run with zero yield.
--
-- Action: deactivate and tag. Can be reactivated when the org is known to
-- have events (e.g., during an election cycle, major legislative session, etc.).

UPDATE sources
SET
    is_active   = false,
    health_tags = array_append(COALESCE(health_tags, '{}'), 'deactivated:no_events')
WHERE slug = 'georgia-stand-up'
  AND is_active = true;

-- No future events exist to deactivate (confirmed 0 rows in events table
-- for this source), but include the pattern for completeness and safety.
UPDATE events
SET is_active = false
WHERE source_id IN (
    SELECT id FROM sources WHERE slug = 'georgia-stand-up'
)
  AND start_date >= CURRENT_DATE
  AND is_active = true;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
