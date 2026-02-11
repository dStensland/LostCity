-- ============================================
-- MIGRATION 182: Strict Portal Analytics Attribution
-- ============================================
-- Replaces aggregate_daily_analytics() with portal-attributed metrics only.
-- Also backfills recent history and attempts to register a pg_cron schedule.

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
      0, -- event_shares is not portal-attributed yet
      0, -- new_signups is not portal-attributed yet
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
'Aggregates strictly portal-attributed daily analytics (views, RSVPs, saves, content, crawls).';

-- Backfill the last 30 completed days so dashboards are immediately populated.
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

-- Register/update pg_cron schedule when available.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      EXECUTE $sql$
        SELECT cron.unschedule(jobid)
        FROM cron.job
        WHERE jobname = 'aggregate-daily-analytics'
      $sql$;
    EXCEPTION
      WHEN undefined_table THEN
        NULL;
    END;

    BEGIN
      EXECUTE $sql$
        SELECT cron.schedule(
          'aggregate-daily-analytics',
          '5 2 * * *',
          'SELECT aggregate_daily_analytics();'
        )
      $sql$;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Unable to register pg_cron job aggregate-daily-analytics: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'pg_cron extension not installed; schedule aggregate_daily_analytics() externally.';
  END IF;
END $$;
