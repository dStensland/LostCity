-- ============================================
-- MIGRATION 322: Hooky Family Portal
-- ============================================
-- Hooky is a family activity coordination portal for Metro Atlanta.
-- Surfaces family-friendly events, structured programs (camps, enrichment,
-- leagues, classes), and school calendar awareness.
-- Federated child of Atlanta portal — inherits family/community/outdoor events.
-- Status: draft — not yet live, pending content gates from PRD-035.

DO $$
DECLARE
    atlanta_portal_id UUID;
BEGIN
    SELECT id INTO atlanta_portal_id FROM portals WHERE slug = 'atlanta';

    INSERT INTO portals (
        slug, name, tagline, portal_type, status, visibility,
        plan, parent_portal_id, filters, branding, settings
    ) VALUES (
        'hooky',
        'Hooky',
        'Play hooky.',
        'city',
        'draft',
        'public',
        'starter',
        atlanta_portal_id,
        jsonb_build_object(
            'city', 'Atlanta',
            'state', 'GA',
            'geo_center', jsonb_build_array(33.749, -84.388),
            'geo_radius_km', 40,
            'categories', jsonb_build_array(
                'family', 'community', 'fitness', 'outdoor', 'learning', 'art'
            ),
            'exclude_categories', jsonb_build_array(
                'nightlife'
            ),
            'exclude_adult', true
        ),
        jsonb_build_object(
            'theme_mode', 'light',
            'primary_color', '#C48B1D',
            'secondary_color', '#7D8B72',
            'accent_color', '#C48B1D',
            'background_color', '#F3EEE8',
            'card_color', '#FFFFFF',
            'text_color', '#1F2023',
            'muted_color', '#9B9590',
            'border_color', '#E8E4DF',
            'button_color', '#C48B1D',
            'button_text_color', '#FFFFFF',
            'font_heading', 'Outfit',
            'font_body', 'DM Sans',
            'component_style', jsonb_build_object(
                'border_radius', 12,
                'shadows', 'soft',
                'card_style', 'flat',
                'glow_enabled', false,
                'glass_enabled', false,
                'animations', 'low'
            )
        ),
        jsonb_build_object(
            'vertical', 'family',
            'federation_scope', 'explicit_only',
            'meta_title', 'Hooky — Family Activities in Atlanta',
            'meta_description', 'Find family-friendly events, camps, enrichment programs, and activities for every age. Hooky helps Atlanta families answer "What are we doing this weekend?"',
            'exclude_adult', true,
            'show_map', true,
            'default_view', 'feed',
            'icon_glow', false,
            'nav_labels', jsonb_build_object(
                'feed', 'Weekend',
                'events', 'Activities',
                'spots', 'Places'
            ),
            'hero', jsonb_build_object(
                'enabled', true,
                'title', 'Hooky',
                'subtitle', 'Play hooky.',
                'style', 'standard'
            )
        )
    )
    ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        tagline = EXCLUDED.tagline,
        plan = EXCLUDED.plan,
        parent_portal_id = EXCLUDED.parent_portal_id,
        filters = EXCLUDED.filters,
        branding = EXCLUDED.branding,
        settings = EXCLUDED.settings;
        -- Intentionally NOT updating status — don't accidentally activate a draft

END $$;
