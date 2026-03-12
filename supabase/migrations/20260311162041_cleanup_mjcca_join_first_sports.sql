-- Remove join-first MJCCA sports inventory from the public event surface.
-- These rows are leagues and registered programs, not open public events.

UPDATE events
SET
  is_active = false,
  updated_at = now()
WHERE source_id = 570
  AND is_active = true
  AND start_date >= current_date
  AND (
    title IN (
      'Young Professionals Basketball League',
      'Men’s Soccer League',
      'Women’s Soccer League',
      'Adult Women’s Basketball League',
      'ALTA Pickleball',
      'Debra “Debbie” Sonenshine SOAR Pickleball'
    )
    OR title LIKE 'Shooting Stars Soccer%'
    OR title LIKE 'Elite Soccer Skills Training%'
    OR title LIKE '%Flag Football League%'
    OR title LIKE '%Youth Soccer League%'
    OR title LIKE '%Slow Pitch Softball League%'
  );
