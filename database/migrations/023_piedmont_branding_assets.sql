-- ============================================
-- MIGRATION 023: Piedmont Branding Assets & Settings
-- ============================================
-- Adds missing branding assets and configures feed settings for Piedmont portal

-- Add branding assets (hero image, favicon, open graph image)
UPDATE portals
SET branding = branding || '{
    "hero_image_url": null,
    "favicon_url": "https://www.piedmont.org/favicon.ico",
    "og_image_url": "https://www.piedmont.org/-/media/merge/logo_piedmontlogo.svg",
    "primary_light": "#D4A59A"
}'::jsonb
WHERE slug = 'piedmont';

-- Configure feed settings (hide_images for portals without good image data)
UPDATE portals
SET settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{feed}',
    COALESCE(settings->'feed', '{}'::jsonb) || '{
        "hide_images": true
    }'::jsonb
)
WHERE slug = 'piedmont';
