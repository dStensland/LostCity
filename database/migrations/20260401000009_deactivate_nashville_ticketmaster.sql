-- Deactivate ticketmaster-nashville — 111 Nashville events leaking into Atlanta
-- portal queries via federation. No active Nashville portal to serve this data.
-- Re-enable when Nashville portal launches.

UPDATE sources SET is_active = false
WHERE slug IN ('ticketmaster-nashville', 'eventbrite-nashville');
