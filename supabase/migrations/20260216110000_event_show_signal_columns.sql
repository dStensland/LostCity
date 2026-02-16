-- First-class show metadata for premium music/comedy event presentation
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS doors_time TIME,
  ADD COLUMN IF NOT EXISTS age_policy TEXT,
  ADD COLUMN IF NOT EXISTS ticket_status TEXT,
  ADD COLUMN IF NOT EXISTS reentry_policy TEXT,
  ADD COLUMN IF NOT EXISTS set_times_mentioned BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_age_policy_check'
      AND conrelid = 'events'::regclass
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_age_policy_check
      CHECK (age_policy IS NULL OR age_policy IN ('21+', '18+', 'all-ages', 'adults-only'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_ticket_status_check'
      AND conrelid = 'events'::regclass
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_ticket_status_check
      CHECK (ticket_status IS NULL OR ticket_status IN ('sold-out', 'low-tickets', 'free', 'tickets-available'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_reentry_policy_check'
      AND conrelid = 'events'::regclass
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_reentry_policy_check
      CHECK (reentry_policy IS NULL OR reentry_policy IN ('no-reentry', 'reentry-allowed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_events_doors_time ON events(doors_time);
CREATE INDEX IF NOT EXISTS idx_events_age_policy ON events(age_policy);
CREATE INDEX IF NOT EXISTS idx_events_ticket_status ON events(ticket_status);
