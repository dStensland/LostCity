-- 497_event_extractions_table.sql
-- Move write-once/read-never extraction metadata off the hot events table.
-- Phase C of the data schema improvement plan.

-- Step 1: Create the extraction metadata table
CREATE TABLE IF NOT EXISTS event_extractions (
  event_id INTEGER PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  raw_text TEXT,
  extraction_confidence DECIMAL(3, 2),
  field_provenance JSONB,
  field_confidence JSONB,
  extraction_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Step 2: Copy existing data from events into the new table
INSERT INTO event_extractions (event_id, raw_text, extraction_confidence, field_provenance, field_confidence, extraction_version)
SELECT id, raw_text, extraction_confidence, field_provenance, field_confidence, extraction_version
FROM events
WHERE raw_text IS NOT NULL
   OR field_provenance IS NOT NULL
   OR field_confidence IS NOT NULL
   OR extraction_confidence IS NOT NULL
   OR extraction_version IS NOT NULL
ON CONFLICT (event_id) DO NOTHING;

-- Note: Column drops from the events table are DEFERRED to a follow-up migration
-- after 1 week to confirm everything works. Do NOT drop columns here.
