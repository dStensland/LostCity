-- Migration 532: Deactivate stale N.H. Scott 2021-2022 program
-- This program has session_start=2021-08-28 and a fabricated session_end=2027-10-30
-- that bypasses temporal gates. The title itself encodes the school year (2021-2022)
-- confirming it is stale data.

UPDATE programs
SET status = 'inactive'
WHERE name ILIKE '%2021%2022%'
  AND session_start < '2022-01-01'
  AND status = 'active';

-- DOWN: no restore — these programs are genuinely stale
