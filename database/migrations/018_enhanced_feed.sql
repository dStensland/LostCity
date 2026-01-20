-- ============================================
-- MIGRATION 018: Enhanced Feed System
-- ============================================

-- Add new columns to portal_sections for enhanced functionality
ALTER TABLE portal_sections
ADD COLUMN IF NOT EXISTS block_type VARCHAR(30) DEFAULT 'event_list'
    CHECK (block_type IN (
        'event_list',      -- Standard list of events
        'event_cards',     -- Card grid with images
        'event_carousel',  -- Horizontal scroll
        'hero_banner',     -- Large featured event
        'venue_spotlight', -- Featured venue with events
        'category_grid',   -- Category quick links
        'countdown',       -- Countdown to major event
        'announcement',    -- Rich text content
        'external_link'    -- Link card to external site
    ));

ALTER TABLE portal_sections
ADD COLUMN IF NOT EXISTS layout VARCHAR(20) DEFAULT 'list'
    CHECK (layout IN ('list', 'cards', 'carousel', 'grid', 'featured'));

ALTER TABLE portal_sections
ADD COLUMN IF NOT EXISTS items_per_row INT DEFAULT 1;

ALTER TABLE portal_sections
ADD COLUMN IF NOT EXISTS max_items INT DEFAULT 5;

-- Content for non-event block types (announcements, external links, etc)
ALTER TABLE portal_sections
ADD COLUMN IF NOT EXISTS block_content JSONB DEFAULT '{}';

-- Scheduling and visibility rules
ALTER TABLE portal_sections
ADD COLUMN IF NOT EXISTS schedule_start DATE;

ALTER TABLE portal_sections
ADD COLUMN IF NOT EXISTS schedule_end DATE;

ALTER TABLE portal_sections
ADD COLUMN IF NOT EXISTS show_on_days VARCHAR(20)[] DEFAULT NULL;  -- e.g., {'friday', 'saturday', 'sunday'}

ALTER TABLE portal_sections
ADD COLUMN IF NOT EXISTS show_after_time TIME DEFAULT NULL;  -- e.g., '16:00' for after 4pm

ALTER TABLE portal_sections
ADD COLUMN IF NOT EXISTS show_before_time TIME DEFAULT NULL;

-- Styling options
ALTER TABLE portal_sections
ADD COLUMN IF NOT EXISTS style JSONB DEFAULT '{}';  -- background_color, text_color, etc.

-- Enhanced auto_filter with more options
-- The existing auto_filter JSONB column will now support:
-- {
--   "categories": ["music", "comedy"],
--   "subcategories": ["music.jazz", "music.rock"],
--   "neighborhoods": ["Midtown", "East Atlanta"],
--   "tags": ["family-friendly", "outdoor"],
--   "is_free": true,
--   "price_max": 25,
--   "date_filter": "today" | "tomorrow" | "this_weekend" | "next_7_days" | "next_30_days",
--   "sort_by": "date" | "popularity" | "trending" | "random",
--   "source_ids": [1, 2, 3],  -- specific crawler sources
--   "venue_ids": [10, 20],    -- specific venues
--   "exclude_ids": [100, 200] -- exclude specific events
-- }

-- Create index for schedule-based visibility
CREATE INDEX IF NOT EXISTS idx_portal_sections_schedule
ON portal_sections(portal_id, schedule_start, schedule_end)
WHERE schedule_start IS NOT NULL OR schedule_end IS NOT NULL;

-- Create index for day-based visibility
CREATE INDEX IF NOT EXISTS idx_portal_sections_days
ON portal_sections(portal_id)
WHERE show_on_days IS NOT NULL;

-- ============================================
-- Add portal feed settings defaults
-- ============================================

-- Update Atlanta portal with enhanced feed settings
UPDATE portals
SET settings = settings || '{
    "feed": {
        "feed_type": "sections",
        "show_activity_tab": false,
        "default_layout": "list",
        "items_per_section": 5
    }
}'::jsonb
WHERE slug = 'atlanta';

-- ============================================
-- Sample sections for Atlanta feed
-- ============================================

-- First, get Atlanta portal ID
DO $$
DECLARE
    atlanta_portal_id UUID;
