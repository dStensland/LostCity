-- Fix venue_type misclassifications: nightclub applied too broadly
-- Root cause: LLM classifier bias + backfill logic that never overrides non-NULL venue_type

-- Bars misclassified as nightclub
UPDATE venues SET venue_type = 'bar'
WHERE id IN (914, 825, 2062)
  AND venue_type = 'nightclub';

-- Music venues misclassified as nightclub
UPDATE venues SET venue_type = 'music_venue'
WHERE id IN (322, 2128, 417)
  AND venue_type = 'nightclub';

-- Dance studios misclassified as nightclub
UPDATE venues SET venue_type = 'fitness'
WHERE id IN (449, 448, 447, 956)
  AND venue_type = 'nightclub';

-- Other misclassifications
UPDATE venues SET venue_type = 'organization' WHERE id = 456 AND venue_type = 'nightclub';
UPDATE venues SET venue_type = 'restaurant'   WHERE id = 2042 AND venue_type = 'nightclub';
UPDATE venues SET venue_type = 'event_space'  WHERE id = 431 AND venue_type = 'nightclub';
