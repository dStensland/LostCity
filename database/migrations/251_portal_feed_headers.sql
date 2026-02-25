-- Portal Feed Headers CMS
-- Editorial override layer for the CityPulse feed header.
-- The context engine (time + weather + holidays) provides defaults;
-- CMS overrides are evaluated on top — first matching scheduled config wins.

CREATE TABLE portal_feed_headers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    slug VARCHAR(63) NOT NULL,
    name VARCHAR(255) NOT NULL,           -- Admin-only label
    is_active BOOLEAN DEFAULT TRUE,
    priority INT DEFAULT 100,             -- Lower = higher priority, first match wins

    -- Schedule
    schedule_start DATE,
    schedule_end DATE,
    show_on_days VARCHAR(20)[],           -- {'monday','friday'}, null = all
    show_after_time TIME,                 -- '17:00', null = all day
    show_before_time TIME,

    -- Conditions (match against FeedContext, empty = always match)
    conditions JSONB DEFAULT '{}',
    -- { weather_signals?: string[], holidays?: string[], festivals?: boolean,
    --   time_slots?: string[], day_themes?: string[] }

    -- Editorial content (null = use algorithm default)
    headline TEXT,                         -- Supports {{display_name}}, {{city_name}}, etc.
    subtitle TEXT,
    hero_image_url TEXT,
    accent_color VARCHAR(30),

    -- Dashboard cards (null = use algorithm default)
    dashboard_cards JSONB,
    -- [{ id, label, icon, href, accent?, value?,
    --    query?: { entity: "events"|"venues", category?, venue_type?,
    --             date_filter?, time_after?, is_free?, is_open? } }]

    -- Quick links (null = use algorithm default)
    quick_links JSONB,
    -- [{ label, icon, href, accent_color }]

    -- CTA button (null = none)
    cta JSONB,
    -- { label, href, style?: "primary"|"ghost" }

    -- Event manipulation
    suppressed_event_ids INTEGER[],
    boosted_event_ids INTEGER[],

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(portal_id, slug)
);

CREATE INDEX idx_feed_headers_portal_active
ON portal_feed_headers(portal_id, is_active, priority) WHERE is_active = TRUE;

ALTER TABLE portal_feed_headers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Feed headers viewable for public portals"
ON portal_feed_headers FOR SELECT USING (
    EXISTS (SELECT 1 FROM portals WHERE portals.id = portal_feed_headers.portal_id
            AND portals.status = 'active' AND portals.visibility = 'public')
);

CREATE POLICY "Service role full access on feed headers"
ON portal_feed_headers FOR ALL USING (true) WITH CHECK (true);

-- Seed a default Atlanta header row so existing behavior works out of the box.
-- All editorial fields are null → resolver falls through to algorithm defaults.
INSERT INTO portal_feed_headers (portal_id, slug, name, is_active, priority, conditions)
SELECT
    id,
    'default',
    'Default (algorithm)',
    TRUE,
    999,       -- Lowest priority = fallback
    '{}'::jsonb
FROM portals
WHERE slug = 'atlanta'
LIMIT 1;
