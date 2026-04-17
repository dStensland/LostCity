-- ─── Editorial blurbs on film titles ─────────────────────────────────────────
-- One-line CM-written descriptions; reused across all runs of each film.

UPDATE screening_titles SET
  editorial_blurb =
    'A feral, tender coming-of-age debut about a Brooklyn streamer and the voice on the other side of the paywall.',
  film_press_quote = '"A feral, tender debut."',
  film_press_source = 'Little White Lies',
  is_premiere = TRUE,
  premiere_scope = 'atl'
WHERE lower(canonical_title) = 'bunnylovr';

UPDATE screening_titles SET
  editorial_blurb =
    'Japanese survival horror in a subway passage that will not let you leave.'
WHERE lower(canonical_title) = 'exit 8';

UPDATE screening_titles SET
  editorial_blurb =
    'Ducournau''s latest — corporal, mythic, not remotely normal.',
  film_press_quote = '"A relentless fever dream."',
  film_press_source = 'IndieWire'
WHERE lower(canonical_title) = 'normal';

UPDATE screening_titles SET
  editorial_blurb =
    'Cassavetes'' bruised marriage study — improvised, smoke-stained, unshakeable.',
  film_press_quote = '"The marriage movie to end all marriage movies."',
  film_press_source = 'Metrograph Journal'
WHERE lower(canonical_title) = 'faces';

UPDATE screening_titles SET
  editorial_blurb =
    'Chris Smith''s backstage portrait of Lorne Michaels — fewer laughs than you''d expect, more weight.'
WHERE lower(canonical_title) = 'lorne';

UPDATE screening_titles SET
  editorial_blurb =
    'Jacir''s mandate-era epic, three decades in the making. The Palestine submission for Best International Feature.'
WHERE lower(canonical_title) = 'palestine ''36';

-- ─── Curator picks for the current ISO week ─────────────────────────────────

DO $$
DECLARE
  v_week_monday DATE := date_trunc('week', CURRENT_DATE)::date;
BEGIN
  UPDATE screening_runs r
  SET is_curator_pick = TRUE,
      curator_pick_week = v_week_monday
  FROM screening_titles t, places p
  WHERE r.screening_title_id = t.id
    AND r.place_id = p.id
    AND lower(t.canonical_title) = 'bunnylovr'
    AND p.slug = 'plaza-theatre'
    AND r.start_date <= v_week_monday + INTERVAL '6 days'
    AND r.end_date >= v_week_monday;

  UPDATE screening_runs r
  SET is_curator_pick = TRUE,
      curator_pick_week = v_week_monday
  FROM screening_titles t, places p
  WHERE r.screening_title_id = t.id
    AND r.place_id = p.id
    AND lower(t.canonical_title) = 'faces'
    AND p.slug = 'tara-theatre'
    AND r.start_date <= v_week_monday + INTERVAL '6 days'
    AND r.end_date >= v_week_monday;

  UPDATE screening_runs r
  SET is_curator_pick = TRUE,
      curator_pick_week = v_week_monday
  FROM screening_titles t, places p
  WHERE r.screening_title_id = t.id
    AND r.place_id = p.id
    AND lower(t.canonical_title) = 'normal'
    AND p.slug = 'starlight-six-drive-in'
    AND r.start_date <= v_week_monday + INTERVAL '6 days'
    AND r.end_date >= v_week_monday;

  RAISE NOTICE 'Film curator picks seeded for week starting %', v_week_monday;
END $$;
