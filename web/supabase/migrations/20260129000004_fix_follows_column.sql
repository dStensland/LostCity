-- Migration: Fix follows table column data
-- Copy data from old followed_org_id to followed_organization_id

-- Copy any data from followed_org_id to followed_organization_id where the new column is null
UPDATE follows
SET followed_organization_id = followed_org_id
WHERE followed_org_id IS NOT NULL
  AND followed_organization_id IS NULL;

-- After this migration, followed_org_id can be dropped in a future migration
-- ALTER TABLE follows DROP COLUMN IF EXISTS followed_org_id;
