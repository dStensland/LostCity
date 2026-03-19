-- ============================================
-- MIGRATION 516: Activate Adventure Portal (Lost Track)
-- ============================================
-- Sets vertical_slug and city_slug on the yonder portal
-- so that adventure.lostcity.ai/atlanta resolves correctly via subdomain routing.
--
-- Portal design: Nordic Brutalist (Space Grotesk, terracotta, sharp corners)
-- Prerequisites:
--   - Portal 'yonder' exists
--   - Migration 504 (portal_subdomain_routing — vertical_slug/city_slug columns)

UPDATE portals
SET status = 'active',
    vertical_slug = 'adventure',
    city_slug = 'atlanta',
    name = 'Lost Track',
    tagline = 'wander over yonder',
    settings = jsonb_set(
      COALESCE(settings, '{}'::jsonb),
      '{vertical}',
      '"adventure"'
    ),
    branding = jsonb_build_object(
      'header', jsonb_build_object(
        'template', 'branded',
        'logo_size', 'lg',
        'nav_style', 'pills',
        'logo_position', 'left',
        'transparent_on_top', false,
        'show_search_in_header', true
      ),
      'ambient', jsonb_build_object('effect', 'none', 'intensity', 'none'),
      'font_body', 'Inter',
      'font_heading', 'Space Grotesk',
      'card_color', '#FFFFFF',
      'text_color', '#1A1A1A',
      'theme_mode', 'light',
      'muted_color', '#8B8178',
      'accent_color', '#C45A3B',
      'border_color', '#1A1A1A',
      'button_color', '#C45A3B',
      'primary_color', '#C45A3B',
      'secondary_color', '#6B8E5E',
      'visual_preset', 'nordic_brutalist',
      'background_color', '#F5F2ED',
      'button_text_color', '#ffffff',
      'component_style', jsonb_build_object(
        'shadows', 'none',
        'card_style', 'bordered',
        'button_style', 'default',
        'glow_enabled', false,
        'border_radius', 'none',
        'glass_enabled', false
      )
    )
WHERE slug = 'yonder';
