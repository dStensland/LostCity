-- Migration: Create dedicated crawler DB role with minimal permissions
-- Purpose: Replace service_role key usage with a scoped role for crawlers
--
-- IMPORTANT: This file is NOT auto-applied.
-- Steps to apply:
--   1. Review this script carefully, then run it via psql or the Supabase SQL editor.
--   2. After the role exists, create a Supabase database user (not a service_role key)
--      that logs in with this role:
--        CREATE USER crawler_writer_user WITH PASSWORD '<strong-password>' IN ROLE crawler_writer;
--      Alternatively, use a Supabase "custom claims" JWT or a Postgres connection string
--      for the crawler process; the exact mechanism depends on how you connect.
--   3. Generate an API key (or direct DB connection string) scoped to this user and
--      add it to the crawler environment:
--        SUPABASE_CRAWLER_KEY=<new-key-here>
--   4. Update crawlers/db.py to read SUPABASE_CRAWLER_KEY instead of SUPABASE_SERVICE_ROLE_KEY.
--   5. Rotate (revoke) the old service_role key from the crawler environment once confirmed.
--
-- To rollback:
--   DROP ROLE IF EXISTS crawler_writer;
--   -- Also drop the login user created in step 2.

-- ---------------------------------------------------------------------------
-- Create the crawler role (no login — attach to a login user separately)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'crawler_writer') THEN
        CREATE ROLE crawler_writer NOLOGIN;
    END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Schema access
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO crawler_writer;

-- ---------------------------------------------------------------------------
-- Read access across all tables
-- Crawlers read from many tables for deduplication, venue lookup, source
-- config, etc. Broad SELECT is intentional and least-surprising here.
-- ---------------------------------------------------------------------------
GRANT SELECT ON ALL TABLES IN SCHEMA public TO crawler_writer;

-- ---------------------------------------------------------------------------
-- Write access — only the tables the crawler pipeline touches
-- ---------------------------------------------------------------------------
GRANT INSERT, UPDATE ON TABLE public.events TO crawler_writer;
GRANT INSERT, UPDATE ON TABLE public.venues TO crawler_writer;
GRANT INSERT, UPDATE ON TABLE public.series TO crawler_writer;
GRANT INSERT, UPDATE ON TABLE public.event_artists TO crawler_writer;
GRANT INSERT, UPDATE ON TABLE public.crawl_logs TO crawler_writer;
GRANT INSERT, UPDATE ON TABLE public.venue_features TO crawler_writer;
GRANT INSERT, UPDATE ON TABLE public.event_images TO crawler_writer;
GRANT INSERT, UPDATE ON TABLE public.event_links TO crawler_writer;
GRANT INSERT, UPDATE ON TABLE public.sources TO crawler_writer;

-- ---------------------------------------------------------------------------
-- Sequence access (required for INSERT on tables with serial/bigserial PKs)
-- ---------------------------------------------------------------------------
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO crawler_writer;

-- ---------------------------------------------------------------------------
-- Default privileges for future tables/sequences created in this schema.
-- New tables get SELECT only — write grants must be added explicitly for each
-- new crawler-touched table to keep the principle of least privilege intact.
-- ---------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO crawler_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO crawler_writer;

-- ---------------------------------------------------------------------------
-- Explicitly withheld permissions (documented here for clarity)
-- ---------------------------------------------------------------------------
-- NO DELETE on any table
-- NO TRUNCATE on any table
-- NO INSERT/UPDATE on non-crawler tables (e.g. user profiles, portal configs)
-- NO access to the auth schema (Supabase auth.users, auth.sessions, etc.)
-- NO access to the storage schema (Supabase Storage objects)
-- NO SUPERUSER or CREATEDB privileges

COMMENT ON ROLE crawler_writer IS
  'Minimal-privilege role for the event crawler pipeline. '
  'SELECT everywhere, INSERT/UPDATE only on crawler-touched tables. '
  'No DELETE, no TRUNCATE, no auth/storage schema access.';
