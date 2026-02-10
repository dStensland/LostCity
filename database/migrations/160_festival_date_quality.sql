-- 160_festival_date_quality.sql
-- Add date quality tracking columns, backfill existing data,
-- move month-mismatched dates to pending, deactivate duplicate sources.

-- 1. Add new columns
ALTER TABLE festivals
  ADD COLUMN IF NOT EXISTS pending_start DATE,
  ADD COLUMN IF NOT EXISTS pending_end DATE,
  ADD COLUMN IF NOT EXISTS date_confidence SMALLINT,
  ADD COLUMN IF NOT EXISTS date_source TEXT;

-- 2. Backfill existing announced dates as 'migration' source with 80 confidence
UPDATE festivals
SET date_source = 'migration',
    date_confidence = 80
WHERE announced_start IS NOT NULL
  AND date_source IS NULL;

-- 3. Move month-mismatched dates to pending
-- (announced month doesn't match typical_month, off by more than 1)
UPDATE festivals
SET pending_start = announced_start,
    pending_end = announced_end,
    announced_start = NULL,
    announced_end = NULL,
    date_confidence = 30,
    date_source = 'migration-suspect'
WHERE announced_start IS NOT NULL
  AND typical_month IS NOT NULL
  AND ABS(EXTRACT(MONTH FROM announced_start) - typical_month) > 1
  AND ABS(EXTRACT(MONTH FROM announced_start) - typical_month) < 11;
  -- < 11 handles Dec/Jan wraparound (diff=11 means 1 month apart)

-- 4. Deactivate festival sources that share URLs with active venue crawlers
UPDATE sources
SET is_active = false
WHERE id IN (
    SELECT fs.id
    FROM sources fs
    JOIN sources vs ON fs.url = vs.url AND fs.id != vs.id
    WHERE vs.is_active = true
      AND fs.source_type = 'website'
      AND (fs.integration_method IS NULL OR fs.integration_method = 'llm')
);
