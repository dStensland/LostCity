-- 1. Deactivate orphaned Nashville events from deactivated sources.
-- These 292 events persist from when ticketmaster-nashville etc. were active.
UPDATE events SET is_active = false
WHERE source_id IN (
    SELECT id FROM sources
    WHERE slug IN ('ticketmaster-nashville', 'eventbrite-nashville',
                   'third-and-lindsley', 'basement-east', 'brooklyn-bowl-nashville',
                   'schermerhorn', 'ryman-auditorium', 'marathon-music-works')
    AND is_active = false
)
AND is_active = true;

-- 2. Fix The Earl: bar → music_venue.
-- Established Atlanta music venue, should always appear in music tab.
UPDATE places SET place_type = 'music_venue'
WHERE slug = 'the-earl' AND place_type = 'bar';
