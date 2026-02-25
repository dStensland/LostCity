-- Normalize orphan festival sources.
-- Mirrors database/migrations/237_normalize_orphan_festival_sources.sql

BEGIN;

WITH orphan_festival_sources AS (
    SELECT s.id
    FROM sources s
    LEFT JOIN festivals f ON f.slug = s.slug
    WHERE s.source_type = 'festival'
      AND f.slug IS NULL
)
UPDATE sources s
SET source_type = 'organization',
    health_tags = (
        SELECT ARRAY(
            SELECT DISTINCT tag
            FROM unnest(
                COALESCE(s.health_tags, '{}'::text[]) || ARRAY[
                    'festival-model-cleanup',
                    'not-in-festivals-table',
                    'retyped-from-festival'
                ]
            ) AS tag
        )
    )
WHERE s.id IN (SELECT id FROM orphan_festival_sources);

COMMIT;
