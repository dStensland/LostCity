ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_ticket_status_check;

ALTER TABLE events
  ADD CONSTRAINT events_ticket_status_check
  CHECK (
    ticket_status IS NULL
    OR ticket_status IN ('cancelled', 'sold-out', 'low-tickets', 'free', 'tickets-available')
  );
