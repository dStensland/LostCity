-- Studio-specific fields on the existing venues table.
-- Many studios already exist as venues — this avoids data duplication.
-- Used by the Arts portal Studios & Workspaces directory.

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS studio_type TEXT
    CHECK (studio_type IN ('private', 'shared', 'coop', 'residency', 'makerspace')),
  ADD COLUMN IF NOT EXISTS availability_status TEXT
    CHECK (availability_status IN ('open', 'waitlist', 'full', 'application_only')),
  ADD COLUMN IF NOT EXISTS monthly_rate_range TEXT,
  ADD COLUMN IF NOT EXISTS studio_application_url TEXT;

-- Index for studios directory queries
CREATE INDEX IF NOT EXISTS idx_venues_studio_type
  ON venues(studio_type) WHERE studio_type IS NOT NULL;

COMMENT ON COLUMN venues.studio_type IS 'Set for venues that function as artist studios/workspaces. NULL for non-studios.';
COMMENT ON COLUMN venues.availability_status IS 'Current availability for studio rentals/memberships.';
COMMENT ON COLUMN venues.monthly_rate_range IS 'Approximate monthly cost range, e.g. "$300-$600"';
COMMENT ON COLUMN venues.studio_application_url IS 'URL to studio rental/membership application';
