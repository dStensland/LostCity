-- Deactivate Ticketmaster non-event sports upsell rows after upstream title filtering.

UPDATE events
SET is_active = FALSE,
    updated_at = NOW()
WHERE is_active = TRUE
  AND source_id = (SELECT id FROM sources WHERE slug = 'ticketmaster')
  AND title IN (
    '2026 Group Deposits',
    'Harlem Globetrotters 100 Year Tour Souvenir Ticket',
    'Limited Edition 100 Year Golden Replica Game Ball by Spalding®'
  );
