-- Clean up lingering Atlanta-core watch title noise and one stale Mercedes-Benz
-- placeholder now that official ownership exists upstream.

UPDATE events
SET
  title = 'EPL Morning Watch at Ri Ra Irish Pub Midtown',
  raw_text = regexp_replace(
    coalesce(raw_text, ''),
    'EPL Morning Watch at Ri Ra at Ri Ra Irish Pub Midtown',
    'EPL Morning Watch at Ri Ra Irish Pub Midtown',
    'g'
  ),
  updated_at = now()
WHERE source_id = 349
  AND is_active = true
  AND start_date >= current_date
  AND title = 'EPL Morning Watch at Ri Ra at Ri Ra Irish Pub Midtown';

UPDATE events
SET
  is_active = false,
  updated_at = now()
WHERE source_id = 84
  AND is_active = true
  AND title = 'Atlanta United vs. Philadelphia Union'
  AND start_date = DATE '2026-03-14';
