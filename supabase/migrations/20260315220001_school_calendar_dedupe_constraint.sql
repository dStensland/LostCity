-- ============================================
-- MIGRATION: Deduplicate School Calendar Events
-- ============================================
-- The seed migration may have run twice, creating duplicate rows.
-- This migration removes duplicates (keeping the oldest row per natural key)
-- and adds a unique constraint to prevent future duplicates.

-- Step 1: Remove duplicates, keeping earliest created row per natural key
DELETE FROM school_calendar_events a
USING school_calendar_events b
WHERE a.school_system = b.school_system
  AND a.name = b.name
  AND a.start_date = b.start_date
  AND a.school_year = b.school_year
  AND a.ctid > b.ctid;

-- Step 2: Add unique constraint on the natural key
CREATE UNIQUE INDEX IF NOT EXISTS idx_school_calendar_natural_key
  ON school_calendar_events (school_system, name, start_date, school_year);
