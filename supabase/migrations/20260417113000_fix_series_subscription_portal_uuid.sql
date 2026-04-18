-- Align series subscription portal attribution to UUID.
-- See database/migrations/607_fix_series_subscription_portal_uuid.sql.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_series_subscriptions'
      AND column_name = 'portal_id'
      AND udt_name = 'text'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM user_series_subscriptions
      WHERE portal_id IS NULL
         OR btrim(portal_id) = ''
         OR btrim(portal_id) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ) THEN
      RAISE EXCEPTION
        'Cannot convert user_series_subscriptions.portal_id to UUID: invalid values present';
    END IF;

    ALTER TABLE user_series_subscriptions
      ALTER COLUMN portal_id TYPE UUID
      USING btrim(portal_id)::uuid;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_series_subscriptions'
      AND column_name = 'portal_id'
  ) THEN
    ALTER TABLE user_series_subscriptions
      ALTER COLUMN portal_id SET NOT NULL;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'user_series_subscriptions_portal_id_fkey'
    ) THEN
      ALTER TABLE user_series_subscriptions
        ADD CONSTRAINT user_series_subscriptions_portal_id_fkey
        FOREIGN KEY (portal_id) REFERENCES portals(id) ON DELETE CASCADE;
    END IF;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_rsvps'
      AND column_name = 'portal_id'
      AND udt_name = 'text'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM event_rsvps
      WHERE portal_id IS NOT NULL
        AND (
          btrim(portal_id) = ''
          OR btrim(portal_id) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        )
    ) THEN
      RAISE EXCEPTION
        'Cannot convert event_rsvps.portal_id to UUID: invalid values present';
    END IF;

    ALTER TABLE event_rsvps
      ALTER COLUMN portal_id TYPE UUID
      USING NULLIF(btrim(portal_id), '')::uuid;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_rsvps'
      AND column_name = 'portal_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_rsvps_portal_id_fkey'
  ) THEN
    ALTER TABLE event_rsvps
      ADD CONSTRAINT event_rsvps_portal_id_fkey
      FOREIGN KEY (portal_id) REFERENCES portals(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION auto_rsvp_for_subscribers()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.series_id IS NOT NULL AND NEW.start_date >= CURRENT_DATE THEN
    INSERT INTO event_rsvps (user_id, event_id, status, source, portal_id)
    SELECT
      s.user_id,
      NEW.id,
      'going',
      'subscription',
      s.portal_id
    FROM user_series_subscriptions s
    WHERE s.series_id = NEW.series_id
    ON CONFLICT (user_id, event_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN user_series_subscriptions.portal_id IS
  'Portal context where the series subscription was created; stored as UUID for RSVP attribution.';
