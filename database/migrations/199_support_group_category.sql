-- Reclassify support group events from wellness to support_group
-- and mark them as sensitive so they're excluded from the event feed.

-- Keyword-based reclassification (any category)
UPDATE events
SET category = 'support_group', is_sensitive = true
WHERE category != 'support_group'
  AND (
    title ILIKE '%griefshare%'
    OR title ILIKE '%grief share%'
    OR title ILIKE '%grief support%'
    OR title ILIKE '%bereavement%'
    OR title ILIKE '%celebrate recovery%'
    OR title ILIKE '%recovery group%'
    OR title ILIKE '%recovery meeting%'
    OR title ILIKE '%al-anon%'
    OR title ILIKE '%nar-anon%'
    OR title ILIKE '%aa meeting%'
    OR title ILIKE '%na meeting%'
    OR title ILIKE '%alcoholics anonymous%'
    OR title ILIKE '%narcotics anonymous%'
    OR title ILIKE '%support group%'
    OR title ILIKE '%survivors group%'
    OR title ILIKE '%divorcecare%'
    OR title ILIKE '%divorce care%'
    OR title ILIKE '%cancer support%'
    OR title ILIKE '%caregiver support%'
  );

-- Reclassify ALL events from is_sensitive sources to support_group
-- (covers NA meetings with titles like "A New Beginning Group" that
-- don't match keyword patterns but come from a known support source)
UPDATE events e
SET category = 'support_group', is_sensitive = true
FROM sources s
WHERE e.source_id = s.id
  AND s.is_sensitive = true
  AND e.category != 'support_group';

-- Also catch any remaining events from is_sensitive sources that somehow
-- already have category = support_group but missing is_sensitive flag
UPDATE events e
SET is_sensitive = true
FROM sources s
WHERE e.source_id = s.id
  AND s.is_sensitive = true
  AND (e.is_sensitive IS NULL OR e.is_sensitive = false);

-- Broader keyword catch: events in any category that look like support groups
UPDATE events
SET category = 'support_group', is_sensitive = true
WHERE category NOT IN ('support_group')
  AND (
    title ILIKE '%12 step%'
    OR title ILIKE '%twelve step%'
    OR title ILIKE '%addiction recovery%'
    OR title ILIKE '%loss support%'
    OR title ILIKE '%nami %'
    OR title ILIKE '%mental health support group%'
  );

-- Update series linked to support group events
UPDATE series
SET category = 'support_group'
WHERE id IN (
  SELECT DISTINCT series_id
  FROM events
  WHERE category = 'support_group'
    AND series_id IS NOT NULL
);
