-- Adventure portal source cleanup
-- Removes non-outdoor sources from portal_source_access for the yonder/adventure portal
-- Portal ID: d25f949d-4b58-4171-8dac-0007e41eb389

-- Source 1085: League of Women Voters (civic content)
-- Source 1109: BronzeLens Film Festival (arts content)
-- Source 1111: Piedmont Park Arts Festival (arts content)
-- Source 1115: Taste of Soul Atlanta (food festival, stale)

DELETE FROM portal_source_access
WHERE portal_id = 'd25f949d-4b58-4171-8dac-0007e41eb389'
  AND source_id IN (1085, 1109, 1111, 1115);
