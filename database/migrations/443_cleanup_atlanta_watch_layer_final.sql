-- Remove malformed duplicate Ri Ra recurring watch rows and normalize
-- Der Biergarten soccer-watch tags after the final Atlanta watch-layer sweep.

UPDATE events
SET is_active = FALSE,
    updated_at = NOW()
WHERE is_active = TRUE
  AND start_date >= CURRENT_DATE
  AND source_id = (SELECT id FROM sources WHERE slug = 'atlanta-recurring-social')
  AND title = 'EPL Morning Watch at Ri Ra at Ri Ra Irish Pub Midtown';

UPDATE events
SET tags = ARRAY['sports', 'watch-party', 'viewing-party', 'soccer', 'weekly'],
    updated_at = NOW()
WHERE is_active = TRUE
  AND start_date >= CURRENT_DATE
  AND source_id = (SELECT id FROM sources WHERE slug = 'atlanta-recurring-social')
  AND title = 'Soccer Saturday at Der Biergarten';
