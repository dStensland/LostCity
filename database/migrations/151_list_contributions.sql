-- Add allow_contributions column to lists table
-- When true, any authenticated user can add items to the list
ALTER TABLE lists ADD COLUMN IF NOT EXISTS allow_contributions BOOLEAN DEFAULT false;

-- Update RLS policy on list_items to allow inserts when the parent list has allow_contributions = true
-- Drop existing insert policy if it exists, then create a new one
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'list_items_insert_policy' AND tablename = 'list_items') THEN
    DROP POLICY list_items_insert_policy ON list_items;
  END IF;
END $$;

CREATE POLICY list_items_insert_policy ON list_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_items.list_id
        AND lists.status = 'active'
        AND (
          lists.creator_id = auth.uid()
          OR lists.allow_contributions = true
        )
    )
  );
