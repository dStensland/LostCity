-- ============================================
-- MIGRATION 307: Hooky — Programs and Age Filtering
-- ============================================
-- Foundation data model for the Hooky family portal (PRD-035).
--
-- Adds:
--   1. age_min / age_max columns on events — enables per-kid age filtering
--      across all portals that federate into Hooky.
--   2. programs table — structured enrollment-based activities (camps,
--      enrichment classes, leagues, clubs) that are distinct from one-off
--      events and require registration tracking.
--   3. school_calendar_events table — public school system calendar data
--      (APS, DeKalb, Cobb, Gwinnett) stored as reference data to power
--      the "Heads Up" no-school / teacher-workday alerts.
-- ============================================

-- -------------------------------------------------------
-- 1. Age range columns on events
-- -------------------------------------------------------
-- Nullable integers; NULL means no age restriction declared.
-- Crawlers populate these from source data (e.g., "Ages 5-12" on event pages).

ALTER TABLE events ADD COLUMN IF NOT EXISTS age_min INT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS age_max INT;

COMMENT ON COLUMN events.age_min IS 'Minimum age in years for event attendance. NULL = no restriction declared.';
COMMENT ON COLUMN events.age_max IS 'Maximum age in years for event attendance. NULL = no restriction declared.';

CREATE INDEX IF NOT EXISTS idx_events_age_range
  ON events(age_min, age_max)
  WHERE age_min IS NOT NULL OR age_max IS NOT NULL;

-- -------------------------------------------------------
-- 2. Programs table
-- -------------------------------------------------------
-- Programs are structured commitments with enrollment: camps, enrichment classes,
-- recreational leagues, clubs. Unlike events (one-off), programs have session dates,
-- recurring schedules, registration windows, and cost structures.

CREATE TABLE IF NOT EXISTS programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID REFERENCES portals(id) ON DELETE SET NULL,
  source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  venue_id INTEGER REFERENCES venues(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  program_type TEXT NOT NULL CHECK (
    program_type IN ('camp', 'enrichment', 'league', 'club', 'class', 'rec_program')
  ),
  provider_name TEXT,
  age_min INT,
  age_max INT,
  season TEXT CHECK (season IN ('summer', 'fall', 'spring', 'winter', 'year_round')),
  session_start DATE,
  session_end DATE,
  schedule_days INT[],           -- ISO 8601 day numbers (1=Mon … 7=Sun)
  schedule_start_time TIME,
  schedule_end_time TIME,
  cost_amount NUMERIC,
  cost_period TEXT CHECK (cost_period IN ('per_session', 'per_week', 'per_month', 'per_season')),
  cost_notes TEXT,               -- e.g. "before/after care $50 extra"
  registration_status TEXT NOT NULL DEFAULT 'unknown' CHECK (
    registration_status IN ('open', 'waitlist', 'closed', 'walk_in', 'sold_out', 'upcoming', 'unknown')
  ),
  registration_opens DATE,
  registration_closes DATE,
  registration_url TEXT,
  last_status_check_at TIMESTAMPTZ,
  before_after_care BOOLEAN NOT NULL DEFAULT false,
  lunch_included BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[],
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT programs_age_range_check CHECK (
    age_min IS NULL OR age_max IS NULL OR age_min <= age_max
  ),
  CONSTRAINT programs_session_order_check CHECK (
    session_start IS NULL OR session_end IS NULL OR session_start <= session_end
  ),
  CONSTRAINT programs_registration_window_check CHECK (
    registration_opens IS NULL OR registration_closes IS NULL OR registration_opens <= registration_closes
  )
);

COMMENT ON TABLE programs IS 'Structured enrollment-based activities: camps, enrichment classes, leagues, clubs. Distinguished from one-off events by session dates, schedules, and registration windows.';
COMMENT ON COLUMN programs.schedule_days IS 'ISO 8601 day numbers: 1=Monday, 7=Sunday.';
COMMENT ON COLUMN programs.registration_status IS 'Live enrollment state crawled from provider. last_status_check_at tracks freshness.';
COMMENT ON COLUMN programs.slug IS 'URL-safe identifier, unique across all programs.';

CREATE INDEX IF NOT EXISTS idx_programs_portal_id
  ON programs(portal_id)
  WHERE portal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_programs_program_type
  ON programs(program_type, status);

CREATE INDEX IF NOT EXISTS idx_programs_registration_status
  ON programs(registration_status, status);

CREATE INDEX IF NOT EXISTS idx_programs_age_range
  ON programs(age_min, age_max)
  WHERE age_min IS NOT NULL OR age_max IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_programs_season
  ON programs(season, status)
  WHERE season IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_programs_status
  ON programs(status, updated_at DESC);

DROP TRIGGER IF EXISTS update_programs_updated_at ON programs;
CREATE TRIGGER update_programs_updated_at
  BEFORE UPDATE ON programs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'programs' AND policyname = 'programs_public_select_active'
  ) THEN
    CREATE POLICY programs_public_select_active ON programs
      FOR SELECT
      USING (status = 'active');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'programs' AND policyname = 'programs_service_role_all'
  ) THEN
    CREATE POLICY programs_service_role_all ON programs
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- -------------------------------------------------------
-- 3. School calendar events table
-- -------------------------------------------------------
-- Reference data only — not per-child school affiliation.
-- Parents select a school system; Hooky shows that system's no-school days.
-- Populated by a crawler or manual seed (4 metro Atlanta systems for MVP).

CREATE TABLE IF NOT EXISTS school_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_system TEXT NOT NULL CHECK (school_system IN ('aps', 'dekalb', 'cobb', 'gwinnett')),
  event_type TEXT NOT NULL CHECK (
    event_type IN ('no_school', 'half_day', 'break', 'holiday', 'early_release')
  ),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  school_year TEXT NOT NULL,   -- e.g. "2025-26"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT school_calendar_date_order_check CHECK (start_date <= end_date)
);

COMMENT ON TABLE school_calendar_events IS 'Public school system calendar reference data. Powers Hooky "Heads Up" alerts for no-school days, teacher workdays, and breaks. NOT per-child school affiliation.';
COMMENT ON COLUMN school_calendar_events.school_system IS 'aps=Atlanta Public Schools, dekalb=DeKalb County, cobb=Cobb County, gwinnett=Gwinnett County.';
COMMENT ON COLUMN school_calendar_events.school_year IS 'Format: YYYY-YY (e.g. "2025-26").';

CREATE INDEX IF NOT EXISTS idx_school_calendar_system
  ON school_calendar_events(school_system, school_year);

CREATE INDEX IF NOT EXISTS idx_school_calendar_date_range
  ON school_calendar_events(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_school_calendar_school_year
  ON school_calendar_events(school_year);

CREATE INDEX IF NOT EXISTS idx_school_calendar_event_type
  ON school_calendar_events(event_type, start_date);

ALTER TABLE school_calendar_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'school_calendar_events' AND policyname = 'school_calendar_events_public_select'
  ) THEN
    CREATE POLICY school_calendar_events_public_select ON school_calendar_events
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'school_calendar_events' AND policyname = 'school_calendar_events_service_role_all'
  ) THEN
    CREATE POLICY school_calendar_events_service_role_all ON school_calendar_events
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
