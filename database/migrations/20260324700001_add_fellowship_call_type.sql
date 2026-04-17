-- Add 'fellowship' as a valid call_type for open_calls.
-- Fellowships are a distinct category from grants (nomination-based, typically
-- longer-term, often tied to a specific institution). Several crawlers
-- (TransArtists, EntryThingy, South Arts, USA Fellowships) naturally
-- produce fellowship-typed records.

ALTER TABLE open_calls DROP CONSTRAINT IF EXISTS open_calls_call_type_check;
ALTER TABLE open_calls ADD CONSTRAINT open_calls_call_type_check
  CHECK (call_type IN ('submission','residency','grant','commission','exhibition_proposal','fellowship'));
