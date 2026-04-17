-- Clean legacy age_min=0, age_max=0 values
-- These came from ACTIVENet sources before normalization was added.
-- age_min=0 AND age_max=0 means "no age restriction" not "infant",
-- so the correct representation is NULL/NULL.

UPDATE events
SET age_min = NULL, age_max = NULL
WHERE age_min = 0 AND age_max = 0;
