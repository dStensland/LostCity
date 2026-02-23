-- Migration 245: Database-Level Portal Access Enforcement via RLS
-- Enables Row Level Security on the events table so the database itself
-- enforces portal scoping. When a portal context is set via the x-portal-id
-- request header, only events from sources accessible to that portal are returned.
-- No portal header = see everything (admin/unscoped mode).

-- Helper: read portal UUID from PostgREST request header
CREATE OR REPLACE FUNCTION _portal_id()
RETURNS UUID AS $$
DECLARE
  raw_header TEXT;
BEGIN
  raw_header := current_setting('request.headers', true)::json ->> 'x-portal-id';
  IF raw_header IS NULL OR raw_header = '' THEN
    RETURN NULL;
  END IF;
  RETURN raw_header::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper: get accessible source IDs as array (for efficient ANY() in policy)
CREATE OR REPLACE FUNCTION _portal_source_ids()
RETURNS INTEGER[] AS $$
DECLARE
  pid UUID;
  result INTEGER[];
BEGIN
  pid := _portal_id();
  IF pid IS NULL THEN
    RETURN NULL;  -- NULL = no restriction
  END IF;
  SELECT array_agg(psa.source_id) INTO result
  FROM portal_source_access psa WHERE psa.portal_id = pid;
  RETURN COALESCE(result, ARRAY[]::INTEGER[]);
END;
$$ LANGUAGE plpgsql STABLE;

-- Enable RLS on events table
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- SELECT policy: no portal = see all; with portal = only accessible sources
CREATE POLICY events_portal_read_policy ON events FOR SELECT USING (
  _portal_source_ids() IS NULL
  OR source_id = ANY(_portal_source_ids())
);

-- No INSERT/UPDATE/DELETE policies for anon role (writes denied by default).
-- Service role (used for all writes) bypasses RLS entirely.

-- Ensure source_id index exists for the ANY() check
CREATE INDEX IF NOT EXISTS idx_events_source_id ON events(source_id);
