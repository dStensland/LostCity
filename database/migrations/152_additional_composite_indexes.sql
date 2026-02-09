-- ============================================
-- MIGRATION 152: Additional Composite Indexes for Performance
-- ============================================
-- Adds composite indexes to optimize common query patterns

-- Composite index on (start_date, portal_id) for date range + portal queries
-- This is the reverse order of the existing idx_events_portal_date_category
-- and covers queries that filter by date first, then portal
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_start_date_portal_id
ON events(start_date, portal_id);

-- Composite index on (venue_id, start_date) for venue detail pages
-- Venue pages query events by venue + date range
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_venue_id_start_date
ON events(venue_id, start_date);

-- Composite index on (category, start_date) for category filtering
-- Category pages and filters often combine category + date range
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_category_start_date
ON events(category, start_date);

-- Partial index for "future events with times" query pattern
-- Many queries filter for events that have start_time populated
-- Partial index is smaller and faster than full index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_start_date_with_time
ON events(start_date)
WHERE start_time IS NOT NULL;

-- Add comments documenting the indexes
COMMENT ON INDEX idx_events_start_date_portal_id IS 'Optimizes date range queries filtered by portal';
COMMENT ON INDEX idx_events_venue_id_start_date IS 'Optimizes venue detail page event listings';
COMMENT ON INDEX idx_events_category_start_date IS 'Optimizes category filtering with date ranges';
COMMENT ON INDEX idx_events_start_date_with_time IS 'Partial index for queries requiring start_time to be set';
