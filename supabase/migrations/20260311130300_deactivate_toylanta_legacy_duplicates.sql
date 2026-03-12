-- ============================================
-- MIGRATION 20260311130300: Deactivate Toylanta Legacy Duplicates
-- ============================================
-- Retires low-quality and duplicate Toylanta rows from older extraction paths.

UPDATE events
SET is_active = false
WHERE source_id = 715
  AND id IN (
    21977,
    22366,
    22368,
    22369,
    22370,
    22371,
    22372,
    22373,
    22374,
    68202,
    68205,
    66823,
    77175,
    77196,
    77197,
    77198,
    81061,
    81062,
    83576,
    83577,
    83578,
    107817,
    107820,
    107822,
    107824
  );
