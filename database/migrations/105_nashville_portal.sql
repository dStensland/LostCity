-- ============================================
-- MIGRATION 105: Nashville Metro Portal
-- ============================================

-- Nashville Metro Portal (city type)
-- Music City USA - Live music capital, honky-tonks, songwriter culture, hot chicken
-- Coverage: 14-county Nashville metro area, 2.15M population
-- Key areas: Downtown/Broadway, East Nashville (indie/creative), The Gulch, Germantown, 12 South
INSERT INTO portals (slug, name, tagline, portal_type, status, visibility, filters, branding, settings)
VALUES (
    'nashville',
    'LostCity Nashville',
    'Live music, hot chicken & culture in Music City',
    'city',
    'active',
    'public',
    '{
        "city": "Nashville",
        "cities": [
            "Nashville",
            "Murfreesboro",
            "Franklin",
            "Hendersonville",
            "Spring Hill",
            "Smyrna",
            "Gallatin",
            "Lebanon",
            "Brentwood",
            "Mount Juliet",
            "La Vergne",
            "Goodlettsville"
        ],
        "state": "TN",
        "geo_center": [36.1627, -86.7816],
        "geo_radius_km": 50,
        "neighborhoods": [
            "Downtown",
            "East Nashville",
            "The Gulch",
            "Germantown",
            "12 South",
            "Midtown",
            "Music Row",
            "Green Hills",
            "Belle Meade",
            "Hillsboro Village",
            "Sylvan Park",
            "The Nations",
            "Antioch",
            "Donelson",
            "Berry Hill",
            "SoBro"
        ]
    }',
    '{
        "visual_preset": "nashville_music",
        "theme_mode": "dark",
        "primary_color": "#D4A574",
        "secondary_color": "#4ECDC4",
        "accent_color": "#FF6B6B",
        "background_color": "#1A1F3A",
        "text_color": "#F5EFE6",
        "muted_color": "#8B95A5",
        "button_color": "#D4A574",
        "button_text_color": "#1A1F3A",
        "border_color": "#2A3555",
        "card_color": "#242B47",
        "font_heading": "Inter",
        "font_body": "Inter",
        "header": {
            "template": "standard",
            "logo_position": "left",
            "logo_size": "md",
            "nav_style": "tabs",
            "show_search_in_header": true,
            "transparent_on_top": false
        },
        "ambient": {
            "effect": "gradient_wave",
            "intensity": "medium",
            "colors": {
                "primary": "#D4A574",
                "secondary": "#4ECDC4"
            },
            "animation_speed": "slow"
        },
        "component_style": {
            "border_radius": "lg",
            "shadows": "elevated",
            "card_style": "elevated",
            "button_style": "rounded",
            "glow_enabled": true,
            "glow_intensity": "medium",
            "animations": "medium",
            "glass_enabled": false
        }
    }',
    '{
        "show_map": true,
        "default_view": "list",
        "show_categories": true,
        "show_neighborhoods": true,
        "icon_glow": true,
        "exclude_adult": false,
        "meta_title": "LostCity Nashville - Live Music, Events & Culture in Music City",
        "meta_description": "Discover the best events in Nashville - live music, songwriter rounds, hot chicken spots, and culture across Music City and the greater metro area.",
        "nav_labels": {
            "feed": "Feed",
            "events": "Events",
            "spots": "Places"
        },
        "hero": {
            "enabled": true,
            "title": "Music City Nights",
            "subtitle": "Live music, songwriter rounds & culture in Nashville",
            "style": "music"
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
    filters = EXCLUDED.filters,
    branding = EXCLUDED.branding,
    settings = EXCLUDED.settings,
    status = 'active';

-- ============================================
-- Portal Sections for Nashville
-- ============================================

DO $$
DECLARE
    nashville_portal_id UUID;
BEGIN
    SELECT id INTO nashville_portal_id FROM portals WHERE slug = 'nashville';

    IF nashville_portal_id IS NOT NULL THEN
        -- Delete existing sections to replace with new ones
        DELETE FROM portal_sections WHERE portal_id = nashville_portal_id;

        -- 1. Live Tonight - Real-time events starting within 2 hours
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            nashville_portal_id,
            'live_tonight',
            'Live Tonight',
            'Starting within 2 hours',
            'auto',
            'event_cards',
            'carousel',
            12,
            '{
                "categories": ["music", "nightlife"],
                "date_filter": "today",
                "sort_by": "date",
                "time_range": {
                    "start_within_hours": 2
                }
            }',
            0,
            true
        );

        -- 2. Broadway & Honky-Tonks - Downtown tourist district
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            nashville_portal_id,
            'broadway_honkytonks',
            'Broadway & Honky-Tonks',
            'The famous downtown strip',
            'auto',
            'event_cards',
            'grid',
            6,
            '{
                "categories": ["music", "nightlife"],
                "neighborhoods": ["Downtown", "SoBro"],
                "date_filter": "next_7_days",
                "sort_by": "popularity"
            }',
            1,
            true
        );

        -- 3. East Nashville Picks - Creative/indie scene
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            nashville_portal_id,
            'east_nashville',
            'East Nashville Picks',
            'Creative and indie scene',
            'auto',
            'event_cards',
            'carousel',
            8,
            '{
                "neighborhoods": ["East Nashville"],
                "date_filter": "next_7_days",
                "sort_by": "date"
            }',
            2,
            true
        );

        -- 4. This Weekend - Planning ahead
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            nashville_portal_id,
            'this_weekend',
            'This Weekend',
            'Plan your weekend in Nashville',
            'auto',
            'event_list',
            'list',
            10,
            '{
                "date_filter": "this_weekend",
                "sort_by": "popularity"
            }',
            3,
            true
        );

        -- 5. Songwriter Rounds - Nashville-unique format
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            nashville_portal_id,
            'songwriter_rounds',
            'Songwriter Rounds',
            'Experience Nashville''s signature format',
            'auto',
            'event_list',
            'list',
            6,
            '{
                "categories": ["music"],
                "tags": ["songwriter", "acoustic", "songwriter-round"],
                "date_filter": "next_30_days",
                "sort_by": "date"
            }',
            4,
            true
        );

        -- 6. Food & Drink Events - Tastings, festivals, openings
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            nashville_portal_id,
            'food_drink',
            'Food & Drink Events',
            'Hot chicken, tastings & culinary experiences',
            'auto',
            'event_cards',
            'grid',
            6,
            '{
                "categories": ["food_drink"],
                "date_filter": "next_30_days",
                "sort_by": "date"
            }',
            5,
            true
        );

    END IF;
END $$;

-- Add comment documenting Nashville Metro coverage
COMMENT ON TABLE portals IS 'Nashville Metro portal covers 14-county metropolitan area (2.15M population): Davidson, Williamson, Rutherford, Wilson, Sumner, Cheatham, Robertson, Dickson, Cannon, Macon, Smith, Trousdale, Maury, and Hickman counties. Music City serves as Tennessee''s cultural and economic center with extensive live music infrastructure.';
