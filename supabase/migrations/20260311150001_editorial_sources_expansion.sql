-- Migration: Editorial Sources Expansion
--
-- Expand editorial_mentions source_key CHECK constraint to include new sources:
-- Atlanta Magazine, Thrillist, What Now Atlanta, Axios Atlanta, ATL Bucket List.
-- Keep this file mirrored in database/migrations and supabase/migrations.

-- Drop the existing constraint
ALTER TABLE editorial_mentions
  DROP CONSTRAINT IF EXISTS editorial_mentions_source_key_check;

-- Re-create with expanded list
ALTER TABLE editorial_mentions
  ADD CONSTRAINT editorial_mentions_source_key_check CHECK (
    source_key IN (
      'eater_atlanta',
      'infatuation_atlanta',
      'rough_draft_atlanta',
      'atlanta_eats',
      'atlanta_magazine',
      'thrillist_atlanta',
      'whatnow_atlanta',
      'axios_atlanta',
      'atl_bucket_list'
    )
  );
