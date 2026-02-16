-- Add "Going Out Tonight" nightlife feed section for Atlanta portal
-- Renders as a nightlife_carousel (stylized category preview cards) via the feed API
DO $$
DECLARE
    atlanta_portal_id UUID;
BEGIN
    SELECT id INTO atlanta_portal_id FROM portals WHERE slug = 'atlanta' LIMIT 1;

    IF atlanta_portal_id IS NULL THEN
        RAISE NOTICE 'Atlanta portal not found, skipping nightlife section';
        RETURN;
    END IF;

    -- Insert nightlife section at position 0 (first regular section, above Live Music)
    -- block_type is event_cards in DB; the feed API converts to nightlife_carousel
    -- with category breakdown when nightlife_mode is set
    INSERT INTO portal_sections (
        portal_id, slug, title, description,
        section_type, block_type, layout, max_items,
        auto_filter, display_order, is_visible,
        show_after_time,
        style
    ) VALUES (
        atlanta_portal_id,
        'nightlife-tonight',
        'Going Out Tonight',
        'Bars, clubs, karaoke, trivia & more',
        'auto',
        'event_cards',
        'grid',
        12,
        '{"nightlife_mode": true, "date_filter": "today", "sort_by": "date"}',
        0,
        true,
        null,
        '{"accent_color": "#d946ef"}'
    )
    ON CONFLICT DO NOTHING;
END $$;
