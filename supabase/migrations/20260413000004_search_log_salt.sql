-- Migration: Search Log Salt
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

-- Rotating daily salt for hashing search queries in the observability log.
-- Populated by a scheduled function at 00:05 UTC; old salts retained 2 days
-- so late-arriving click events can still be joined by hash.

CREATE TABLE IF NOT EXISTS public.search_log_salt (
  day   date PRIMARY KEY,
  salt  bytea NOT NULL
);

COMMENT ON TABLE public.search_log_salt IS
  'Daily salts for hashing search queries. Rotated at 00:05 UTC. Old rows purged after 2 days.';

-- Seed today's salt so Phase 0 can ship without waiting for the cron to fire.
INSERT INTO public.search_log_salt (day, salt)
VALUES (current_date, gen_random_bytes(32))
ON CONFLICT (day) DO NOTHING;

-- Retention: auto-delete salts older than 2 days via pg_cron.
-- (Registered in a later migration; this migration is schema-only.)
