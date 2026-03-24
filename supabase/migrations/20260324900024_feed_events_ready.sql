-- Migration: feed_events_ready denormalized table + refresh RPC
--
-- Creates a pre-computed flat table that the feed can read with a single
-- simple SELECT, replacing the 4+ complex parallel queries that currently
-- take 74ms–4.5s per cold load.
--
-- One row per (event_id, portal_id) combination.
-- Refreshed after every crawl run via refresh_feed_events_ready().

-- ==========================================================================
-- UP
-- ==========================================================================

CREATE TABLE IF NOT EXISTS feed_events_ready (
  event_id        INT NOT NULL,
  portal_id       UUID NOT NULL,
  title           TEXT,
  start_date      DATE NOT NULL,
  start_time      TIME,
  end_date        DATE,
  end_time        TIME,
  is_all_day      BOOLEAN DEFAULT false,
  is_free         BOOLEAN DEFAULT false,
  price_min       NUMERIC,
  price_max       NUMERIC,
  category        TEXT,
  genres          TEXT[],
  image_url       TEXT,
  featured_blurb  TEXT,
  tags            TEXT[],
  festival_id     TEXT,
  is_tentpole     BOOLEAN DEFAULT false,
  is_featured     BOOLEAN DEFAULT false,
  series_id       UUID,
  is_recurring    BOOLEAN DEFAULT false,
  source_id       INT,
  organization_id TEXT,
  importance      TEXT,
  data_quality    NUMERIC,
  on_sale_date    DATE,
  presale_date    DATE,
  early_bird_deadline DATE,
  sellout_risk    TEXT,
  attendee_count  INT DEFAULT 0,
  -- Venue (denormalized from venues table via event.venue_id)
  venue_id        INT,
  venue_name      TEXT,
  venue_slug      TEXT,
  venue_neighborhood TEXT,
  venue_city      TEXT,
  venue_type      TEXT,
  venue_image_url TEXT,
  venue_active    BOOLEAN DEFAULT true,
  -- Series (denormalized from series table via event.series_id)
  series_name     TEXT,
  series_type     TEXT,
  series_slug     TEXT,
  -- Metadata
  refreshed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, portal_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_events_ready_portal_date
  ON feed_events_ready (portal_id, start_date, data_quality DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_feed_events_ready_portal_date_time
  ON feed_events_ready (portal_id, start_date, start_time)
  WHERE start_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_feed_events_ready_horizon
  ON feed_events_ready (portal_id, start_date)
  WHERE is_tentpole = true OR festival_id IS NOT NULL OR importance = 'flagship';

COMMENT ON TABLE feed_events_ready IS
  'Pre-computed denormalized feed table. One row per (event_id, portal_id). '
  'Refreshed after every crawl via refresh_feed_events_ready(). '
  'Replaces the 4+ parallel queries that assembled the feed at query time.';

-- ==========================================================================
-- Refresh RPC
-- ==========================================================================

CREATE OR REPLACE FUNCTION refresh_feed_events_ready(
  p_portal_id UUID DEFAULT NULL
)
RETURNS INT AS $$
DECLARE
  v_upserted INT := 0;
BEGIN
  -- 1. Prune past events (> 1 day old) to keep the table lean
  IF p_portal_id IS NOT NULL THEN
    DELETE FROM feed_events_ready
    WHERE portal_id = p_portal_id
      AND start_date < CURRENT_DATE - 1;
  ELSE
    DELETE FROM feed_events_ready
    WHERE start_date < CURRENT_DATE - 1;
  END IF;

  -- 2. Upsert current + future feed-eligible events for all portals
  --    (or just the specified portal when p_portal_id is given).
  --
  --    Portal membership comes from portal_source_access (materialized view):
  --    a source belongs to a portal if that portal owns it, if the source is
  --    global (no owner), or if the portal has an active subscription to it.
  INSERT INTO feed_events_ready (
    event_id,
    portal_id,
    title,
    start_date,
    start_time,
    end_date,
    end_time,
    is_all_day,
    is_free,
    price_min,
    price_max,
    category,
    genres,
    image_url,
    featured_blurb,
    tags,
    festival_id,
    is_tentpole,
    is_featured,
    series_id,
    is_recurring,
    source_id,
    organization_id,
    importance,
    data_quality,
    on_sale_date,
    presale_date,
    early_bird_deadline,
    sellout_risk,
    attendee_count,
    venue_id,
    venue_name,
    venue_slug,
    venue_neighborhood,
    venue_city,
    venue_type,
    venue_image_url,
    venue_active,
    series_name,
    series_type,
    series_slug,
    refreshed_at
  )
  SELECT
    e.id                             AS event_id,
    psa.portal_id                    AS portal_id,
    e.title,
    e.start_date,
    e.start_time,
    e.end_date,
    e.end_time,
    COALESCE(e.is_all_day, false)    AS is_all_day,
    COALESCE(e.is_free, false)       AS is_free,
    e.price_min,
    e.price_max,
    e.category_id                    AS category,
    e.genres,
    e.image_url,
    e.featured_blurb,
    e.tags,
    e.festival_id,
    COALESCE(e.is_tentpole, false)   AS is_tentpole,
    COALESCE(e.is_featured, false)   AS is_featured,
    e.series_id,
    COALESCE(e.is_recurring, false)  AS is_recurring,
    e.source_id,
    e.organization_id,
    e.importance,
    e.data_quality,
    e.on_sale_date,
    e.presale_date,
    e.early_bird_deadline,
    e.sellout_risk,
    COALESCE(e.attendee_count, 0)    AS attendee_count,
    v.id                             AS venue_id,
    v.name                           AS venue_name,
    v.slug                           AS venue_slug,
    v.neighborhood                   AS venue_neighborhood,
    v.city                           AS venue_city,
    v.venue_type,
    v.image_url                      AS venue_image_url,
    COALESCE(v.active, true)         AS venue_active,
    s.title                          AS series_name,
    s.series_type,
    s.slug                           AS series_slug,
    now()                            AS refreshed_at
  FROM events e
  INNER JOIN portal_source_access psa ON psa.source_id = e.source_id
  LEFT JOIN venues v ON v.id = e.venue_id
  LEFT JOIN series s ON s.id = e.series_id
  WHERE
    e.is_active = true
    AND e.canonical_event_id IS NULL
    AND COALESCE(e.is_class, false) = false
    AND COALESCE(e.is_sensitive, false) = false
    AND COALESCE(e.is_feed_ready, true) = true
    AND e.start_date >= CURRENT_DATE - 1
    AND e.start_date <= CURRENT_DATE + 180
    AND (
      p_portal_id IS NULL
      OR psa.portal_id = p_portal_id
    )
  ON CONFLICT (event_id, portal_id) DO UPDATE SET
    title               = EXCLUDED.title,
    start_date          = EXCLUDED.start_date,
    start_time          = EXCLUDED.start_time,
    end_date            = EXCLUDED.end_date,
    end_time            = EXCLUDED.end_time,
    is_all_day          = EXCLUDED.is_all_day,
    is_free             = EXCLUDED.is_free,
    price_min           = EXCLUDED.price_min,
    price_max           = EXCLUDED.price_max,
    category            = EXCLUDED.category,
    genres              = EXCLUDED.genres,
    image_url           = EXCLUDED.image_url,
    featured_blurb      = EXCLUDED.featured_blurb,
    tags                = EXCLUDED.tags,
    festival_id         = EXCLUDED.festival_id,
    is_tentpole         = EXCLUDED.is_tentpole,
    is_featured         = EXCLUDED.is_featured,
    series_id           = EXCLUDED.series_id,
    is_recurring        = EXCLUDED.is_recurring,
    source_id           = EXCLUDED.source_id,
    organization_id     = EXCLUDED.organization_id,
    importance          = EXCLUDED.importance,
    data_quality        = EXCLUDED.data_quality,
    on_sale_date        = EXCLUDED.on_sale_date,
    presale_date        = EXCLUDED.presale_date,
    early_bird_deadline = EXCLUDED.early_bird_deadline,
    sellout_risk        = EXCLUDED.sellout_risk,
    attendee_count      = EXCLUDED.attendee_count,
    venue_id            = EXCLUDED.venue_id,
    venue_name          = EXCLUDED.venue_name,
    venue_slug          = EXCLUDED.venue_slug,
    venue_neighborhood  = EXCLUDED.venue_neighborhood,
    venue_city          = EXCLUDED.venue_city,
    venue_type          = EXCLUDED.venue_type,
    venue_image_url     = EXCLUDED.venue_image_url,
    venue_active        = EXCLUDED.venue_active,
    series_name         = EXCLUDED.series_name,
    series_type         = EXCLUDED.series_type,
    series_slug         = EXCLUDED.series_slug,
    refreshed_at        = EXCLUDED.refreshed_at;

  GET DIAGNOSTICS v_upserted = ROW_COUNT;
  RETURN v_upserted;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_feed_events_ready(UUID) IS
  'Upserts feed_events_ready for all portals (or just p_portal_id when specified). '
  'Prunes rows with start_date < CURRENT_DATE - 1. '
  'Returns the number of rows upserted. '
  'Called after every crawl run by post_crawl_maintenance.py.';

-- ==========================================================================
-- Seed: initial population across all portals
-- ==========================================================================

SELECT refresh_feed_events_ready();

-- ==========================================================================
-- DOWN (manual rollback)
-- ==========================================================================
-- DROP FUNCTION IF EXISTS refresh_feed_events_ready(UUID);
-- DROP TABLE IF EXISTS feed_events_ready;
