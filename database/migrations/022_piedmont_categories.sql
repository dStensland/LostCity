-- ============================================
-- MIGRATION 022: Piedmont Portal Category Filters
-- ============================================
-- Configures Piedmont portal to show only healthcare-relevant categories
-- and updates branding to light theme with Piedmont brand colors

-- Update filters to include only healthcare-relevant categories
UPDATE portals
SET filters = jsonb_set(
    filters,
    '{categories}',
    '["fitness", "wellness", "community", "family", "learning", "meetup", "outdoors"]'::jsonb
)
WHERE slug = 'piedmont';

-- Update branding to Piedmont's actual brand colors (light theme)
-- Colors extracted from Piedmont logo: #2D2A26 (charcoal), #BE3527 (red), #FBB923 (yellow), #F89821 (orange)
UPDATE portals
SET branding = '{
    "logo_url": "https://www.piedmont.org/-/media/merge/logo_piedmontlogo.svg",
    "primary_color": "#BE3527",
    "secondary_color": "#2D2A26",
    "accent_color": "#F89821",
    "background_color": "#FFFFFF",
    "text_color": "#2D2A26",
    "muted_color": "#6B7280",
    "button_color": "#BE3527",
    "button_text_color": "#FFFFFF",
    "border_color": "#E5E7EB",
    "card_color": "#F9FAFB",
    "font_heading": "DM Sans",
    "font_body": "DM Sans",
    "theme_mode": "light"
}'::jsonb
WHERE slug = 'piedmont';

-- Update nav labels for healthcare context
UPDATE portals
SET settings = jsonb_set(
    settings,
    '{nav_labels}',
    '{
        "feed": "For You",
        "events": "Classes & Events",
        "spots": "Locations",
        "happening_now": "Today"
    }'::jsonb
)
WHERE slug = 'piedmont';
