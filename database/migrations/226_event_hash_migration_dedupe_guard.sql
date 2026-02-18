-- Migration 226: collapse hash-migration duplicates and add hard uniqueness guards.
-- Context:
-- 2026-02-16 changed generate_content_hash() venue normalization. Existing rows kept
-- legacy hashes, so crawls started inserting duplicate rows for the same slot/title.

-- 1) Build duplicate mapping by natural key and keep the oldest row.
-- We intentionally keep oldest IDs to preserve existing foreign-key references.
CREATE TEMP TABLE _event_dupe_map AS
WITH normalized AS (
  SELECT
    e.id,
    e.source_id,
    e.venue_id,
    e.start_date,
    e.start_time,
    e.title,
    trim(
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(coalesce(e.title, '')), '\s+', ' ', 'g'),
          '^(the|a|an)\s+',
          ''
        ),
        '[^a-z0-9\s]',
        '',
        'g'
      )
    ) AS norm_title,
    e.created_at
  FROM events e
  WHERE e.source_id IS NOT NULL
    AND e.venue_id IS NOT NULL
    AND e.start_date IS NOT NULL
    AND e.title IS NOT NULL
),
ranked AS (
  SELECT
    n.*,
    row_number() OVER (
      PARTITION BY n.source_id, n.venue_id, n.start_date, n.start_time, n.norm_title
      ORDER BY
        n.created_at ASC NULLS FIRST,
        n.id ASC
    ) AS rn,
    first_value(n.id) OVER (
      PARTITION BY n.source_id, n.venue_id, n.start_date, n.start_time, n.norm_title
      ORDER BY
        n.created_at ASC NULLS FIRST,
        n.id ASC
    ) AS keep_id,
    count(*) OVER (
      PARTITION BY n.source_id, n.venue_id, n.start_date, n.start_time, n.norm_title
    ) AS grp_count
  FROM normalized n
)
SELECT
  id AS dupe_id,
  keep_id
FROM ranked
WHERE grp_count > 1
  AND rn > 1;

-- 2) Re-point self-references.
UPDATE events e
SET canonical_event_id = dm.keep_id
FROM _event_dupe_map dm
WHERE e.canonical_event_id = dm.dupe_id;

-- 3) Delete duplicate rows (child rows with ON DELETE CASCADE will be cleaned up).
DELETE FROM events e
USING _event_dupe_map dm
WHERE e.id = dm.dupe_id;

-- 4) Add DB-level uniqueness guards so this cannot silently recur.
-- Timed events
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_unique_source_venue_slot_norm_title_timed
ON events (
  source_id,
  venue_id,
  start_date,
  start_time,
  (trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(coalesce(title, '')), '\s+', ' ', 'g'),
        '^(the|a|an)\s+',
        ''
      ),
      '[^a-z0-9\s]',
      '',
      'g'
    )
  ))
)
WHERE source_id IS NOT NULL
  AND venue_id IS NOT NULL
  AND start_date IS NOT NULL
  AND title IS NOT NULL
  AND start_time IS NOT NULL;

-- Time-TBD events
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_unique_source_venue_slot_norm_title_notimed
ON events (
  source_id,
  venue_id,
  start_date,
  (trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(coalesce(title, '')), '\s+', ' ', 'g'),
        '^(the|a|an)\s+',
        ''
      ),
      '[^a-z0-9\s]',
      '',
      'g'
    )
  ))
)
WHERE source_id IS NOT NULL
  AND venue_id IS NOT NULL
  AND start_date IS NOT NULL
  AND title IS NOT NULL
  AND start_time IS NULL;
