-- Migration: Open Calls Table
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

-- Phase E: Open Calls table — deadline-driven opportunities for artists.

CREATE TABLE IF NOT EXISTS open_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  venue_id INTEGER REFERENCES venues(id) ON DELETE SET NULL,
  source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  portal_id UUID REFERENCES portals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  deadline DATE,
  application_url TEXT NOT NULL,
  fee NUMERIC,
  eligibility TEXT,
  medium_requirements TEXT[],
  call_type TEXT NOT NULL CHECK (call_type IN ('submission','residency','grant','commission','exhibition_proposal')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','reviewing','awarded')),
  source_url TEXT,
  tags TEXT[],
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_open_calls_deadline ON open_calls(deadline) WHERE is_active = true AND status = 'open';
CREATE INDEX IF NOT EXISTS idx_open_calls_portal ON open_calls(portal_id, is_active) WHERE portal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_open_calls_venue ON open_calls(venue_id) WHERE venue_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_open_calls_org ON open_calls(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_open_calls_type ON open_calls(call_type, status) WHERE is_active = true;

-- Triggers
DROP TRIGGER IF EXISTS update_open_calls_updated_at ON open_calls;
CREATE TRIGGER update_open_calls_updated_at
  BEFORE UPDATE ON open_calls
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE open_calls ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'open_calls'
      AND policyname = 'open_calls_public_select_active'
  ) THEN
    CREATE POLICY open_calls_public_select_active
      ON open_calls FOR SELECT
      USING (is_active = true);
  END IF;
END $$;
