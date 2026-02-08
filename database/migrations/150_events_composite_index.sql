-- Performance: Add composite index for the most common event query pattern
-- (portal_id + start_date + category) with partial index excluding canonical dupes
-- This covers the events API, feed, tonight, and search endpoints

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_portal_date_category
ON events(portal_id, start_date, category)
WHERE canonical_event_id IS NULL;

-- Also add an index for series rollups which are frequently queried
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_series_id
ON events(series_id)
WHERE series_id IS NOT NULL;
