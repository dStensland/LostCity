-- Goblin Day: connect log entries to lists so users can group their log by
-- project / marathon (Sword & Sorcery, Mission Impossible, Goblin Day, etc.).
--
-- list_id reuses the existing goblin_lists primitive (which already backs the
-- watchlist groups). A log entry belongs to at most one list; cross-cutting
-- classification stays on tags. ON DELETE SET NULL — deleting a list doesn't
-- delete the watched-movie records, just detaches them.
--
-- Keep this file mirrored in database/migrations and supabase/migrations.

ALTER TABLE goblin_log_entries
  ADD COLUMN IF NOT EXISTS list_id INTEGER
    REFERENCES goblin_lists(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_goblin_log_entries_list
  ON goblin_log_entries (list_id)
  WHERE list_id IS NOT NULL;
