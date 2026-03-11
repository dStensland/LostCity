-- Restore the base HelpATL portal row when environments have later HelpATL
-- subscriptions/settings migrations applied but are missing the actual
-- `portals.slug = 'helpatl'` record.
--
-- This is intentionally idempotent. It restores the minimum current portal
-- contract so the frontend route resolves and provisioning can be rerun.

DO $$
DECLARE
    atlanta_portal_id UUID;
BEGIN
    SELECT id INTO atlanta_portal_id FROM portals WHERE slug = 'atlanta';

    INSERT INTO portals (
        slug, name, tagline, portal_type, status, visibility,
        plan, parent_portal_id, filters, branding, settings
    ) VALUES (
        'helpatl',
        'HelpATL',
        'Volunteer this week, join longer-term causes, and follow Atlanta civic action',
        'city',
        'active',
        'public',
        'professional',
        atlanta_portal_id,
        jsonb_build_object(
            'city', 'Atlanta',
            'state', 'GA',
            'geo_center', jsonb_build_array(33.749, -84.388),
            'geo_radius_km', 30,
            'categories', jsonb_build_array(
                'community', 'learning', 'family'
            ),
            'exclude_categories', jsonb_build_array(
                'nightlife'
            ),
            'exclude_adult', true
        ),
        jsonb_build_object(
            'visual_preset', 'editorial_light',
            'theme_mode', 'light',
            'primary_color', '#0f766e',
            'secondary_color', '#1d4ed8',
            'accent_color', '#ea580c',
            'background_color', '#f8fafc',
            'text_color', '#0f172a',
            'button_color', '#0f766e',
            'button_text_color', '#ffffff',
            'font_heading', 'Sora',
            'font_body', 'Manrope'
        ),
        jsonb_build_object(
            'vertical', 'community',
            'federation_scope', 'explicit_only',
            'show_categories', true,
            'show_map', false,
            'default_view', 'list',
            'icon_glow', false,
            'exclude_adult', true,
            'meta_title', 'HelpATL — Volunteer & Civic Engagement in Atlanta',
            'meta_description', 'Find volunteer opportunities, civic meetings, and community action in Atlanta.',
            'nav_labels', jsonb_build_object(
                'feed', 'Act',
                'find', 'Calendar',
                'community', 'Groups',
                'events', 'Calendar',
                'spots', 'Community Spots'
            )
        )
    )
    ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        tagline = EXCLUDED.tagline,
        status = EXCLUDED.status,
        visibility = EXCLUDED.visibility,
        plan = EXCLUDED.plan,
        parent_portal_id = EXCLUDED.parent_portal_id,
        filters = EXCLUDED.filters,
        branding = EXCLUDED.branding,
        settings = COALESCE(portals.settings, '{}'::jsonb) || EXCLUDED.settings,
        updated_at = now();
END $$;
