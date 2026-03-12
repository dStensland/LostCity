-- Reactivate Hooky's cheer/gymnastics channel now that the final
-- title-term rule is in place and the materialization path is ready.

UPDATE interest_channels ic
SET is_active = true,
    updated_at = now()
FROM portals p
WHERE p.id = ic.portal_id
  AND p.slug = 'hooky'
  AND ic.slug = 'hooky-cheer-gymnastics';
