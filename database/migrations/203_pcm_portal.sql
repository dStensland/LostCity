-- Ponce City Market demo portal
-- Marketplace vertical: mixed-use development with tenant directory, events, and neighborhood context

INSERT INTO portals (
  slug,
  name,
  tagline,
  portal_type,
  status,
  visibility,
  filters,
  branding,
  settings
) VALUES (
  'ponce-city-market-demo',
  'Ponce City Market',
  'Atlanta''s iconic market on the BeltLine — food, shops, rooftop views, and neighborhood culture.',
  'business',
  'active',
  'public',
  jsonb_build_object(
    'city', 'Atlanta',
    'geo_center', jsonb_build_array(33.7726, -84.3655),
    'geo_radius_km', 0.5,
    'tags', jsonb_build_array('ponce-city-market')
  ),
  jsonb_build_object(
    'theme_mode', 'light',
    'primary_color', '#B5674A',
    'secondary_color', '#5A8C5F',
    'accent_color', '#C8944A',
    'background_color', '#FBF8F3',
    'text_color', '#2C2824',
    'muted_color', '#7A8A94',
    'button_color', '#B5674A',
    'button_text_color', '#FBF8F3',
    'border_color', '#E4DDD2',
    'card_color', '#F3EDE4',
    'font_heading', 'Playfair Display',
    'font_body', 'DM Sans'
  ),
  jsonb_build_object(
    'vertical', 'marketplace',
    'meta_description', 'Ponce City Market — Atlanta''s iconic mixed-use market on the BeltLine. Live events, 30+ restaurants and bars, The Roof, and Old Fourth Ward neighborhood culture.',
    'icon_glow', false,
    'exclude_adult', true
  )
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  filters = EXCLUDED.filters,
  branding = EXCLUDED.branding,
  settings = EXCLUDED.settings,
  status = EXCLUDED.status;
