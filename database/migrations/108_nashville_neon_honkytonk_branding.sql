-- ============================================
-- MIGRATION 108: Nashville "Neon Honky-Tonk" Visual Identity
-- ============================================
-- Transforms Nashville portal into a distinctive Music City experience
-- that feels like stepping onto Broadway at night.
--
-- Design Direction: Hot pink neon + electric blue + whiskey amber
-- on deep midnight backgrounds with intense glow effects.
-- Captures: honky-tonk signs, stage lights, Ryman heritage, songwriter rounds

UPDATE portals
SET branding = '{
  "visual_preset": "custom",
  "theme_mode": "dark",

  "primary_color": "#FF1B8D",
  "secondary_color": "#00E5FF",
  "accent_color": "#FF9500",
  "background_color": "#0A0E1A",
  "text_color": "#FFF8E7",
  "muted_color": "#B8A993",
  "button_color": "#FF1B8D",
  "button_text_color": "#FFF8E7",
  "border_color": "#1A2038",
  "card_color": "#12172B",

  "font_heading": "Space Grotesk",
  "font_body": "Inter",

  "header": {
    "template": "standard",
    "logo_position": "left",
    "logo_size": "md",
    "nav_style": "pills",
    "show_search_in_header": true,
    "transparent_on_top": false
  },

  "ambient": {
    "effect": "aurora",
    "intensity": "bold",
    "colors": {
      "primary": "#FF1B8D",
      "secondary": "#00E5FF"
    },
    "animation_speed": "slow"
  },

  "component_style": {
    "border_radius": "lg",
    "shadows": "elevated",
    "card_style": "glass",
    "button_style": "pill",
    "glow_enabled": true,
    "glow_intensity": "intense",
    "animations": "medium",
    "glass_enabled": true
  },

  "category_colors": {
    "music": "#FF1B8D",
    "nightlife": "#9D00FF",
    "food_drink": "#FF9500",
    "comedy": "#FFB84D",
    "community": "#00E5FF",
    "art": "#FF6B00",
    "theater": "#FF66B2",
    "film": "#00E5FF",
    "sports": "#39FF14",
    "fitness": "#00D9A0",
    "family": "#FFB84D",
    "other": "#B8A993"
  }
}',
settings = '{
  "show_map": true,
  "default_view": "list",
  "show_categories": true,
  "show_neighborhoods": true,
  "icon_glow": true,
  "exclude_adult": false,
  "meta_title": "LostCity Nashville - Live Music, Events & Culture in Music City",
  "meta_description": "Discover the best events in Nashville - live music, songwriter rounds, hot chicken spots, and culture across Music City and the greater metro area.",
  "nav_labels": {
    "feed": "Tonight",
    "events": "Shows",
    "spots": "Honky-Tonks"
  },
  "hero": {
    "enabled": true,
    "title": "Music City Nights",
    "subtitle": "Live music, songwriter rounds & neon-lit adventure",
    "style": "music"
  },
  "feed": {
    "feed_type": "sections",
    "show_activity_tab": false,
    "default_layout": "list",
    "items_per_section": 6
  }
}'
WHERE slug = 'nashville';

-- ============================================
-- Update Atlanta to contrast with Nashville
-- ============================================
-- Atlanta: Urban, modern, diverse arts scene
-- Design: Coral + cyan on pure black, medium glow, elevated cards

UPDATE portals
SET branding = '{
  "visual_preset": "default",
  "theme_mode": "dark",

  "primary_color": "#FF6B7A",
  "secondary_color": "#00D4E8",
  "accent_color": "#FFD93D",
  "background_color": "#09090B",
  "text_color": "#FAFAF9",
  "muted_color": "#A1A1AA",
  "button_color": "#FF6B7A",
  "button_text_color": "#09090B",
  "border_color": "#27272A",
  "card_color": "#18181B",

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
    "effect": "flowing_streets",
    "intensity": "medium",
    "colors": {
      "primary": "#FF6B7A",
      "secondary": "#00D4E8"
    },
    "animation_speed": "medium"
  },

  "component_style": {
    "border_radius": "md",
    "shadows": "medium",
    "card_style": "elevated",
    "button_style": "default",
    "glow_enabled": true,
    "glow_intensity": "medium",
    "animations": "medium",
    "glass_enabled": false
  },

  "category_colors": {
    "music": "#FF6B7A",
    "nightlife": "#E855A0",
    "food_drink": "#FDBA74",
    "comedy": "#FCD34D",
    "community": "#00D4E8",
    "art": "#A5B4FC",
    "theater": "#C084FC",
    "film": "#60A5FA",
    "sports": "#4ADE80",
    "fitness": "#2DD4BF",
    "family": "#FCD34D",
    "other": "#A1A1AA"
  }
}'
WHERE slug = 'atlanta';

-- ============================================
-- Summary of Visual Contrast
-- ============================================
--
-- NASHVILLE (Neon Honky-Tonk):
--   Primary: Hot Pink (#FF1B8D) - Tootsie's neon
--   Secondary: Electric Blue (#00E5FF) - Broadway tubes
--   Accent: Whiskey Amber (#FF9500) - Stage lights
--   Background: Midnight Navy (#0A0E1A) - Night sky
--   Text: Warm Cream (#FFF8E7) - Vintage paper
--   Ambient: Aurora (bold, slow) - Neon pools
--   Cards: Glass with glow - Bar windows
--   Buttons: Pill shape - Jukebox aesthetic
--   Font: Space Grotesk - Vintage signage
--   Glow: INTENSE - Neon tubes
--
-- ATLANTA (Urban Arts Hub):
--   Primary: Coral (#FF6B7A) - Vibrant energy
--   Secondary: Cyan (#00D4E8) - Tech forward
--   Accent: Bright Gold (#FFD93D) - Urban gold
--   Background: Pure Black (#09090B) - Night void
--   Text: Cool White (#FAFAF9) - Clean modern
--   Ambient: Flowing Streets (medium) - Urban grid
--   Cards: Elevated solid - Strong foundations
--   Buttons: Default sharp - Modern edge
--   Font: Inter - Clean tech
--   Glow: MEDIUM - Subtle accents
--
-- The two cities should feel completely different:
-- Nashville = warm, vintage, neon-drenched, laid-back
-- Atlanta = cool, modern, diverse, energetic

COMMENT ON TABLE portals IS 'Nashville uses "Neon Honky-Tonk" visual identity (hot pink/electric blue/whiskey amber). Atlanta uses "Urban Arts Hub" identity (coral/cyan/gold). Each city portal should feel like its own world.';
