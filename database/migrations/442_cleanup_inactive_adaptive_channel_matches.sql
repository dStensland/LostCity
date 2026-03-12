-- Remove stale materialized matches for the inactive Atlanta adaptive
-- recreation channel.

DELETE FROM event_channel_matches
WHERE portal_id = (SELECT id FROM portals WHERE slug = 'atlanta')
  AND channel_id = (
    SELECT id
    FROM interest_channels
    WHERE portal_id = (SELECT id FROM portals WHERE slug = 'atlanta')
      AND slug = 'atlanta-adaptive-recreation'
    LIMIT 1
  );
