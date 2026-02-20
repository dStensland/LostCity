-- Destination planning metadata for pre-show dining recommendations
-- Adds structured timing fields that help estimate on-time arrival for nearby events

ALTER TABLE venues ADD COLUMN IF NOT EXISTS service_style TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS meal_duration_min_minutes INTEGER;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS meal_duration_max_minutes INTEGER;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS walk_in_wait_minutes INTEGER;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS payment_buffer_minutes INTEGER;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS accepts_reservations BOOLEAN;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS reservation_recommended BOOLEAN;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS planning_notes TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS planning_last_verified_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'venues_service_style_check'
  ) THEN
    ALTER TABLE venues
      ADD CONSTRAINT venues_service_style_check
      CHECK (
        service_style IS NULL
        OR service_style IN (
          'quick_service',
          'casual_dine_in',
          'full_service',
          'tasting_menu',
          'bar_food',
          'coffee_dessert'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'venues_meal_duration_min_minutes_check'
  ) THEN
    ALTER TABLE venues
      ADD CONSTRAINT venues_meal_duration_min_minutes_check
      CHECK (
        meal_duration_min_minutes IS NULL
        OR meal_duration_min_minutes BETWEEN 15 AND 360
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'venues_meal_duration_max_minutes_check'
  ) THEN
    ALTER TABLE venues
      ADD CONSTRAINT venues_meal_duration_max_minutes_check
      CHECK (
        meal_duration_max_minutes IS NULL
        OR meal_duration_max_minutes BETWEEN 15 AND 480
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'venues_walk_in_wait_minutes_check'
  ) THEN
    ALTER TABLE venues
      ADD CONSTRAINT venues_walk_in_wait_minutes_check
      CHECK (
        walk_in_wait_minutes IS NULL
        OR walk_in_wait_minutes BETWEEN 0 AND 240
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'venues_payment_buffer_minutes_check'
  ) THEN
    ALTER TABLE venues
      ADD CONSTRAINT venues_payment_buffer_minutes_check
      CHECK (
        payment_buffer_minutes IS NULL
        OR payment_buffer_minutes BETWEEN 0 AND 60
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'venues_meal_duration_order_check'
  ) THEN
    ALTER TABLE venues
      ADD CONSTRAINT venues_meal_duration_order_check
      CHECK (
        meal_duration_min_minutes IS NULL
        OR meal_duration_max_minutes IS NULL
        OR meal_duration_min_minutes <= meal_duration_max_minutes
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_venues_service_style
  ON venues(service_style)
  WHERE service_style IS NOT NULL;

COMMENT ON COLUMN venues.service_style IS
  'Dining service model used for planning estimates: quick_service, casual_dine_in, full_service, tasting_menu, bar_food, coffee_dessert.';
COMMENT ON COLUMN venues.meal_duration_min_minutes IS
  'Fastest typical dining duration in minutes for this destination.';
COMMENT ON COLUMN venues.meal_duration_max_minutes IS
  'Slowest typical dining duration in minutes for this destination.';
COMMENT ON COLUMN venues.walk_in_wait_minutes IS
  'Expected wait time for walk-ins in minutes (set to 0 if mostly immediate seating).';
COMMENT ON COLUMN venues.payment_buffer_minutes IS
  'Expected time in minutes for check/payment and exit before traveling to next stop.';
COMMENT ON COLUMN venues.accepts_reservations IS
  'Whether reservations are accepted (NULL means unknown).';
COMMENT ON COLUMN venues.reservation_recommended IS
  'Whether reservations are recommended for peak times (NULL means unknown).';
COMMENT ON COLUMN venues.planning_notes IS
  'Operational notes that impact planning windows (service pacing, cutoff times, etc.).';
COMMENT ON COLUMN venues.planning_last_verified_at IS
  'When planning metadata was last reviewed for this destination.';
