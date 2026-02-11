-- Migration 187: Seed strict public-health + outdoor-wellness sections for Atlanta and Emory
-- Purpose:
--   1) Surface nonprofit/public-health and community wellness sources intentionally in feed sections
--   2) Keep attribution strict using explicit source_ids filters on each section
--   3) Keep Emory focused on non-commercial resources ahead of launch

BEGIN;

-- Ensure both portals render section-based feeds and keep existing feed settings where present
UPDATE portals
SET settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{feed}',
    COALESCE(settings->'feed', '{}'::jsonb) || jsonb_build_object(
        'feed_type', 'sections',
        'default_layout', 'list',
        'items_per_section', 8
    ),
    true
)
WHERE slug IN ('atlanta', 'emory');

DO $$
DECLARE
    atlanta_portal_id UUID;
    emory_portal_id UUID;

    public_health_source_slugs TEXT[] := ARRAY[
        'dekalb-public-health',
        'dekalb-library',
        'ymca-atlanta',
        'hands-on-atlanta',
        'food-well-alliance',
        'georgia-organics',
        'giving-kitchen',
        'united-way-atlanta',
        'atlanta-community-food-bank',
        'meals-on-wheels-atlanta',
        'open-hand-atlanta'
    ];

    outdoor_wellness_source_slugs TEXT[] := ARRAY[
        'beltline',
        'chattahoochee-nature',
        'park-pride',
        'decatur-recreation',
        'ansley-park-civic',
        'morningside-civic',
        'ormewood-park-neighborhood',
        'college-park-city'
    ];

    food_support_source_slugs TEXT[] := ARRAY[
        'atlanta-community-food-bank',
        'meals-on-wheels-atlanta',
        'open-hand-atlanta',
        'food-well-alliance',
        'giving-kitchen',
        'united-way-atlanta',
        'dekalb-public-health'
    ];

    missing_public_health_slugs TEXT[];
    missing_outdoor_slugs TEXT[];
    missing_food_support_slugs TEXT[];

    public_health_source_ids INT[];
    outdoor_wellness_source_ids INT[];
    food_support_source_ids INT[];
