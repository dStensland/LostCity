-- ============================================================
-- MIGRATION 420: Cleanup Ticketmaster Atlanta Sports Noise
-- ============================================================

UPDATE events
SET is_active = false,
    updated_at = NOW()
WHERE is_active = true
  AND source_id = (
    SELECT id
    FROM sources
    WHERE slug = 'ticketmaster'
    LIMIT 1
  )
  AND title IN (
    'Delta Sky 360 Club Experience - New Edition',
    'DELTA SKY 360 CLUB EXPERIENCE - New Edition',
    'New Edition',
    'MANA',
    'We Them Ones',
    'Boys 4 Life Tour'
  )
  AND start_date IN (
    DATE '2026-03-29',
    DATE '2026-04-01',
    DATE '2026-04-03',
    DATE '2026-04-05',
    DATE '2026-04-09'
  );
