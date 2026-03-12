-- Keep Hooky's family sports handoff high-signal by deactivating the
-- empty cheer/gymnastics channel until its refresh/materialization path
-- is behaving cleanly.

UPDATE interest_channels ic
SET is_active = false,
    updated_at = now()
FROM portals p
WHERE p.id = ic.portal_id
  AND p.slug = 'hooky'
  AND ic.slug = 'hooky-cheer-gymnastics'
  AND NOT EXISTS (
    SELECT 1
    FROM event_channel_matches m
    WHERE m.channel_id = ic.id
      AND m.portal_id = p.id
  );