BEGIN
    SELECT id INTO atlanta_portal_id
    FROM portals
    WHERE slug = 'atlanta'
    LIMIT 1;

    SELECT id INTO emory_portal_id
    FROM portals
    WHERE slug = 'emory'
    LIMIT 1;

    IF atlanta_portal_id IS NULL THEN
        RAISE EXCEPTION 'Atlanta portal is required before running migration 187';
    END IF;

    IF emory_portal_id IS NULL THEN
        RAISE EXCEPTION 'Emory portal is required before running migration 187';
    END IF;

    SELECT ARRAY(
        SELECT slug
        FROM unnest(public_health_source_slugs) AS slug
        WHERE NOT EXISTS (
            SELECT 1
            FROM sources s
            WHERE s.slug = slug
              AND s.is_active = true
        )
    ) INTO missing_public_health_slugs;

    SELECT ARRAY(
        SELECT slug
        FROM unnest(outdoor_wellness_source_slugs) AS slug
        WHERE NOT EXISTS (
            SELECT 1
            FROM sources s
            WHERE s.slug = slug
              AND s.is_active = true
        )
    ) INTO missing_outdoor_slugs;

    SELECT ARRAY(
        SELECT slug
        FROM unnest(food_support_source_slugs) AS slug
        WHERE NOT EXISTS (
            SELECT 1
            FROM sources s
            WHERE s.slug = slug
              AND s.is_active = true
        )
    ) INTO missing_food_support_slugs;

    IF COALESCE(array_length(missing_public_health_slugs, 1), 0) > 0 THEN
        RAISE EXCEPTION 'Migration 187 missing required public health sources: %', missing_public_health_slugs;
    END IF;

    IF COALESCE(array_length(missing_outdoor_slugs, 1), 0) > 0 THEN
        RAISE EXCEPTION 'Migration 187 missing required outdoor wellness sources: %', missing_outdoor_slugs;
    END IF;

    IF COALESCE(array_length(missing_food_support_slugs, 1), 0) > 0 THEN
        RAISE EXCEPTION 'Migration 187 missing required food-support sources: %', missing_food_support_slugs;
    END IF;

    SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::INT[])
    INTO public_health_source_ids
    FROM sources
    WHERE slug = ANY(public_health_source_slugs)
      AND is_active = true;

    SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::INT[])
    INTO outdoor_wellness_source_ids
    FROM sources
    WHERE slug = ANY(outdoor_wellness_source_slugs)
      AND is_active = true;

    SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::INT[])
    INTO food_support_source_ids
    FROM sources
    WHERE slug = ANY(food_support_source_slugs)
      AND is_active = true;

    -- Atlanta: Public health resource events and services
    INSERT INTO portal_sections (
        portal_id,
        slug,
        title,
        description,
        section_type,
        block_type,
        layout,
        max_items,
        auto_filter,
        display_order,
        is_visible
    ) VALUES (
        atlanta_portal_id,
        'public-health-resources',
        'Public Health & Community Care',
        'Free and low-cost health support, education, and community events across Atlanta.',
        'auto',
        'event_list',
        'list',
        12,
        jsonb_build_object(
            'source_ids', public_health_source_ids,
            'categories', ARRAY['community', 'learning', 'family', 'fitness', 'other'],
            'date_filter', 'next_30_days',
            'sort_by', 'date',
            'is_free', true
        ),
        8,
        true
    )
    ON CONFLICT (portal_id, slug) DO UPDATE
    SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        section_type = EXCLUDED.section_type,
        block_type = EXCLUDED.block_type,
        layout = EXCLUDED.layout,
        max_items = EXCLUDED.max_items,
        auto_filter = EXCLUDED.auto_filter,
        display_order = EXCLUDED.display_order,
        is_visible = EXCLUDED.is_visible;

    -- Atlanta: Food security and family support resources
    INSERT INTO portal_sections (
        portal_id,
        slug,
        title,
        description,
        section_type,
        block_type,
        layout,
        max_items,
        auto_filter,
        display_order,
        is_visible
    ) VALUES (
        atlanta_portal_id,
        'food-access-support',
        'Food Access & Family Support',
        'Community food access programs, meal support, and healthy living resources.',
        'auto',
        'event_list',
        'list',
        10,
        jsonb_build_object(
            'source_ids', food_support_source_ids,
            'categories', ARRAY['community', 'family', 'food_drink', 'learning', 'other'],
            'date_filter', 'next_30_days',
            'sort_by', 'date',
            'is_free', true
        ),
        9,
        true
    )
    ON CONFLICT (portal_id, slug) DO UPDATE
    SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        section_type = EXCLUDED.section_type,
        block_type = EXCLUDED.block_type,
        layout = EXCLUDED.layout,
        max_items = EXCLUDED.max_items,
        auto_filter = EXCLUDED.auto_filter,
        display_order = EXCLUDED.display_order,
        is_visible = EXCLUDED.is_visible;

    -- Atlanta: Non-commercial outdoor and wellness programming
    INSERT INTO portal_sections (
        portal_id,
        slug,
        title,
        description,
        section_type,
        block_type,
        layout,
        max_items,
        auto_filter,
        display_order,
        is_visible
    ) VALUES (
        atlanta_portal_id,
        'outdoor-wellness',
        'Outdoor Wellness',
        'Walks, park activations, recreation, and community fitness outdoors.',
        'auto',
        'event_cards',
        'grid',
        10,
        jsonb_build_object(
            'source_ids', outdoor_wellness_source_ids,
            'categories', ARRAY['fitness', 'community', 'family', 'other'],
            'date_filter', 'next_30_days',
            'sort_by', 'date',
            'is_free', true
        ),
        10,
        true
    )
    ON CONFLICT (portal_id, slug) DO UPDATE
    SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        section_type = EXCLUDED.section_type,
        block_type = EXCLUDED.block_type,
        layout = EXCLUDED.layout,
        max_items = EXCLUDED.max_items,
        auto_filter = EXCLUDED.auto_filter,
        display_order = EXCLUDED.display_order,
        is_visible = EXCLUDED.is_visible;

    -- Emory: Public health + support section, federated from Atlanta-owned sources
    INSERT INTO portal_sections (
        portal_id,
        slug,
        title,
        description,
        section_type,
        block_type,
        layout,
        max_items,
        auto_filter,
        display_order,
        is_visible
    ) VALUES (
        emory_portal_id,
        'public-health-resources',
        'Community Health Resources',
        'Public-health education, support programs, and nonprofit events for patients and families.',
        'auto',
        'event_list',
        'list',
        12,
        jsonb_build_object(
            'source_ids', public_health_source_ids,
            'categories', ARRAY['community', 'learning', 'family', 'fitness', 'other'],
            'date_filter', 'next_30_days',
            'sort_by', 'date',
            'is_free', true
        ),
        1,
        true
    )
    ON CONFLICT (portal_id, slug) DO UPDATE
    SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        section_type = EXCLUDED.section_type,
        block_type = EXCLUDED.block_type,
        layout = EXCLUDED.layout,
        max_items = EXCLUDED.max_items,
        auto_filter = EXCLUDED.auto_filter,
        display_order = EXCLUDED.display_order,
        is_visible = EXCLUDED.is_visible;

    -- Emory: Food access section for lower-income family support
    INSERT INTO portal_sections (
        portal_id,
        slug,
        title,
        description,
        section_type,
        block_type,
        layout,
        max_items,
        auto_filter,
        display_order,
        is_visible
    ) VALUES (
        emory_portal_id,
        'food-access-support',
        'Food Access & Family Support',
        'Free and low-cost nutrition, meal, and family wellness resources in Atlanta.',
        'auto',
        'event_list',
        'list',
        10,
        jsonb_build_object(
            'source_ids', food_support_source_ids,
            'categories', ARRAY['community', 'family', 'food_drink', 'learning', 'other'],
            'date_filter', 'next_30_days',
            'sort_by', 'date',
            'is_free', true
        ),
        2,
        true
    )
    ON CONFLICT (portal_id, slug) DO UPDATE
    SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        section_type = EXCLUDED.section_type,
        block_type = EXCLUDED.block_type,
        layout = EXCLUDED.layout,
        max_items = EXCLUDED.max_items,
        auto_filter = EXCLUDED.auto_filter,
        display_order = EXCLUDED.display_order,
        is_visible = EXCLUDED.is_visible;

    -- Emory: Outdoor wellness section (non-commercial)
    INSERT INTO portal_sections (
        portal_id,
        slug,
        title,
        description,
        section_type,
        block_type,
        layout,
        max_items,
        auto_filter,
        display_order,
        is_visible
    ) VALUES (
        emory_portal_id,
        'outdoor-wellness',
        'Outdoor Wellness & Community Activity',
        'Non-commercial outdoor fitness, recreation, and neighborhood wellness programs.',
        'auto',
        'event_cards',
        'grid',
        10,
        jsonb_build_object(
            'source_ids', outdoor_wellness_source_ids,
            'categories', ARRAY['fitness', 'community', 'family', 'other'],
            'date_filter', 'next_30_days',
            'sort_by', 'date',
            'is_free', true
        ),
        3,
        true
    )
    ON CONFLICT (portal_id, slug) DO UPDATE
    SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        section_type = EXCLUDED.section_type,
        block_type = EXCLUDED.block_type,
        layout = EXCLUDED.layout,
        max_items = EXCLUDED.max_items,
        auto_filter = EXCLUDED.auto_filter,
        display_order = EXCLUDED.display_order,
        is_visible = EXCLUDED.is_visible;
END $$;

REFRESH MATERIALIZED VIEW portal_source_access;

COMMIT;
