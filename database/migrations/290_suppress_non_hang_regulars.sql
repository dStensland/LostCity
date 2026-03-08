-- Migration 290: Suppress non-hang events from Regulars
-- These events pass is_regular_ready but are NOT public social hangs:
-- library programs, tax assistance, religious practice, civic meetings, volunteer shifts.
-- Fix: set is_regular_ready = false so they don't appear in the Regulars tab.

-- Source 43: Library system (kids storytime, tax help, tutoring, classes)
UPDATE events
SET is_regular_ready = false, updated_at = NOW()
WHERE source_id = 43
  AND is_regular_ready = true
  AND (
    title ILIKE '%storytime%'
    OR title ILIKE '%crafty kids%'
    OR title ILIKE '%AARP%'
    OR title ILIKE '%tutoring%'
    OR title ILIKE '%spanish class%'
    OR title ILIKE '%book sale%'
    OR title ILIKE '%digital arts%'
    OR title ILIKE '%teen-tween%'
    OR title ILIKE '%storybook time%'
  );

-- Source 787: Buddhist center (religious practice, not social hangs)
UPDATE events
SET is_regular_ready = false, updated_at = NOW()
WHERE source_id = 787
  AND is_regular_ready = true
  AND (
    title ILIKE '%vajrasattva%'
    OR title ILIKE '%medicine buddha%'
    OR title ILIKE '%practice%'
  );

-- Source 435: Neighborhood association meetings
UPDATE events
SET is_regular_ready = false, updated_at = NOW()
WHERE source_id = 435
  AND is_regular_ready = true
  AND title ILIKE '%community meeting%';

-- Source 1070: Volunteer workdays
UPDATE events
SET is_regular_ready = false, updated_at = NOW()
WHERE source_id = 1070
  AND is_regular_ready = true
  AND title ILIKE '%volunteer%';

-- Source 433: Civic community days
UPDATE events
SET is_regular_ready = false, updated_at = NOW()
WHERE source_id = 433
  AND is_regular_ready = true
  AND title ILIKE '%community day%';
