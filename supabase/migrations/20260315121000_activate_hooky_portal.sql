-- ============================================
-- MIGRATION: Activate Family Portal Subdomain Routing
-- ============================================
-- Sets vertical_slug and city_slug on the atlanta-families portal
-- so that family.lostcity.ai/atlanta resolves correctly via subdomain routing.
-- Spring break for all metro Atlanta school systems: April 6–10, 2026.
--
-- Portal branding (Afternoon Field palette):
--   primary_color: #C48B1D (amber/honey)
--   secondary_color: #7D8B72 (sage green)
--   font_heading: Outfit, font_body: DM Sans
--
-- Prerequisites:
--   - Portal 'atlanta-families' exists (already active)
--   - Migration 504 (portal_subdomain_routing — vertical_slug/city_slug columns)

UPDATE portals
SET vertical_slug = 'family',
    city_slug = 'atlanta',
    name = 'Lost Youth',
    tagline = 'play hooky',
    settings = jsonb_set(
      COALESCE(settings, '{}'::jsonb),
      '{vertical}',
      '"family"'
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
      'font_body', 'DM Sans',
      'font_heading', 'Outfit',
      'card_color', '#FAFAF6',
      'text_color', '#1E2820',
      'theme_mode', 'light',
      'muted_color', '#756E63',
      'accent_color', '#C48B1D',
      'border_color', '#E0DDD4',
      'button_color', '#5E7A5E',
      'primary_color', '#5E7A5E',
      'secondary_color', '#C48B1D',
      'visual_preset', 'afternoon_field',
      'background_color', '#F0EDE4',
      'button_text_color', '#ffffff',
      'component_style', jsonb_build_object(
        'shadows', 'subtle',
        'card_style', 'elevated',
        'button_style', 'pill',
        'glow_enabled', false,
        'border_radius', 'xl',
        'glass_enabled', false
      )
    )
WHERE slug = 'atlanta-families';
