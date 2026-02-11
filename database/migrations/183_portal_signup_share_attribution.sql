-- ============================================
-- MIGRATION 183: Portal Signup + Share Attribution
-- ============================================
-- Adds first-class attribution storage for:
-- 1) New account signups per portal
-- 2) Event shares per portal
-- Then updates aggregate_daily_analytics() to use only these attributed sources.

-- Track where new users first signed up from.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS signup_portal_id UUID REFERENCES portals(id) ON DELETE SET NULL;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS signup_attributed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_signup_portal_created
  ON profiles(signup_portal_id, created_at DESC)
  WHERE signup_portal_id IS NOT NULL;

COMMENT ON COLUMN profiles.signup_portal_id IS 'Portal attribution for the user signup moment';
COMMENT ON COLUMN profiles.signup_attributed_at IS 'When signup portal attribution was written';

-- Explicit event share telemetry with strict portal attribution.
CREATE TABLE IF NOT EXISTS portal_event_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  share_method VARCHAR(20) NOT NULL DEFAULT 'unknown'
    CHECK (share_method IN ('native', 'clipboard', 'unknown')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_event_shares_portal_time
  ON portal_event_shares(portal_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_event_shares_event_time
  ON portal_event_shares(event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_event_shares_user_time
  ON portal_event_shares(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

ALTER TABLE portal_event_shares ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE portal_event_shares IS 'Portal-attributed event share interactions.';
COMMENT ON COLUMN portal_event_shares.share_method IS 'How the share succeeded (native share sheet vs clipboard copy).';

-- Rebuild daily aggregation with strict portal-attributed signup/share sources.
CREATE OR REPLACE FUNCTION aggregate_daily_analytics(target_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day')
RETURNS void AS $$
DECLARE
  portal_record RECORD;
  crawl_runs_value INT;
  crawl_success_rate_value DECIMAL(5,2);
BEGIN
  FOR portal_record IN
    SELECT id
    FROM portals
    WHERE status = 'active'
  LOOP
    SELECT
      COUNT(*)::INT,
      CASE
        WHEN COUNT(*) > 0
          THEN ROUND((COUNT(*) FILTER (WHERE cl.status = 'success')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
        ELSE 0
      END::DECIMAL(5,2)
    INTO crawl_runs_value, crawl_success_rate_value
    FROM crawl_logs cl
    JOIN sources s ON s.id = cl.source_id
    WHERE s.owner_portal_id = portal_record.id
      AND DATE(cl.started_at) = target_date;

    INSERT INTO analytics_daily_portal (
      date,
      portal_id,
      event_views,
      event_rsvps,
      event_saves,
      event_shares,
      new_signups,
      active_users,
      events_total,
      events_created,
      sources_active,
      crawl_runs,
      crawl_success_rate
    )
    VALUES (
      target_date,
      portal_record.id,
      (
        SELECT COUNT(*)::INT
        FROM portal_page_views pv
        WHERE pv.portal_id = portal_record.id
          AND DATE(pv.created_at) = target_date
      ),
      (
        SELECT COUNT(*)::INT
        FROM event_rsvps er
        JOIN events e ON e.id = er.event_id
        WHERE e.portal_id = portal_record.id
          AND DATE(er.created_at) = target_date
      ),
      (
        SELECT COUNT(*)::INT
        FROM saved_items si
        JOIN events e ON e.id = si.event_id
        WHERE e.portal_id = portal_record.id
          AND DATE(si.created_at) = target_date
      ),
      (
        SELECT COUNT(*)::INT
        FROM portal_event_shares pes
        WHERE pes.portal_id = portal_record.id
          AND DATE(pes.created_at) = target_date
      ),
      (
        SELECT COUNT(*)::INT
        FROM profiles p
        WHERE p.signup_portal_id = portal_record.id
          AND DATE(p.created_at) = target_date
      ),
      (
        SELECT COUNT(DISTINCT pv.user_agent)::INT
        FROM portal_page_views pv
        WHERE pv.portal_id = portal_record.id
          AND DATE(pv.created_at) = target_date
          AND pv.user_agent IS NOT NULL
      ),
      (
        SELECT COUNT(*)::INT
        FROM events e
        WHERE e.portal_id = portal_record.id
          AND e.start_date >= target_date
          AND e.canonical_event_id IS NULL
      ),
      (
        SELECT COUNT(*)::INT
        FROM events e
        WHERE e.portal_id = portal_record.id
          AND DATE(e.created_at) = target_date
      ),
      (
        SELECT COUNT(*)::INT
        FROM sources s
        WHERE s.owner_portal_id = portal_record.id
          AND s.is_active = true
      ),
      COALESCE(crawl_runs_value, 0),
      COALESCE(crawl_success_rate_value, 0)
    )
    ON CONFLICT (date, portal_id) DO UPDATE SET
      event_views = EXCLUDED.event_views,
      event_rsvps = EXCLUDED.event_rsvps,
      event_saves = EXCLUDED.event_saves,
      event_shares = EXCLUDED.event_shares,
      new_signups = EXCLUDED.new_signups,
      active_users = EXCLUDED.active_users,
      events_total = EXCLUDED.events_total,
      events_created = EXCLUDED.events_created,
      sources_active = EXCLUDED.sources_active,
      crawl_runs = EXCLUDED.crawl_runs,
      crawl_success_rate = EXCLUDED.crawl_success_rate;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION aggregate_daily_analytics IS
'Aggregates strictly portal-attributed daily analytics including attributed shares and signups.';

-- Recompute recent history using the new attribution sources.
DO $$
DECLARE
  day_cursor DATE;
BEGIN
  FOR day_cursor IN
    SELECT generate_series(
      CURRENT_DATE - INTERVAL '30 days',
      CURRENT_DATE - INTERVAL '1 day',
      INTERVAL '1 day'
    )::DATE
  LOOP
    PERFORM aggregate_daily_analytics(day_cursor);
  END LOOP;
END $$;
