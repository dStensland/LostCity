-- Migration: add explicit content_kind for event/exhibit/special separation
-- This supports cleaner feed filtering and crawler intent modeling.

ALTER TABLE events
ADD COLUMN IF NOT EXISTS content_kind TEXT;

-- Normalize nulls first.
UPDATE events
SET content_kind = 'event'
WHERE content_kind IS NULL;

-- Promote known exhibition-like records.
UPDATE events AS e
SET content_kind = 'exhibit'
FROM series AS s
WHERE e.series_id = s.id
  AND s.series_type = 'exhibition';

-- Heuristic exhibit backfill for legacy recurring show data.
UPDATE events
SET content_kind = 'exhibit'
WHERE content_kind = 'event'
  AND (
    COALESCE(title, '') ~* '(exhibit|exhibition|on view|collection|installation)'
    OR COALESCE(description, '') ~* '(exhibit|exhibition|on view|collection|installation)'
    OR COALESCE(tags, ARRAY[]::text[]) && ARRAY[
      'exhibit',
      'exhibition',
      'museum',
      'gallery',
      'installation',
      'on-view',
      'on_view'
    ]::text[]
    OR COALESCE(genres, ARRAY[]::text[]) && ARRAY[
      'exhibit',
      'exhibition',
      'museum',
      'gallery',
      'installation'
    ]::text[]
  );

-- Mark specials content where already tagged by crawlers.
UPDATE events
SET content_kind = 'special'
WHERE content_kind = 'event'
  AND COALESCE(tags, ARRAY[]::text[]) && ARRAY[
    'specials',
    'special',
    'happy-hour',
    'happy_hour'
  ]::text[];

ALTER TABLE events
ALTER COLUMN content_kind SET DEFAULT 'event';

-- Final guard in case concurrent writes introduced null/blank values.
UPDATE events
SET content_kind = 'event'
WHERE content_kind IS NULL
   OR btrim(content_kind) = ''
   OR content_kind NOT IN ('event', 'exhibit', 'special');

ALTER TABLE events
ALTER COLUMN content_kind SET NOT NULL;

ALTER TABLE events
DROP CONSTRAINT IF EXISTS events_content_kind_check;

ALTER TABLE events
ADD CONSTRAINT events_content_kind_check
CHECK (content_kind IN ('event', 'exhibit', 'special'));

CREATE INDEX IF NOT EXISTS idx_events_content_kind ON events(content_kind);
