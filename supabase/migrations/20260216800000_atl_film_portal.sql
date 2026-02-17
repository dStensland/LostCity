-- ============================================
-- MIGRATION: ATL Film Portal
-- ============================================
-- Creates the atl-film portal, a business-type demo portal showcasing
-- Atlanta's independent cinema and film festival scene.
--
-- Portal type: business
-- Vertical: film
-- Branding: Film noir aesthetic (dark theme, warm gold accents, cinema red)
-- Coverage: Film screenings, festivals, and cinema events in Atlanta
--
-- Film sources to subscribe:
-- - plaza-theatre (Plaza Theatre - indie/repertory cinema)
-- - tara-theatre (Tara Theatre)
-- - springs-cinema (Springs Cinema)
-- - landmark-midtown (Landmark Midtown Art Cinema)
-- - atlanta-film-festival (Atlanta Film Festival)
-- - out-on-film (Out On Film - LGBTQ+ film festival)
-- - ajff (Atlanta Jewish Film Festival)
-- - atlanta-film-society (Atlanta Film Society)
-- - atlanta-film-series (Atlanta Film Series)
-- - wewatchstuff (WeWatchStuff - community film screenings)
--
-- Feed sections:
-- 1. Now Showing - Events in next 7 days
-- 2. Coming Soon - Events 7-30 days out
-- 3. Film Festivals - Festival events
-- 4. Free Screenings - Free film events

DO $$
DECLARE
    atlanta_portal_id UUID;
    film_portal_id UUID;
