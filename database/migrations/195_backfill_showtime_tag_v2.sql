-- Backfill "showtime" tag for ALL film events at cinema venues that are missing it.
-- The original migration (190) only matched on subcategory, missing indie cinemas
-- like Plaza Theatre and Starlight Drive-In whose events had NULL/empty subcategory.
-- Root cause: "showtime" was not in ALL_TAGS until Feb 11, so infer_tags() stripped
-- it from any event inserted before that date, even when crawlers set it explicitly.
-- This version simply tags every film event at a cinema venue — no subcategory filter.
-- Already applied via Python backfill on 2026-02-12 (428 events).

UPDATE events e
SET tags = array_append(COALESCE(e.tags, '{}'), 'showtime')
FROM venues v
WHERE e.venue_id = v.id
  AND e.category = 'film'
  AND v.venue_type = 'cinema'
  AND NOT ('showtime' = ANY(COALESCE(e.tags, '{}')));
