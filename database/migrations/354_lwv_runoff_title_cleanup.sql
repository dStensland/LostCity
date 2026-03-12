-- MIGRATION 354: Clean up LWV runoff title typo duplicate
-- Root cause is fixed in the crawler; this repairs the already-ingested
-- duplicate pair so HelpATL doesn't carry both typo and corrected rows.

DO $$
DECLARE
  lwv_source_id INTEGER;
  canonical_row_id INTEGER;
BEGIN
  SELECT id
  INTO lwv_source_id
  FROM sources
  WHERE slug = 'lwv-atlanta'
  LIMIT 1;

  IF lwv_source_id IS NULL THEN
    RAISE NOTICE 'lwv-atlanta source not found; skipping runoff cleanup';
    RETURN;
  END IF;

  SELECT id
  INTO canonical_row_id
  FROM events
  WHERE source_id = lwv_source_id
    AND start_date = '2026-06-16'
    AND source_url ILIKE '%general-primary-electionnonpartisan-election-1%'
  ORDER BY id ASC
  LIMIT 1;

  IF canonical_row_id IS NULL THEN
    RAISE NOTICE 'No LWV runoff row found for cleanup';
    RETURN;
  END IF;

  UPDATE events
  SET title = 'General Primary Election/Nonpartisan Runoff',
      content_hash = '27715f1df3f2046fe23707889f7d639e',
      is_active = true
  WHERE id = canonical_row_id;

  UPDATE events
  SET is_active = false
  WHERE source_id = lwv_source_id
    AND start_date = '2026-06-16'
    AND source_url ILIKE '%general-primary-electionnonpartisan-election-1%'
    AND id <> canonical_row_id;
END $$;
