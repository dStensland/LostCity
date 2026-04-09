-- Performance indexes for screening-primary query paths.
-- The primary showtimes API filters screening_times by date range, but the
-- existing idx_screening_times_run_start has screening_run_id as the leading
-- column — date-range queries without a run constraint hit a sequential scan.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_screening_times_date_time
  ON screening_times (start_date, start_time);

-- Reverse lookup: event detail → screening context.
-- Partial index since only cinema run-level events have event_id set.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_screening_times_event_id
  ON screening_times (event_id) WHERE event_id IS NOT NULL;
