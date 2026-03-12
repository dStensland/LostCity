-- Migration: Yonder editorial source keys
--
-- Extend editorial_mentions source_key allowlist for Yonder artifact and
-- guide references. Keep mirrored in database/schema.sql and database/migrations.

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
      'explore_georgia'
    )
  );
