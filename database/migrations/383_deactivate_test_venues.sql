-- Deactivate test/duplicate venue records and reassign their events
-- to the canonical venue IDs.

-- Fox Theatre test (369) → canonical Fox Theatre (119)
UPDATE events SET venue_id = 119 WHERE venue_id = 369;
UPDATE venues SET active = FALSE WHERE id = 369;

-- Clear canonical_event_id references to duplicates before deleting
UPDATE events SET canonical_event_id = NULL WHERE canonical_event_id IN (56306, 56380, 5758, 56424);

-- Delete 4 Masquerade events that already exist on canonical venue 128
-- (same source_id, date, time, normalized title → unique constraint conflict)
DELETE FROM events WHERE id IN (56306, 56380, 5758, 56424);

-- Masquerade test (364) → canonical Masquerade (128)
UPDATE events SET venue_id = 128 WHERE venue_id = 364;
UPDATE venues SET active = FALSE WHERE id = 364;
