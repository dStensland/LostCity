-- Fix NULL owner_portal_id on Atlanta sources
-- Events inherit portal from source, so fixing sources fixes future events
-- Also backfill existing events
-- Note: sources table has no city column, so we target by explicit ID list
-- (23 sources identified via venue city join)

UPDATE sources SET owner_portal_id = (SELECT id FROM portals WHERE slug = 'atlanta' LIMIT 1)
WHERE owner_portal_id IS NULL AND is_active = true
AND id IN (
  1733, 1734, 1752, 1747, 1109, 1746, 1751, 1749, 1761, 1085, 1111, 1115,
  1100, 1748, 1742, 1753, 1754, 827, 1744, 1760, 1750, 1743, 1755
);

UPDATE events e SET portal_id = s.owner_portal_id
FROM sources s
WHERE e.source_id = s.id AND e.portal_id IS NULL AND s.owner_portal_id IS NOT NULL;
