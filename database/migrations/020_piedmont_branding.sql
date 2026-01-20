-- ============================================
-- MIGRATION 020: Piedmont Portal Branding Update
-- ============================================
-- Updates Piedmont portal with proper brand colors and styling
-- Piedmont Healthcare brand: Teal green primary, clean healthcare aesthetic

UPDATE portals
SET branding = '{
    "primary_color": "#00838f",
    "secondary_color": "#1a3c40",
    "accent_color": "#26a69a",
    "background_color": "#0d1f22",
    "text_color": "#e0f2f1",
    "muted_color": "#80cbc4",
    "logo_url": null,
    "hero_image_url": null,
    "favicon_url": null,
    "og_image_url": null,
    "font_heading": null,
    "font_body": null,
    "theme_mode": "dark"
}'::jsonb,
tagline = 'Health & Wellness Events Across Metro Atlanta'
WHERE slug = 'piedmont';
