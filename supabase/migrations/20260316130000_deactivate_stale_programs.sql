-- Migration: Deactivate obviously stale programs
-- Programs with an explicit session_end more than 30 days in the past
-- and still marked active are stale data. Mark them inactive so they
-- don't appear as "Open" to parents.

-- Note: programs.status CHECK constraint allows: 'active', 'draft', 'archived'
-- 'inactive' is NOT a valid value -- use 'archived' for programs that are done.
UPDATE programs
SET status = 'archived'
WHERE session_end IS NOT NULL
  AND session_end < CURRENT_DATE - INTERVAL '30 days'
  AND status = 'active';
