-- ============================================
-- MIGRATION 288: HelpATL Community Portal
-- ============================================
-- Atlanta volunteering & civic involvement portal
-- Surfaces volunteer opportunities, civic meetings, NPU sessions,
-- community cleanups, nonprofit events, and public engagement.
-- Federated child of Atlanta portal — inherits community/learning events
-- and adds dedicated volunteer/civic sources.

DO $$
DECLARE
    atlanta_portal_id UUID;
BEGIN
    SELECT id INTO atlanta_portal_id FROM portals WHERE slug = 'atlanta';

    INSERT INTO portals (
        slug, name, tagline, portal_type, status, visibility,
        parent_portal_id, filters, branding, settings
    ) VALUES (
        'helpatl',
        'HelpATL',
        'Volunteer, show up, shape your city.',
        'city',
        'active',
        'public',
        atlanta_portal_id,
        jsonb_build_object(
            'city', 'Atlanta',
            'state', 'GA',
            'geo_center', jsonb_build_array(33.749, -84.388),
            'geo_radius_km', 30,
            'categories', jsonb_build_array(
                'community', 'learning', 'fitness', 'family', 'outdoor'
            ),
            'exclude_categories', jsonb_build_array(
                'nightlife', 'film'
            ),
            'exclude_adult', true
        ),
        jsonb_build_object(
            'theme_mode', 'light',
            'primary_color', '#2D6A4F',
            'secondary_color', '#40916C',
            'accent_color', '#D4A373',
            'background_color', '#FAFAF5',
            'text_color', '#1B1B1B',
            'muted_color', '#6B7280',
            'button_color', '#2D6A4F',
            'button_text_color', '#FFFFFF',
            'border_color', '#D1D5DB',
            'card_color', '#FFFFFF',
            'font_heading', 'DM Sans',
            'font_body', 'Inter'
        ),
        jsonb_build_object(
            'vertical', 'community',
            'federation_scope', 'explicit_only',
            'meta_title', 'HelpATL — Volunteer & Civic Engagement in Atlanta',
            'meta_description', 'Find volunteer opportunities, civic meetings, community cleanups, and ways to shape Atlanta. One place for everything happening that needs your help.',
            'icon_glow', false,
            'exclude_adult', true,
            'show_map', true,
            'default_view', 'feed',
            'nav_labels', jsonb_build_object(
                'feed', 'Feed',
                'events', 'Opportunities',
                'spots', 'Organizations'
            ),
            'hero', jsonb_build_object(
                'enabled', true,
                'title', 'HelpATL',
                'subtitle', 'Volunteer, show up, shape your city.',
                'style', 'standard'
            )
        )
    )
    ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        tagline = EXCLUDED.tagline,
        parent_portal_id = EXCLUDED.parent_portal_id,
        filters = EXCLUDED.filters,
        branding = EXCLUDED.branding,
        settings = EXCLUDED.settings,
        status = EXCLUDED.status;

END $$;