BEGIN
    SELECT id INTO atlanta_portal_id FROM portals WHERE slug = 'atlanta';

    IF atlanta_portal_id IS NOT NULL THEN
        -- Delete existing sections to replace with new ones
        DELETE FROM portal_sections WHERE portal_id = atlanta_portal_id;

        -- Hero Banner - Featured Event
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            atlanta_portal_id,
            'featured-event',
            'Featured',
            NULL,
            'auto',
            'hero_banner',
            'featured',
            1,
            '{"sort_by": "popularity", "date_filter": "next_7_days"}',
            0,
            true
        );

        -- Happening Today
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            atlanta_portal_id,
            'today',
            'Happening Today',
            'Don''t miss these events',
            'auto',
            'event_cards',
            'carousel',
            10,
            '{"date_filter": "today", "sort_by": "popularity"}',
            1,
            true
        );

        -- This Weekend
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible,
            show_on_days
        ) VALUES (
            atlanta_portal_id,
            'this-weekend',
            'This Weekend',
            'Plan your weekend adventures',
            'auto',
            'event_cards',
            'grid',
            6,
            '{"date_filter": "this_weekend", "sort_by": "popularity"}',
            2,
            true,
            ARRAY['wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        );

        -- Free Events
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            atlanta_portal_id,
            'free-events',
            'Free Things to Do',
            'No cover, no problem',
            'auto',
            'event_list',
            'list',
            8,
            '{"is_free": true, "date_filter": "next_7_days", "sort_by": "date"}',
            3,
            true
        );

        -- Live Music
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            atlanta_portal_id,
            'live-music',
            'Live Music',
            'Concerts, shows, and performances',
            'auto',
            'event_cards',
            'carousel',
            10,
            '{"categories": ["music"], "date_filter": "next_7_days", "sort_by": "date"}',
            4,
            true
        );

        -- Comedy Shows
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            atlanta_portal_id,
            'comedy',
            'Comedy & Laughs',
            'Stand-up, improv, and more',
            'auto',
            'event_list',
            'list',
            6,
            '{"categories": ["comedy"], "date_filter": "next_7_days", "sort_by": "date"}',
            5,
            true
        );

        -- Category Quick Links
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            block_content, display_order, is_visible
        ) VALUES (
            atlanta_portal_id,
            'browse-categories',
            'Explore by Category',
            NULL,
            'curated',
            'category_grid',
            'grid',
            12,
            '{
                "categories": [
                    {"id": "music", "label": "Music", "icon": "music"},
                    {"id": "comedy", "label": "Comedy", "icon": "comedy"},
                    {"id": "art", "label": "Art", "icon": "art"},
                    {"id": "theater", "label": "Theater", "icon": "theater"},
                    {"id": "film", "label": "Film", "icon": "film"},
                    {"id": "food_drink", "label": "Food & Drink", "icon": "food_drink"},
                    {"id": "nightlife", "label": "Nightlife", "icon": "nightlife"},
                    {"id": "sports", "label": "Sports", "icon": "sports"},
                    {"id": "community", "label": "Community", "icon": "community"},
                    {"id": "fitness", "label": "Fitness", "icon": "fitness"},
                    {"id": "family", "label": "Family", "icon": "family"},
                    {"id": "other", "label": "Other", "icon": "other"}
                ]
            }',
            6,
            true
        );

        -- Late Night (shows after 8pm)
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible,
            show_after_time
        ) VALUES (
            atlanta_portal_id,
            'late-night',
            'Late Night',
            'The night is young',
            'auto',
            'event_cards',
            'carousel',
            8,
            '{"categories": ["nightlife", "music", "comedy"], "date_filter": "today", "sort_by": "date"}',
            7,
            true,
            '20:00'
        );

    END IF;
END $$;

-- ============================================
-- Helper function to check section visibility
-- ============================================

CREATE OR REPLACE FUNCTION is_section_visible(
    p_schedule_start DATE,
    p_schedule_end DATE,
    p_show_on_days VARCHAR(20)[],
    p_show_after_time TIME,
    p_show_before_time TIME
) RETURNS BOOLEAN AS $$
DECLARE
    cur_day VARCHAR(20);
    cur_time TIME;
BEGIN
    cur_day := LOWER(TO_CHAR(CURRENT_DATE, 'day'));
    cur_day := TRIM(cur_day);
    cur_time := CURRENT_TIME;

    -- Check date range
    IF p_schedule_start IS NOT NULL AND CURRENT_DATE < p_schedule_start THEN
        RETURN FALSE;
    END IF;

    IF p_schedule_end IS NOT NULL AND CURRENT_DATE > p_schedule_end THEN
        RETURN FALSE;
    END IF;

    -- Check day of week
    IF p_show_on_days IS NOT NULL AND array_length(p_show_on_days, 1) > 0 THEN
        IF NOT (cur_day = ANY(p_show_on_days)) THEN
            RETURN FALSE;
        END IF;
    END IF;

    -- Check time of day
    IF p_show_after_time IS NOT NULL AND cur_time < p_show_after_time THEN
        RETURN FALSE;
    END IF;

    IF p_show_before_time IS NOT NULL AND cur_time > p_show_before_time THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
