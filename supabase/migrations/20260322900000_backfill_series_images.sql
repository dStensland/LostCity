-- Backfill series.image_url from the most recent event with an image.
-- Covers the 97.4% of series that currently have NULL image_url.
-- Excludes film series (those get TMDB posters via a separate path).

UPDATE series s
SET image_url = sub.image_url
FROM (
    SELECT DISTINCT ON (e.series_id)
        e.series_id,
        e.image_url
    FROM events e
    WHERE e.series_id IS NOT NULL
      AND e.image_url IS NOT NULL
    ORDER BY e.series_id, e.start_date DESC
) sub
WHERE s.id = sub.series_id
  AND s.image_url IS NULL
  AND s.series_type != 'film';
