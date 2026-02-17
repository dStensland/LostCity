-- Seed script: Create the atl-dogs portal record
-- Run against Supabase: supabase db execute < supabase/seed-dog-portal.sql

INSERT INTO portals (
  slug,
  name,
  tagline,
  portal_type,
  status,
  visibility,
  settings,
  filters,
  branding,
  content
) VALUES (
  'atl-dogs',
  'ROMP',
  'All the dog-friendly stuff in Atlanta.',
  'city',
  'active',
  'public',
  '{
    "vertical": "dog",
    "meta_description": "Discover dog-friendly events, parks, patios, and services in Atlanta."
  }'::jsonb,
  '{
    "tags": ["pets", "dog-friendly", "adoption", "dog-training", "off-leash"],
    "vibes": ["dog-friendly"],
    "geo_center": [33.7490, -84.3880],
    "geo_radius_km": 25
  }'::jsonb,
  '{
    "visual_preset": "custom",
    "primary_color": "#FF6B35",
    "secondary_color": "#F7931E",
    "accent_color": "#06BCC1",
    "background_color": "#FFFBEB",
    "text_color": "#292524",
    "muted_color": "#78716C",
    "border_color": "#FDE68A",
    "card_color": "#FFFFFF",
    "button_color": "#FF6B35",
    "button_text_color": "#FFFFFF",
    "font_heading": "Baloo 2",
    "font_body": "Inter",
    "theme_mode": "light",
    "header": {
      "template": "branded",
      "logo_position": "left",
      "logo_size": "lg",
      "nav_style": "pills",
      "transparent_on_top": false
    },
    "component_style": {
      "border_radius": "xl",
      "shadows": "medium",
      "card_style": "elevated",
      "button_style": "pill",
      "glow_enabled": false,
      "glass_enabled": false,
      "animations": "full"
    },
    "category_colors": {
      "events": "#FF6F59",
      "parks": "#FFD23F",
      "services": "#06BCC1",
      "trails": "#059669"
    }
  }'::jsonb,
  '{
    "hero": {
      "headline": "SNIFF. PLAY. REPEAT.",
      "subhead": "All the dog-friendly stuff in Atlanta.",
      "cta_text": "Explore the map",
      "cta_url": "?view=map",
      "image_url": null
    },
    "sections": [
      {"type": "this_weekend",    "title": "This Weekend",       "visible": true, "order": 1},
      {"type": "parks_nearby",    "title": "Dog Parks Near You",  "visible": true, "order": 2},
      {"type": "new_spots",       "title": "New Spots",           "visible": true, "order": 3},
      {"type": "curated_lists",   "title": "Lists",               "visible": true, "order": 4},
      {"type": "happening_today", "title": "Happening Today",     "visible": true, "order": 5},
      {"type": "trails",          "title": "Trails & Nature",     "visible": true, "order": 6},
      {"type": "community_tag",   "title": "Know a spot?",        "visible": true, "order": 7}
    ],
    "featured": [],
    "curated_lists": [],
    "announcements": [],
    "sponsors": []
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  settings = EXCLUDED.settings,
  filters = EXCLUDED.filters,
  branding = EXCLUDED.branding,
  content = EXCLUDED.content;