BEGIN
    -- Look up Atlanta portal as parent
    SELECT id INTO atlanta_portal_id FROM portals WHERE slug = 'atlanta';

    IF atlanta_portal_id IS NULL THEN
        RAISE EXCEPTION 'Atlanta portal not found. Cannot create atl-film portal without parent.';
    END IF;

    -- Insert the ATL Film portal
    INSERT INTO portals (
        slug,
        name,
        tagline,
        portal_type,
        status,
        visibility,
        plan,
        parent_portal_id,
        filters,
        branding,
        settings
    )
    VALUES (
        'atl-film',
        'ATL Film',
        'Atlanta''s independent cinema and film festival hub',
        'business',
        'active',
        'public',
        'professional',
        atlanta_portal_id,
        '{
            "city": "Atlanta",
            "state": "GA",
            "categories": ["film"]
        }',
        '{
            "visual_preset": "custom",
            "theme_mode": "dark",
            "primary_color": "#E8D5B7",
            "secondary_color": "#8B7355",
            "accent_color": "#C41E3A",
            "background_color": "#0A0A0A",
            "text_color": "#F5F0E8",
            "muted_color": "#7A7670",
            "button_color": "#E8D5B7",
            "button_text_color": "#0A0A0A",
            "border_color": "#1E1E24",
            "card_color": "#14141A",
            "font_heading": "Cormorant Garamond",
            "font_body": "Inter",
            "header": {
                "template": "standard",
                "logo_position": "left",
                "logo_size": "md",
                "nav_style": "text",
                "show_search_in_header": true,
                "transparent_on_top": false
            },
            "ambient": {
                "effect": "none",
                "intensity": "off"
            },
            "component_style": {
                "border_radius": "sm",
                "shadows": "soft",
                "card_style": "glass",
                "button_style": "rounded",
                "glow_enabled": false,
                "animations": "low",
                "glass_enabled": true
            }
        }',
        '{
            "vertical": "film",
            "meta_title": "ATL Film - Atlanta Independent Cinema & Film Festivals",
            "meta_description": "Discover independent films, repertory screenings, and film festivals in Atlanta. From Plaza Theatre to AJFF.",
            "nav_labels": {
                "feed": "Now Showing",
                "events": "Browse",
                "spots": "Cinemas"
            },
            "default_view": "feed",
            "show_map": true,
            "show_categories": false,
            "show_neighborhoods": true,
            "icon_glow": false,
            "exclude_adult": false,
            "hide_attribution": false,
            "custom_footer_text": "Atlanta''s cinema guide",
            "sharing_brand_name": "ATL Film",
            "feed": {
                "feed_type": "sections",
                "show_activity_tab": false,
                "default_layout": "list",
                "items_per_section": 8
            }
        }'
    )
    ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        tagline = EXCLUDED.tagline,
        portal_type = EXCLUDED.portal_type,
        plan = EXCLUDED.plan,
        parent_portal_id = EXCLUDED.parent_portal_id,
        filters = EXCLUDED.filters,
        branding = EXCLUDED.branding,
        settings = EXCLUDED.settings,
        status = 'active';

    -- Get the film portal ID
    SELECT id INTO film_portal_id FROM portals WHERE slug = 'atl-film';

    IF film_portal_id IS NOT NULL THEN
        -- Subscribe to film event sources
        INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
        SELECT film_portal_id, s.id, 'all', true
        FROM sources s
        WHERE s.slug IN (
            'plaza-theatre',
            'tara-theatre',
            'springs-cinema',
            'landmark-midtown',
            'atlanta-film-festival',
            'out-on-film',
            'ajff',
            'atlanta-film-society',
            'atlanta-film-series',
            'wewatchstuff'
        )
        ON CONFLICT (subscriber_portal_id, source_id) DO NOTHING;

        -- Delete existing sections to replace with new ones (idempotent)
        DELETE FROM portal_sections WHERE portal_id = film_portal_id;

        -- Section 1: Now Showing (next 7 days)
        INSERT INTO portal_sections (
            portal_id,
            slug,
            title,
            description,
            section_type,
            block_type,
            layout,
            max_items,
            auto_filter,
            display_order,
            is_visible
        )
        VALUES (
            film_portal_id,
            'now-showing',
            'Now Showing',
            'Films screening in the next week',
            'auto',
            'event_cards',
            'grid',
            12,
            '{
                "categories": ["film"],
                "date_filter": "next_7_days",
                "sort_by": "date"
            }',
            1,
            true
        );

        -- Section 2: Coming Soon (7-30 days out)
        INSERT INTO portal_sections (
            portal_id,
            slug,
            title,
            description,
            section_type,
            block_type,
            layout,
            max_items,
            auto_filter,
            display_order,
            is_visible
        )
        VALUES (
            film_portal_id,
            'coming-soon',
            'Coming Soon',
            'Films screening later this month',
            'auto',
            'event_list',
            'list',
            8,
            '{
                "categories": ["film"],
                "date_filter": "next_30_days",
                "exclude_date_filter": "next_7_days",
                "sort_by": "date"
            }',
            2,
            true
        );

        -- Section 3: Film Festivals
        INSERT INTO portal_sections (
            portal_id,
            slug,
            title,
            description,
            section_type,
            block_type,
            layout,
            max_items,
            auto_filter,
            display_order,
            is_visible
        )
        VALUES (
            film_portal_id,
            'film-festivals',
            'Film Festivals',
            'Festival screenings and special events',
            'auto',
            'event_cards',
            'carousel',
            8,
            '{
                "categories": ["film"],
                "tags": ["festival"],
                "date_filter": "next_90_days",
                "sort_by": "date"
            }',
            3,
            true
        );

        -- Section 4: Free Screenings
        INSERT INTO portal_sections (
            portal_id,
            slug,
            title,
            description,
            section_type,
            block_type,
            layout,
            max_items,
            auto_filter,
            display_order,
            is_visible
        )
        VALUES (
            film_portal_id,
            'free-screenings',
            'Free Screenings',
            'Free film events and community screenings',
            'auto',
            'event_list',
            'list',
            6,
            '{
                "categories": ["film"],
                "is_free": true,
                "date_filter": "next_30_days",
                "sort_by": "date"
            }',
            4,
            true
        );

    END IF;

    RAISE NOTICE 'ATL Film portal created successfully with ID: %', film_portal_id;

END $$;
