-- Migration: Add editorial source keys for arts/attractions publications
--
-- ArtsATL, Secret Atlanta, Secret Nashville, Atlanta Parent — non-food
-- editorial sources that cover museums, theaters, attractions, and experiences.
-- Keep this file mirrored in database/migrations and supabase/migrations.

ALTER TABLE editorial_mentions
  DROP CONSTRAINT IF EXISTS editorial_mentions_source_key_check;

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
      'atl_bucket_list',
      'atlas_obscura',
      'atlanta_trails',
      'explore_georgia',
      'artsatl',
      'secret_atlanta',
      'secret_nashville',
      'atlanta_parent'
    )
  );
