-- ============================================
-- MIGRATION 161: Hotel Concierge Demo Portal
-- ============================================
-- The Grand Hotel — Luxury hotel concierge white-label portal
-- Inherits all public Atlanta events via parent_portal_id federation
-- Dark luxury branding: gold on near-black, Playfair Display headings
-- Showcases enterprise features: custom attribution, footer, QR codes, analytics

DO $$
DECLARE
    atlanta_portal_id UUID;
    hotel_portal_id UUID;
BEGIN
    -- Look up Atlanta portal as parent
    SELECT id INTO atlanta_portal_id FROM portals WHERE slug = 'atlanta';

    -- Insert the hotel portal
    INSERT INTO portals (slug, name, tagline, portal_type, status, visibility, plan, parent_portal_id, filters, branding, settings)
    VALUES (
        'the-grand-hotel',
        'The Grand Hotel Atlanta',
        'Your concierge guide to Atlanta',
        'business',
        'active',
        'public',
        'enterprise',
        atlanta_portal_id,
        '{
            "city": "Atlanta",
            "state": "GA",
            "geo_center": [33.7590, -84.3880],
            "geo_radius_km": 15,
            "exclude_categories": ["fitness"],
            "exclude_adult": true
        }',
        '{
            "visual_preset": "custom",
            "theme_mode": "dark",
            "primary_color": "#C9A96E",
            "secondary_color": "#8B7355",
            "accent_color": "#E8D5B5",
            "background_color": "#0C0C0F",
            "text_color": "#F5F0E8",
            "muted_color": "#7A7670",
            "button_color": "#C9A96E",
            "button_text_color": "#0C0C0F",
            "border_color": "#1E1E24",
            "card_color": "#14141A",
            "font_heading": "Playfair Display",
            "font_body": "Inter",
            "hero_image_url": "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1920&q=80",
            "og_image_url": "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80",
            "header": {
                "template": "immersive",
                "logo_position": "center",
                "logo_size": "lg",
                "nav_style": "pills",
                "show_search_in_header": true,
                "transparent_on_top": true,
                "hero": {
                    "image_url": "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1920&q=80",
                    "height": "tall",
                    "overlay_opacity": 0.5,
                    "title_visible": true,
                    "tagline_visible": true
                }
            },
            "ambient": {
                "effect": "subtle_glow",
                "intensity": "low",
                "colors": {
                    "primary": "#C9A96E",
                    "secondary": "#8B7355"
                },
                "animation_speed": "slow"
            },
            "component_style": {
                "border_radius": "lg",
                "shadows": "elevated",
                "card_style": "glass",
                "button_style": "pill",
                "glow_enabled": true,
                "glow_intensity": "low",
                "animations": "medium",
                "glass_enabled": true
            }
        }',
        '{
            "show_map": true,
            "default_view": "list",
            "show_categories": true,
            "show_neighborhoods": true,
            "icon_glow": true,
            "exclude_adult": true,
            "hide_attribution": true,
            "custom_footer_text": "Curated by The Grand Hotel Atlanta",
            "custom_footer_links": [
                {"label": "Hotel Website", "url": "https://thegrandhotel.example.com"},
                {"label": "Room Service", "url": "https://thegrandhotel.example.com/room-service"},
                {"label": "Spa & Wellness", "url": "https://thegrandhotel.example.com/spa"}
            ],
            "sharing_brand_name": "The Grand Hotel",
            "meta_title": "The Grand Hotel Atlanta - Your Concierge Guide to the City",
            "meta_description": "Discover the best events, dining, and entertainment in Atlanta, curated by The Grand Hotel concierge team.",
            "nav_labels": {
                "feed": "Concierge",
                "events": "Events",
                "spots": "Nearby"
            },
            "hero": {
                "enabled": true,
                "title": "Welcome to Atlanta",
                "subtitle": "Your personal guide to the city''s finest experiences",
                "style": "luxury"
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

    -- Get the hotel portal ID
    SELECT id INTO hotel_portal_id FROM portals WHERE slug = 'the-grand-hotel';

    IF hotel_portal_id IS NOT NULL THEN
        -- Delete existing sections to replace with new ones (idempotent)
        DELETE FROM portal_sections WHERE portal_id = hotel_portal_id;

        -- 0. Welcome announcement
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            block_content, display_order, is_visible
        ) VALUES (
            hotel_portal_id,
            'welcome',
            'Welcome to Atlanta',
            'Your concierge guide to the best of the city',
            'curated',
            'announcement',
            'list',
            1,
            '{
                "body": "Welcome to The Grand Hotel Atlanta. Let us be your guide to the city''s finest experiences — from world-class dining and live music to art exhibitions and cultural festivals. Tap below to explore what''s happening tonight.",
                "cta_text": "Explore Events",
                "cta_url": "?view=find"
            }',
            0,
            true
        );

        -- 1. Featured / Tonight's Pick (hero banner)
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            hotel_portal_id,
            'tonights-pick',
            'Featured',
            'Hand-picked by your concierge',
            'auto',
            'hero_banner',
            'carousel',
            3,
            '{
                "sort_by": "popularity",
                "date_filter": "next_7_days"
            }',
            1,
            true
        );

        -- 2. Happening Today (event cards carousel)
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            hotel_portal_id,
            'happening-today',
            'Happening Today',
            'Events starting today',
            'auto',
            'event_cards',
            'carousel',
            12,
            '{
                "date_filter": "today",
                "sort_by": "date"
            }',
            2,
            true
        );

        -- 3. Explore Categories (category grid)
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            block_content, display_order, is_visible
        ) VALUES (
            hotel_portal_id,
            'explore-categories',
            'Explore Atlanta',
            'Browse by interest',
            'curated',
            'category_grid',
            'grid',
            8,
            '{
                "categories": [
                    {"name": "Dining", "slug": "food_drink", "icon": "utensils"},
                    {"name": "Music", "slug": "music", "icon": "music"},
                    {"name": "Art", "slug": "art", "icon": "palette"},
                    {"name": "Theater", "slug": "theater", "icon": "theater-masks"},
                    {"name": "Nightlife", "slug": "nightlife", "icon": "moon"},
                    {"name": "Comedy", "slug": "comedy", "icon": "laugh"},
                    {"name": "Sports", "slug": "sports", "icon": "trophy"},
                    {"name": "Culture", "slug": "community", "icon": "globe"}
                ]
            }',
            3,
            true
        );

        -- 4. This Weekend (event cards grid, only shows Wed-Sun)
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible,
            show_on_days
        ) VALUES (
            hotel_portal_id,
            'this-weekend',
            'This Weekend',
            'Plan your weekend in Atlanta',
            'auto',
            'event_cards',
            'grid',
            8,
            '{
                "date_filter": "this_weekend",
                "sort_by": "popularity"
            }',
            4,
            true,
            ARRAY['wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        );

        -- 5. Dining & Culinary (event list)
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            hotel_portal_id,
            'dining',
            'Dining & Culinary',
            'Tastings, pop-ups, and culinary experiences',
            'auto',
            'event_list',
            'list',
            6,
            '{
                "categories": ["food_drink"],
                "date_filter": "next_30_days",
                "sort_by": "date"
            }',
            5,
            true
        );

        -- 6. Live Music & Performances (event cards carousel)
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            hotel_portal_id,
            'live-music',
            'Live Music & Performances',
            'Concerts, shows, and live entertainment',
            'auto',
            'event_cards',
            'carousel',
            10,
            '{
                "categories": ["music", "theater"],
                "date_filter": "next_7_days",
                "sort_by": "date"
            }',
            6,
            true
        );

        -- 7. Arts & Culture (event list)
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            hotel_portal_id,
            'arts-culture',
            'Arts & Culture',
            'Galleries, exhibitions, and cultural events',
            'auto',
            'event_list',
            'list',
            6,
            '{
                "categories": ["art", "community"],
                "date_filter": "next_30_days",
                "sort_by": "date"
            }',
            7,
            true
        );

        -- 8. Hotel Amenities (announcement)
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            block_content, display_order, is_visible
        ) VALUES (
            hotel_portal_id,
            'hotel-services',
            'Hotel Amenities',
            'Make the most of your stay',
            'curated',
            'announcement',
            'list',
            1,
            '{
                "body": "Relax and rejuvenate during your stay. Our spa is open daily 7am-9pm, the rooftop pool from 6am-10pm, and The Terrace restaurant serves breakfast, lunch, and dinner. Contact the front desk for reservations.",
                "cta_text": "View All Amenities",
                "cta_url": "https://thegrandhotel.example.com/amenities"
            }',
            8,
            true
        );

        -- 9. Complimentary Experiences (free events)
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible
        ) VALUES (
            hotel_portal_id,
            'free-events',
            'Complimentary Experiences',
            'Free events and activities nearby',
            'auto',
            'event_list',
            'list',
            6,
            '{
                "is_free": true,
                "date_filter": "next_7_days",
                "sort_by": "date"
            }',
            9,
            true
        );

        -- 10. After Hours (event cards carousel, only after 8pm)
        INSERT INTO portal_sections (
            portal_id, slug, title, description,
            section_type, block_type, layout, max_items,
            auto_filter, display_order, is_visible,
            show_after_time
        ) VALUES (
            hotel_portal_id,
            'late-night',
            'After Hours',
            'Late-night entertainment and nightlife',
            'auto',
            'event_cards',
            'carousel',
            8,
            '{
                "categories": ["nightlife", "music", "comedy"],
                "date_filter": "today",
                "sort_by": "popularity"
            }',
            10,
            true,
            '20:00'
        );

    END IF;
END $$;
