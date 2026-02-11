-- Backfill existing regular cinema and drive-in showtimes with the "showtime" tag.
-- This tag is used to filter routine showtimes from curated feeds while keeping them
-- visible in search, browse, and map views. Special screenings, festivals, and
-- film society events are intentionally excluded.
--
-- Affected subcategories: cinema (~310 events), drive_in (~36 events)

UPDATE events
SET tags = array_append(tags, 'showtime')
WHERE category = 'film'
  AND subcategory IN ('cinema', 'drive_in')
  AND NOT ('showtime' = ANY(COALESCE(tags, '{}')));
