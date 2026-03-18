-- Add venue_id to series for venue-scoped matching (class_series, recurring_show)
ALTER TABLE series ADD COLUMN IF NOT EXISTS venue_id INTEGER REFERENCES venues(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_series_venue_id ON series(venue_id);

-- Backfill from most common venue per series (only for class/recurring types)
UPDATE series s SET venue_id = sub.venue_id
FROM (
  SELECT e.series_id, e.venue_id,
         ROW_NUMBER() OVER (PARTITION BY e.series_id ORDER BY COUNT(*) DESC) as rn
  FROM events e
  WHERE e.series_id IS NOT NULL AND e.venue_id IS NOT NULL
  GROUP BY e.series_id, e.venue_id
) sub
WHERE sub.series_id = s.id AND sub.rn = 1
  AND s.series_type IN ('class_series', 'recurring_show') AND s.venue_id IS NULL;
