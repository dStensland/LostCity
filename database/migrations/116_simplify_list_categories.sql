-- Simplify list categories - remove the constraint, just use free-form text
-- The predefined categories added unnecessary complexity

ALTER TABLE lists DROP CONSTRAINT IF EXISTS lists_category_check;

-- Drop the category index since it's no longer a constrained field
DROP INDEX IF EXISTS idx_lists_category;
