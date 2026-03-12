-- Arts Atlanta portal registration
-- Lost City: Arts — underground gallery vibes portal for Atlanta's art scene

-- Get the Atlanta parent portal ID
DO $$
DECLARE
  _atlanta_id uuid;
  _portal_id uuid;
BEGIN
  SELECT id INTO _atlanta_id FROM portals WHERE slug = 'atlanta';

  -- Insert the Arts portal
  INSERT INTO portals (
    slug, name, tagline, portal_type, status, visibility,
    plan, parent_portal_id,
    filters, branding, settings
  ) VALUES (
    'arts-atlanta',
    'Lost City: Arts',
    'what''s on the walls',
    'event',
    'active',
    'public',
    'professional',
    _atlanta_id,
    jsonb_build_object(
      'categories', jsonb_build_array('art', 'theater', 'community'),
      'tags', jsonb_build_array('visual-art', 'gallery', 'exhibition', 'sculpture', 'painting', 'photography', 'ceramics', 'printmaking', 'mixed-media', 'installation', 'mural', 'street-art')
    ),
    jsonb_build_object(
      'visual_preset', 'cosmic_dark',
      'theme_mode', 'dark',
      'primary_color', '#D4944C',
      'secondary_color', '#E8B931',
      'accent_color', '#D4567A',
      'background_color', '#12100E',
      'card_color', '#1A1714',
      'text_color', '#F5F0EB',
      'muted_color', '#6B6259',
      'border_color', '#2A2521',
      'button_color', '#D4944C',
      'button_text_color', '#12100E',
      'font_heading', 'Space Grotesk',
      'font_body', 'IBM Plex Mono',
      'header', jsonb_build_object(
        'template', 'standard',
        'logo_position', 'left',
        'nav_style', 'minimal',
        'show_search_in_header', true
      ),
      'ambient', jsonb_build_object(
        'effect', 'none',
        'intensity', 'subtle'
      ),
      'component_style', jsonb_build_object(
        'border_radius', 'none',
        'shadows', 'subtle',
        'card_style', 'outlined',
        'button_style', 'sharp',
        'glow_enabled', false,
        'glass_enabled', false,
        'animations', 'subtle'
      )
    ),
    jsonb_build_object(
      'vertical', 'arts',
      'show_categories', true,
      'show_map', false,
      'default_view', 'list',
      'exclude_adult', true,
      'nav_labels', jsonb_build_object(
        'feed', 'What''s On',
        'find', 'Browse',
        'community', 'Artists',
        'spots', 'Venues'
      )
    )
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    filters = EXCLUDED.filters,
    branding = EXCLUDED.branding,
    settings = EXCLUDED.settings,
    parent_portal_id = EXCLUDED.parent_portal_id,
    plan = EXCLUDED.plan
  RETURNING id INTO _portal_id;

  -- Subscribe to art sources (galleries, museums, studios, theaters, DIY spaces)
  INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
  SELECT _portal_id, s.id, 'all', true
  FROM sources s
  WHERE s.slug IN (
    -- Major museums & institutions
    'high-museum', 'atlanta-contemporary', 'moca-ga', 'hammonds-house',
    'clark-atlanta-art-museum', 'scad-atlanta', 'scad-fash',
    'callanwolde', 'callanwolde-fine-arts-center',
    'spruill-center-for-the-arts', 'hudgens-center',
    'carlos-museum', 'apex-museum', 'breman-museum',
    'millennium-gate', 'atlanta-history-center', 'civil-rights-center',
    -- Commercial galleries
    'marcia-wood-gallery', 'whitespace-gallery', 'kai-lin-art',
    'mason-fine-art', 'sandler-hudson', 'zucot-gallery',
    'poem88-gallery', 'abv-gallery', 'hathaway-contemporary', 'mint-gallery',
    -- Underground / DIY / artist-run
    'goat-farm', 'eyedrum', 'wonderroot', 'pushpush-arts',
    'flux-projects', 'supermarket-atl', 'the-bakery', 'pullman-yards',
    'four04-found-atl',
    -- Maker spaces & studios
    'mudfire', 'mudfire-pottery', 'atlanta-clay-works',
    'atlanta-craft-club', 'the-craftivist', 'needle-nook',
    'board-and-brush', 'painting-with-a-twist',
    -- Performance
    'puppetry-arts', 'horizon-theatre', 'shakespeare-tavern',
    'aurora-theatre', 'terminus-modern-ballet', 'terminus-mbt',
    'atlanta-workshop-players',
    -- Community arts orgs
    'chastain-arts', 'avondale-arts', 'doraville-art-center',
    'south-river-art', 'janke-studios', 'forefront-arts',
    'forward-warrior', 'hambidge',
    -- Festivals & fairs
    'atlanta-art-fair', 'elevate-atl-art', 'castleberry-art-stroll',
    'decatur-arts-festival', 'atlanta-dogwood',
    -- Cultural / specialty
    'trap-music-museum', 'oddities-museum', 'exhibition-hub', 'wrens-nest',
    -- Academic
    'georgia-tech-arts', 'emory-schwartz-center', 'agnes-scott',
    'oglethorpe-university', 'spelman-college',
    -- Arts media
    'arts-atl', 'artsatl',
    -- Film (arts-adjacent)
    'ajff', 'plaza-theatre'
  )
  AND s.is_active = true
  ON CONFLICT (subscriber_portal_id, source_id) DO NOTHING;

  RAISE NOTICE 'Arts Atlanta portal created/updated with id: %', _portal_id;
END $$;
