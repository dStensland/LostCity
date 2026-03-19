-- Migration 527: Deactivate obviously stale programs
-- Programs with an explicit session_end more than 30 days in the past
-- and still marked active are stale data. Mark them inactive so they
-- don't appear as "Open" to parents.
--
-- This is a one-time cleanup. The programs API already gates on
-- session_end when active=true is passed, but deactivating at the DB
-- level is cleaner and avoids relying on callers to pass the flag.

UPDATE programs
SET status = 'inactive'
WHERE session_end IS NOT NULL
  AND session_end < CURRENT_DATE - INTERVAL '30 days'
  AND status = 'active';
