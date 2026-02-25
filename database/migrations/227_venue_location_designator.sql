-- Add explicit venue location designator for virtual/private/recovery locations.
-- This allows UI and ranking logic to treat non-standard locations correctly.

ALTER TABLE venues
ADD COLUMN IF NOT EXISTS location_designator TEXT NOT NULL DEFAULT 'standard';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'venues_location_designator_check'
  ) THEN
    ALTER TABLE venues
    ADD CONSTRAINT venues_location_designator_check
    CHECK (
      location_designator IN (
        'standard',
        'private_after_signup',
        'virtual',
        'recovery_meeting'
      )
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_venues_location_designator
  ON venues(location_designator);

-- Backfill known virtual locations first.
UPDATE venues
SET location_designator = 'virtual'
WHERE
  lower(coalesce(venue_type, '')) = 'virtual'
  OR slug = 'online-virtual'
  OR lower(name) LIKE '%online / virtual%'
  OR lower(name) LIKE '%virtual event%';

-- Backfill recovery meeting locations.
UPDATE venues
SET location_designator = 'recovery_meeting'
WHERE
  location_designator = 'standard'
  AND (
    slug LIKE 'aa-%'
    OR slug LIKE 'na-%'
    OR lower(name) LIKE '%anonymous%'
    OR lower(name) LIKE '%recovery%'
    OR lower(name) LIKE '%alcoholics anonymous%'
    OR lower(name) LIKE '%narcotics anonymous%'
  );

-- Backfill locations hidden until RSVP/sign-up.
UPDATE venues
SET location_designator = 'private_after_signup'
WHERE
  location_designator = 'standard'
  AND (
    slug = 'community-location'
    OR slug LIKE 'this-event-s-address-is-private%'
    OR lower(name) LIKE 'community location%'
    OR lower(name) LIKE '%address is private%'
    OR lower(name) LIKE '%private location%'
    OR lower(name) LIKE '%sign up for more details%'
  );

COMMENT ON COLUMN venues.location_designator IS
  'Classifies how location should be presented: standard, private_after_signup, virtual, recovery_meeting.';
