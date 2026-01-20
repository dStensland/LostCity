-- ============================================
-- MIGRATION 019: Piedmont Healthcare Feed Setup
-- ============================================

-- Update Piedmont portal with feed settings
UPDATE portals
SET settings = settings || '{
    "feed": {
        "feed_type": "sections",
        "show_activity_tab": false,
        "default_layout": "list",
        "items_per_section": 5
    }
}'::jsonb
WHERE slug = 'piedmont';

-- ============================================
-- Feed Sections for Piedmont Healthcare Portal
-- ============================================

DO $$
DECLARE
    piedmont_portal_id UUID;
BEGIN
    SELECT id INTO piedmont_portal_id FROM portals WHERE slug = 'piedmont';

    IF piedmont_portal_id IS NOT NULL THEN
        -- Delete existing sections to replace with new ones
        DELETE FROM portal_sections WHERE portal_id = piedmont_portal_id;

        -- 1. Hero Banner - Featured Class/Event
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            piedmont_portal_id,
            'featured-class',
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

        -- 2. Happening This Week
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            piedmont_portal_id,
            'this-week',
            'This Week',
            'Upcoming classes and events',
            'auto',
            'event_cards',
            'carousel',
            12,
            '{"date_filter": "next_7_days", "sort_by": "date"}',
            1,
            true
        );

        -- 3. Fitness & Exercise Classes
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            piedmont_portal_id,
            'fitness-classes',
            'Fitness & Exercise',
            'Stay active with our fitness programs',
            'auto',
            'event_cards',
            'grid',
            6,
            '{"categories": ["fitness"], "date_filter": "next_30_days", "sort_by": "date"}',
            2,
            true
        );

        -- 4. Health Education & Wellness
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            piedmont_portal_id,
            'health-education',
            'Health Education',
            'Learn from our healthcare experts',
            'auto',
            'event_list',
            'list',
            8,
            '{"categories": ["learning", "other"], "date_filter": "next_30_days", "sort_by": "date"}',
            3,
            true
        );

        -- 5. Support Groups & Community
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            piedmont_portal_id,
            'support-groups',
            'Support Groups',
            'Connect with others on similar journeys',
            'auto',
            'event_list',
            'list',
            6,
            '{"categories": ["community"], "date_filter": "next_30_days", "sort_by": "date"}',
            4,
            true
        );

        -- 6. Free Classes & Events
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            piedmont_portal_id,
            'free-events',
            'Free Classes',
            'No cost health and wellness offerings',
            'auto',
            'event_cards',
            'carousel',
            10,
            '{"is_free": true, "date_filter": "next_30_days", "sort_by": "date"}',
            5,
            true
        );

        -- 7. Category Quick Links
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            block_content, display_order, is_visible
        ) VALUES (
            piedmont_portal_id,
            'browse-categories',
            'Browse by Topic',
            NULL,
            'curated',
            'category_grid',
            'grid',
            8,
            '{
                "categories": [
                    {"id": "fitness", "label": "Fitness", "icon": "fitness"},
                    {"id": "learning", "label": "Education", "icon": "learning"},
                    {"id": "community", "label": "Support", "icon": "community"},
                    {"id": "family", "label": "Family", "icon": "family"}
                ]
            }',
            6,
            true
        );

        -- 8. Family & Maternity Programs
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            piedmont_portal_id,
            'family-programs',
            'Family & Parenting',
            'Programs for expectant and new parents',
            'auto',
            'event_list',
            'list',
            5,
            '{"categories": ["family"], "date_filter": "next_30_days", "sort_by": "date"}',
            7,
            true
        );

    END IF;
END $$;
