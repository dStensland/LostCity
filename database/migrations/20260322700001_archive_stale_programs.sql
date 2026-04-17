-- Archive programs that have clearly ended.
-- Programs with session_end in the past are definitively over.
-- Programs with session_start in the past and no session_end for >60 days
-- are likely stale (rolling enrollment should be re-crawled, not left indefinitely).
-- CHECK constraint only allows: 'active', 'draft', 'archived'.

-- Phase 1: Archive definitively ended programs
UPDATE programs
SET status = 'archived'
WHERE status = 'active'
  AND session_end IS NOT NULL
  AND session_end < CURRENT_DATE;

-- Phase 2: Archive programs with no end date that started > 60 days ago
UPDATE programs
SET status = 'archived'
WHERE status = 'active'
  AND session_end IS NULL
  AND session_start IS NOT NULL
  AND session_start < CURRENT_DATE - INTERVAL '60 days';
