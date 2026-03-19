-- Repair stale Family attribution after the Hooky -> atlanta-families ownership move.
-- The ownership migration ran, but some later writes/backfills left Family-owned
-- events/programs stamped with the retired Hooky portal. The Family programs API
-- reads canonical program rows by portal_id, so these stale rows are hidden.

DO $$
DECLARE
  atlanta_families_id UUID;
BEGIN
  SELECT id
  INTO atlanta_families_id
  FROM portals
  WHERE slug = 'atlanta-families';

  IF atlanta_families_id IS NULL THEN
    RAISE EXCEPTION 'atlanta-families portal not found';
  END IF;

  UPDATE portals
  SET name = 'Lost City: Family'
  WHERE id = atlanta_families_id
    AND name IS DISTINCT FROM 'Lost City: Family';

  UPDATE events AS e
  SET portal_id = atlanta_families_id
  FROM sources AS s
  WHERE e.source_id = s.id
    AND s.owner_portal_id = atlanta_families_id
    AND e.portal_id IS DISTINCT FROM atlanta_families_id;

  UPDATE programs AS p
  SET portal_id = atlanta_families_id
  FROM sources AS s
  WHERE p.source_id = s.id
    AND s.owner_portal_id = atlanta_families_id
    AND p.portal_id IS DISTINCT FROM atlanta_families_id;
END $$;
