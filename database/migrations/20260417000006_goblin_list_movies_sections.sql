-- Goblin Day: add lightweight per-list section support to goblin_list_movies.
--
-- Sections are free-form strings attached to list entries, with a per-section
-- sort order. No separate sections table — if an entry has section = 'Canonical
-- 80s' and another has section = NULL, the UI renders a 'Canonical 80s' group
-- and an 'Unsorted' group. Cheapest path that covers the grouping need; a
-- sections table can replace the text column later without data loss
-- (FK backfill from distinct values).
--
-- Keep this file mirrored in database/migrations and supabase/migrations.

ALTER TABLE goblin_list_movies
  ADD COLUMN IF NOT EXISTS section TEXT,
  ADD COLUMN IF NOT EXISTS section_sort INTEGER;

CREATE INDEX IF NOT EXISTS idx_goblin_list_movies_list_section
  ON goblin_list_movies (list_id, section, section_sort);
