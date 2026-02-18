-- Move Artefacts track directly under Welcome to Atlanta and
-- retheme Monster Mansion entry to the specific artefact object.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM explore_tracks
    WHERE slug = 'artefacts-of-the-lost-city'
      AND sort_order <> 2
  ) THEN
    UPDATE explore_tracks
    SET sort_order = sort_order + 1
    WHERE sort_order >= 2
      AND slug <> 'artefacts-of-the-lost-city';

    UPDATE explore_tracks
    SET sort_order = 2
    WHERE slug = 'artefacts-of-the-lost-city';
  END IF;
END
$$;

UPDATE venues
SET
  name = 'Sheriff Billy Bob Fritter',
  short_description = 'Monster Mansion''s sheriff who protects riders from the mean swamp monsters every single day.',
  description = 'Sheriff Billy Bob Fritter is the guardian figure inside Monster Mansion at Six Flags Over Georgia. In the ride lore, he protects dumb visitors from drifting into the mean monster swamp and keeps order scene after scene, every single day of his life. Treat this artefact as the character object itself, not the park as a place.',
  image_url = 'https://lh3.googleusercontent.com/place-photos/AL8-SNGaSiqhwnGPcnjreoCE0upGDNa0Nbtg-wOqUUiJ3-aTPLzp2uzqpS2U8HITIomQIGmnNKzYvnSO9QUvonPUEaBT-FQo2OuR8IonN0Px6n-HlWFsGxVtiBTQMO_3SiDW_r0QmaGeS6ZuBr6zFA=s4800-w800'
WHERE slug = 'monster-mansion-monsters';

UPDATE explore_track_venues tv
SET editorial_blurb = 'Sheriff Billy Bob Fritter stands watch over dumb visitors drifting toward the mean monster swamp, protecting every boatload every single day of his life.'
FROM explore_tracks t, venues v
WHERE tv.track_id = t.id
  AND tv.venue_id = v.id
  AND t.slug = 'artefacts-of-the-lost-city'
  AND v.slug = 'monster-mansion-monsters';
