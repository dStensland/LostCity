-- Tier buckets for movie log: custom color-coded rank groups
-- When tier_name is set on an entry, it starts a new tier group.
-- All subsequent entries inherit that tier until the next tier_name.
ALTER TABLE goblin_log_entries ADD COLUMN IF NOT EXISTS tier_name text;
ALTER TABLE goblin_log_entries ADD COLUMN IF NOT EXISTS tier_color text;
