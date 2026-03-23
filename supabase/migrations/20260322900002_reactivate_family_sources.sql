-- Reactivate dormant family portal sources that were incorrectly deactivated.

UPDATE sources SET is_active = true
WHERE slug IN ('sky-zone-atlanta', 'gigis-playhouse-atlanta', 'decatur-recreation')
  AND is_active = false;
