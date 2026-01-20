-- ============================================
-- MIGRATION 020: Update Piedmont Healthcare Branding
-- Match official Piedmont Healthcare brand colors and fonts
-- ============================================

UPDATE portals
SET branding = '{
    "theme_mode": "light",
    "primary_color": "#8B3A2F",
    "secondary_color": "#E5E5E5",
    "accent_color": "#8B3A2F",
    "background_color": "#FFFFFF",
    "text_color": "#1A1A1A",
    "muted_color": "#6B7280",
    "button_color": "#8B3A2F",
    "button_text_color": "#FFFFFF",
    "border_color": "#E5E5E5",
    "card_color": "#F9FAFB",
    "font_heading": "Georgia",
    "font_body": "Inter"
}'::jsonb
WHERE slug = 'piedmont';
