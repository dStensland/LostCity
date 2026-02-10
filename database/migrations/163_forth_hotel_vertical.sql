-- ============================================
-- MIGRATION 163: FORTH Hotel Concierge Portal
-- ============================================
-- FORTH Hotel Atlanta — Luxury hotel concierge using the new hotel vertical system
-- Uses settings.vertical = "hotel" which routes to the dedicated hotel feed
-- Light theme, serif headings, champagne gold accents, generous spacing
-- Location: Old Fourth Ward, BeltLine Eastside Trail (400 Dekalb Ave NE)

DO $$
DECLARE
    atlanta_portal_id UUID;
    forth_portal_id UUID;
BEGIN
    -- Look up Atlanta portal as parent (for federation)
    SELECT id INTO atlanta_portal_id FROM portals WHERE slug = 'atlanta';

    -- Insert the FORTH Hotel portal
    INSERT INTO portals (slug, name, tagline, portal_type, status, visibility, plan, parent_portal_id, filters, branding, settings)
    VALUES (
        'forth',
        'FORTH Hotel',
        'Your Evening, Curated',
        'business',
        'active',
        'public',
        'enterprise',
        atlanta_portal_id,
        '{
            "city": "Atlanta",
            "state": "GA",
            "geo_center": [33.7580, -84.3650],
            "geo_radius_km": 5,
            "exclude_adult": true
        }',
        '{
            "visual_preset": "custom",
            "theme_mode": "light",
            "primary_color": "#D4AF7A",
            "secondary_color": "#C9A88A",
            "accent_color": "#C9A96E",
            "background_color": "#FDFBF7",
            "text_color": "#2F2D2A",
            "muted_color": "#9B968C",
            "button_color": "#D4AF7A",
            "button_text_color": "#2F2D2A",
            "border_color": "#E8E4DD",
            "card_color": "#F5F3EE",
            "font_heading": "Cormorant Garamond",
            "font_body": "Inter",
            "header": {
                "template": "minimal",
                "logo_position": "left",
                "logo_size": "sm",
                "nav_style": "text",
                "show_search_in_header": true,
                "transparent_on_top": false
            },
            "ambient": {
                "effect": "none",
                "intensity": "off"
            },
            "component_style": {
                "border_radius": "lg",
                "shadows": "soft",
                "card_style": "flat",
                "button_style": "rounded",
                "glow_enabled": false,
                "glow_intensity": "off",
                "animations": "low",
                "glass_enabled": false
            }
        }',
        '{
            "vertical": "hotel",
            "show_map": false,
            "default_view": "feed",
            "show_categories": false,
            "show_neighborhoods": false,
            "icon_glow": false,
            "exclude_adult": true,
            "hide_attribution": false,
            "custom_footer_text": "Curated for FORTH Hotel guests",
            "sharing_brand_name": "FORTH Hotel",
            "meta_title": "FORTH Hotel Atlanta - Your Evening, Curated",
            "meta_description": "Discover the best events and experiences near FORTH Hotel in Old Fourth Ward, curated by your concierge team.",
            "nav_labels": {
                "feed": "Tonight",
                "events": "Events",
                "spots": "Explore"
            },
            "feed": {
                "feed_type": "sections",
                "show_activity_tab": false,
                "default_layout": "list",
                "items_per_section": 6
            }
        }'
    ) ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        tagline = EXCLUDED.tagline,
        portal_type = EXCLUDED.portal_type,
        plan = EXCLUDED.plan,
        parent_portal_id = EXCLUDED.parent_portal_id,
        filters = EXCLUDED.filters,
        branding = EXCLUDED.branding,
        settings = EXCLUDED.settings,
        status = 'active';

    -- Get the FORTH portal ID
    SELECT id INTO forth_portal_id FROM portals WHERE slug = 'forth';

    IF forth_portal_id IS NOT NULL THEN
        -- Delete existing sections to replace with new ones (idempotent)
        DELETE FROM portal_sections WHERE portal_id = forth_portal_id;

        -- The hotel vertical uses HotelFeed component directly (not portal_sections),
        -- but we still create sections for the curated picks and any future admin use.

        -- 1. Concierge Picks (curated by staff)
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            forth_portal_id,
            'our-picks',
            'Our Picks',
            'Handselected experiences for your stay',
            'auto',
            'event_cards',
            'grid',
            4,
            '{
                "sort_by": "popularity",
                "date_filter": "next_7_days"
            }',
            1,
            true
        );

        -- 2. This Evening (tonight's events)
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            forth_portal_id,
            'this-evening',
            'This Evening',
            'Events happening tonight',
            'auto',
            'event_list',
            'list',
            6,
            '{
                "date_filter": "today",
                "sort_by": "date"
            }',
            2,
            true
        );

        -- 3. Coming Up (this week)
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            forth_portal_id,
            'coming-up',
            'Coming Up',
            'Events this week',
            'auto',
            'event_cards',
            'grid',
            6,
            '{
                "date_filter": "next_7_days",
                "sort_by": "date"
            }',
            3,
            true
        );

        -- 4. Dining & Culinary
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            forth_portal_id,
            'dining',
            'Dining & Culinary',
            'Tastings, pop-ups, and culinary experiences nearby',
            'auto',
            'event_list',
            'list',
            4,
            '{
                "categories": ["food_drink"],
                "date_filter": "next_30_days",
                "sort_by": "date"
            }',
            4,
            true
        );

        -- 5. Complimentary Experiences (free events)
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            forth_portal_id,
            'complimentary',
            'Complimentary Experiences',
            'Free events and activities near the hotel',
            'auto',
            'event_list',
            'list',
            4,
            '{
                "is_free": true,
                "date_filter": "next_7_days",
                "sort_by": "date"
            }',
            5,
            true
        );

    END IF;
END $$;
