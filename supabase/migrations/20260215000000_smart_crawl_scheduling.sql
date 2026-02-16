-- Smart Crawl Scheduling
-- Adds cadence-based scheduling columns and zero-event regression detection.
-- The crawl_frequency column already exists (TEXT DEFAULT 'daily') but is unused.

-- 1. New columns on sources
ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_crawled_at TIMESTAMPTZ;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS expected_event_count INTEGER;

-- 2. New column on crawl_logs (events_rejected was handled via try/except fallback before)
ALTER TABLE crawl_logs ADD COLUMN IF NOT EXISTS events_rejected INTEGER DEFAULT 0;

-- 3. Backfill last_crawled_at from crawl_logs history
UPDATE sources s SET last_crawled_at = sub.last
FROM (
  SELECT source_id, MAX(completed_at) AS last
  FROM crawl_logs WHERE status = 'success'
  GROUP BY source_id
) sub
WHERE s.id = sub.source_id AND s.last_crawled_at IS NULL;

-- 4. Set crawl_frequency based on slug patterns (sources has no venue_id FK)
-- Medium-velocity by slug patterns: twice_weekly
UPDATE sources SET crawl_frequency = 'twice_weekly'
WHERE crawl_frequency = 'daily'
  AND (slug LIKE '%theater%' OR slug LIKE '%theatre%'
       OR slug LIKE '%gallery%' OR slug LIKE '%cinema%');

-- Low-velocity by slug patterns: weekly
UPDATE sources SET crawl_frequency = 'weekly'
WHERE crawl_frequency = 'daily'
  AND (slug LIKE '%museum%' OR slug LIKE '%park%'
       OR slug LIKE '%library%' OR slug LIKE '%garden%');

-- Support/health sources by slug pattern: weekly
UPDATE sources SET crawl_frequency = 'weekly'
WHERE crawl_frequency = 'daily'
  AND (slug LIKE '%hospital%' OR slug LIKE '%health%'
       OR slug LIKE '%support%' OR slug LIKE '%medical%');

-- 5. Normalize any non-standard crawl_frequency values before adding constraint
UPDATE sources SET crawl_frequency = 'daily'
WHERE crawl_frequency IS NULL
   OR crawl_frequency NOT IN ('daily', 'twice_weekly', 'weekly', 'monthly');

-- CHECK constraint on crawl_frequency (idempotent)
DO $$ BEGIN
  ALTER TABLE sources ADD CONSTRAINT sources_crawl_frequency_check
    CHECK (crawl_frequency IN ('daily', 'twice_weekly', 'weekly', 'monthly'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Index for smart scheduling queries
CREATE INDEX IF NOT EXISTS idx_sources_crawl_schedule
  ON sources (crawl_frequency, last_crawled_at) WHERE is_active = true;
