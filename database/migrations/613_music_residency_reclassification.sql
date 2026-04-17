-- Reclassify top Atlanta weekly music series as residencies.
-- Series type becomes 'residency'; description seeded with editorial blurb.
-- Per spec §2 + Revisions R5 (slug-based matching) + R6 (6-7 target, not 10).

-- First: extend the series_type check constraint to allow 'residency'.
ALTER TABLE series DROP CONSTRAINT IF EXISTS series_series_type_check;
ALTER TABLE series ADD CONSTRAINT series_series_type_check
  CHECK (series_type = ANY (ARRAY[
    'film'::text, 'recurring_show'::text, 'class_series'::text,
    'festival_program'::text, 'tour'::text, 'other'::text, 'residency'::text
  ]));

UPDATE series
SET series_type = 'residency',
    description = 'A Northside institution. Sunday-night blues in the last of Atlanta''s juke joints — cheap beer, no cover, raw sound.'
WHERE slug = 'sunday-blues-at-northside-tavern';

UPDATE series
SET series_type = 'residency',
    description = 'Saturday blues at Northside. The house band earned its place; the room earned its reputation.'
WHERE slug = 'live-blues-saturday-at-northside-tavern';

UPDATE series
SET series_type = 'residency',
    description = 'Monday Blues Jam — every bluesman in Atlanta cycles through. Sign up, get on stage, play one.'
WHERE slug = 'monday-blues-jam-at-northside-tavern';

UPDATE series
SET series_type = 'residency',
    description = 'Live Latin band plus DJ in the Eclipse courtyard. Tapas, salsa, crowd that shows up to dance.'
WHERE slug = 'live-latin-band-dj-at-eclipse-di-luna';

UPDATE series
SET series_type = 'residency',
    description = 'Two pianos, two players, zero set list. Audience shouts requests; whoever plays it first wins.'
WHERE slug = 'dueling-pianos-at-park-bench-battery';

UPDATE series
SET series_type = 'residency',
    description = 'Thursday jazz at Side Saddle — small room, tight trio, serious listeners.'
WHERE slug = 'thursday-jazz-night';

UPDATE series
SET series_type = 'residency',
    description = 'Sunday jazz brunch at Side Saddle. Daytime quiet, nighttime fidelity.'
WHERE slug = 'sunday-jazz-brunch';

-- Partial index to make music-residency queries fast.
CREATE INDEX IF NOT EXISTS idx_series_residency_music
  ON series (category, day_of_week)
  WHERE series_type = 'residency' AND is_active = true;
