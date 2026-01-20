-- Disable non-viable sources discovered during site investigation
-- These sites either have no event data, are parked domains, have DNS issues, or have no upcoming events

-- Domain for sale (parked)
UPDATE sources SET is_active = false WHERE slug = 'ballroom-impact';

-- Domain not connected to website
UPDATE sources SET is_active = false WHERE slug = 'mason-fine-art';

-- No upcoming events listed
UPDATE sources SET is_active = false WHERE slug = 'dancing4fun';

-- No event calendar available
UPDATE sources SET is_active = false WHERE slug = 'academy-ballroom';

-- DNS errors (domains don't resolve)
UPDATE sources SET is_active = false WHERE slug = 'working-title-playwrights';
UPDATE sources SET is_active = false WHERE slug = 'pinch-n-ouch-theatre';
UPDATE sources SET is_active = false WHERE slug = 'ptc-running-club';
UPDATE sources SET is_active = false WHERE slug = 'monday-night-run-club';

-- No events page (404 or empty)
UPDATE sources SET is_active = false WHERE slug = 'cherry-street-brewing';
UPDATE sources SET is_active = false WHERE slug = 'fire-maker-brewing';
UPDATE sources SET is_active = false WHERE slug = 'compound-atlanta';
UPDATE sources SET is_active = false WHERE slug = 'poem88-gallery';

-- Also disable dance studios with no calendars/classes
UPDATE sources SET is_active = false WHERE slug = 'atlanta-dance-ballroom';
UPDATE sources SET is_active = false WHERE slug = 'arthur-murray-atlanta';
