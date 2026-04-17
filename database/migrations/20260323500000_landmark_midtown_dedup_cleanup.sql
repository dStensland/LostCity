-- Remove duplicate events from Landmark Midtown Art Cinema (source 29).
--
-- Root cause: when the Playwright date-navigation silently stayed on the same
-- day's content, the crawler re-extracted identical (title, date, time) tuples
-- and inserted them because the content_hash check could be bypassed on
-- concurrent runs.  The crawler has been fixed with an in-process seen_showtimes
-- guard; this migration cleans up duplicates already in the DB.
--
-- Strategy: for each (title, start_date, venue_id) group keep the oldest row
-- (lowest created_at) and hard-delete the rest.  We include start_time in the
-- PARTITION key so that legitimate distinct showtimes (e.g. 4pm vs 7pm) are
-- preserved and only true same-showtime duplicates are removed.

-- Verify scope first (run as SELECT before applying):
-- SELECT id, title, start_date, start_time, venue_id, created_at,
--        ROW_NUMBER() OVER (
--            PARTITION BY title, start_date, start_time, venue_id
--            ORDER BY created_at ASC
--        ) AS rn
-- FROM events
-- WHERE source_id = 29
--   AND is_active = true
-- ORDER BY title, start_date, start_time;

DELETE FROM events
WHERE id IN (
    SELECT id
    FROM (
        SELECT
            id,
            ROW_NUMBER() OVER (
                PARTITION BY title, start_date, start_time, venue_id
                ORDER BY created_at ASC
            ) AS rn
        FROM events
        WHERE source_id = 29
          AND is_active = true
    ) ranked
    WHERE rn > 1
);
