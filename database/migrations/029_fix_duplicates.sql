-- Migration: Fix duplicate events
-- Identifies and removes duplicate events, keeping the oldest as canonical

-- Step 1: Create a function to normalize titles for comparison
CREATE OR REPLACE FUNCTION normalize_event_title(title TEXT) RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(TRIM(REGEXP_REPLACE(
    REGEXP_REPLACE(title, '[^\w\s]', '', 'g'),
    '\s+', ' ', 'g'
  )));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 2: Create a function to normalize venue names (strip room suffixes)
CREATE OR REPLACE FUNCTION normalize_venue_for_dedup(venue_name TEXT) RETURNS TEXT AS $$
DECLARE
  normalized TEXT;
BEGIN
  normalized := LOWER(TRIM(venue_name));

  -- Strip Masquerade room suffixes
  IF normalized LIKE '%masquerade%' THEN
    normalized := REGEXP_REPLACE(normalized, '\s*-\s*(hell|heaven|purgatory|altar|music\s*park)$', '', 'i');
    normalized := TRIM(normalized);
  END IF;

  RETURN normalized;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 3: Add index for faster duplicate detection
CREATE INDEX IF NOT EXISTS idx_events_dedup_lookup
ON events (start_date, venue_id);

-- Step 4: Find and mark duplicates
-- A duplicate is defined as: same normalized title + same date + same venue family
-- We keep the OLDEST event as canonical

WITH venue_families AS (
  -- Group venues into families (e.g., all Masquerade rooms together)
  SELECT
    id as venue_id,
    CASE
      WHEN LOWER(name) LIKE '%masquerade%' THEN 'masquerade'
      ELSE LOWER(name)
    END as family
  FROM venues
),
event_groups AS (
  -- Group events by normalized title, date, and venue family
  SELECT
    e.id,
    e.title,
    e.start_date,
    e.venue_id,
    v.name as venue_name,
    vf.family,
    normalize_event_title(e.title) as norm_title,
    ROW_NUMBER() OVER (
      PARTITION BY normalize_event_title(e.title), e.start_date, vf.family
      ORDER BY e.created_at ASC, e.id ASC
    ) as rn,
    COUNT(*) OVER (
      PARTITION BY normalize_event_title(e.title), e.start_date, vf.family
    ) as group_count
  FROM events e
  JOIN venues v ON e.venue_id = v.id
  JOIN venue_families vf ON v.id = vf.venue_id
  WHERE e.start_date >= CURRENT_DATE
),
canonicals AS (
  -- Get the canonical (first/oldest) event for each group with duplicates
  SELECT id as canonical_id, norm_title, start_date, family
  FROM event_groups
  WHERE rn = 1 AND group_count > 1
),
duplicates AS (
  -- Get all the duplicates (not the canonical)
  SELECT eg.id as duplicate_id, c.canonical_id
  FROM event_groups eg
  JOIN canonicals c
    ON eg.norm_title = c.norm_title
    AND eg.start_date = c.start_date
    AND eg.family = c.family
  WHERE eg.rn > 1
)
-- Update duplicates to point to their canonical event
UPDATE events e
SET canonical_event_id = d.canonical_id
FROM duplicates d
WHERE e.id = d.duplicate_id;

-- Report what we found
DO $$
DECLARE
  dup_count INTEGER;
  canonical_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM events WHERE canonical_event_id IS NOT NULL;
  SELECT COUNT(DISTINCT canonical_event_id) INTO canonical_count FROM events WHERE canonical_event_id IS NOT NULL;

  RAISE NOTICE 'Marked % duplicate events pointing to % canonical events', dup_count, canonical_count;
END $$;

-- Step 5: Optional - Delete duplicates (commented out for safety)
-- Uncomment to actually delete duplicates after reviewing

-- DELETE FROM events WHERE canonical_event_id IS NOT NULL;

-- Step 6: Create a view that excludes duplicates
CREATE OR REPLACE VIEW events_deduplicated AS
SELECT * FROM events WHERE canonical_event_id IS NULL;

-- Step 7: Update the content_hash for Masquerade events using current normalization
-- This ensures future dedup checks work correctly
UPDATE events e
SET content_hash = MD5(
  normalize_event_title(e.title) || '|' ||
  normalize_venue_for_dedup(v.name) || '|' ||
  e.start_date::text
)
FROM venues v
WHERE e.venue_id = v.id
AND LOWER(v.name) LIKE '%masquerade%';

ANALYZE events;
