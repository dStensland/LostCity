-- Migration 188: Emory hospital directory + per-hospital landing page data
-- Purpose:
--   1) Add a scalable data model for hospital-specific landing pages
--   2) Seed Emory hospital campus records and on-site services
--   3) Prepare wayfinding integration fields (Gozio deep links / fallback URLs)

BEGIN;

CREATE TABLE IF NOT EXISTS portal_hospital_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    short_name TEXT,
    address TEXT NOT NULL,
    neighborhood TEXT,
    lat NUMERIC(10, 7) NOT NULL,
    lng NUMERIC(11, 7) NOT NULL,
    phone TEXT,
    emergency_phone TEXT,
    website TEXT,
    gozio_deeplink TEXT,
    wayfinding_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(portal_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_portal_hospital_locations_portal_active
ON portal_hospital_locations(portal_id, is_active, display_order);

CREATE TABLE IF NOT EXISTS portal_hospital_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_location_id UUID NOT NULL REFERENCES portal_hospital_locations(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    open_hours TEXT,
    location_hint TEXT,
    cta_label TEXT,
    cta_url TEXT,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(hospital_location_id, category, name)
);

CREATE INDEX IF NOT EXISTS idx_portal_hospital_services_location
ON portal_hospital_services(hospital_location_id, is_active, display_order);

DO $$
DECLARE
    emory_portal_id UUID;

    euh_id UUID;
    midtown_id UUID;
    stj_id UUID;
    johns_creek_id UUID;
BEGIN
    SELECT id INTO emory_portal_id
    FROM portals
    WHERE slug = 'emory'
    LIMIT 1;

    IF emory_portal_id IS NULL THEN
        RAISE EXCEPTION 'Emory portal is required before running migration 188';
    END IF;

    -- Ensure Emory settings reflect hospital + wayfinding posture
    UPDATE portals
    SET settings = jsonb_set(
        COALESCE(settings, '{}'::jsonb),
        '{wayfinding_partner}',
        '"gozio"'::jsonb,
        true
    ) || jsonb_build_object('hospital_directory_enabled', true)
    WHERE id = emory_portal_id;

    -- Hospital campuses
    INSERT INTO portal_hospital_locations (
        portal_id,
        slug,
        name,
        short_name,
        address,
        neighborhood,
        lat,
        lng,
        phone,
        emergency_phone,
        website,
        gozio_deeplink,
        wayfinding_url,
        metadata,
        display_order,
        is_active
    ) VALUES
    (
        emory_portal_id,
        'emory-university-hospital',
        'Emory University Hospital',
        'EUH',
        '1364 Clifton Rd NE, Atlanta, GA 30322',
        'Druid Hills',
        33.7917696,
        -84.3214844,
        '(404) 712-2000',
        '911',
        'https://www.emoryhealthcare.org/locations/hospitals/emory-university-hospital',
        'gozio://search?query=Emory%20University%20Hospital',
        'https://www.emoryhealthcare.org/locations/hospitals/emory-university-hospital',
        '{"campus_type":"flagship","parking":"visitor-deck"}',
        1,
        true
    ),
    (
        emory_portal_id,
        'emory-university-hospital-midtown',
        'Emory University Hospital Midtown',
        'Midtown',
        '550 Peachtree St NE, Atlanta, GA 30308',
        'Midtown',
        33.7686442,
        -84.3861929,
        '(404) 686-4411',
        '911',
        'https://www.emoryhealthcare.org/locations/hospitals/emory-university-hospital-midtown',
        'gozio://search?query=Emory%20University%20Hospital%20Midtown',
        'https://www.emoryhealthcare.org/locations/hospitals/emory-university-hospital-midtown',
        '{"campus_type":"urban","parking":"adjacent-deck"}',
        2,
        true
    ),
    (
        emory_portal_id,
        'emory-saint-josephs-hospital',
        'Emory Saint Joseph''s Hospital',
        'Saint Joseph''s',
        '5665 Peachtree Dunwoody Rd, Atlanta, GA 30342',
        'Sandy Springs',
        33.9081907,
        -84.3525311,
        '(678) 843-7001',
        '911',
        'https://www.emoryhealthcare.org/locations/hospitals/emory-saint-josephs-hospital',
        'gozio://search?query=Emory%20Saint%20Josephs%20Hospital',
        'https://www.emoryhealthcare.org/locations/hospitals/emory-saint-josephs-hospital',
        '{"campus_type":"regional","parking":"surface-and-deck"}',
        3,
        true
    ),
    (
        emory_portal_id,
        'emory-johns-creek-hospital',
        'Emory Johns Creek Hospital',
        'Johns Creek',
        '6325 Hospital Pkwy, Johns Creek, GA 30097',
        'Johns Creek',
        34.0700035,
        -84.1724325,
        '(678) 474-7000',
        '911',
        'https://www.emoryhealthcare.org/locations/hospitals/emory-johns-creek-hospital',
        'gozio://search?query=Emory%20Johns%20Creek%20Hospital',
        'https://www.emoryhealthcare.org/locations/hospitals/emory-johns-creek-hospital',
        '{"campus_type":"suburban","parking":"surface"}',
        4,
        true
    )
    ON CONFLICT (portal_id, slug) DO UPDATE
    SET
        name = EXCLUDED.name,
        short_name = EXCLUDED.short_name,
        address = EXCLUDED.address,
        neighborhood = EXCLUDED.neighborhood,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        phone = EXCLUDED.phone,
        emergency_phone = EXCLUDED.emergency_phone,
        website = EXCLUDED.website,
        gozio_deeplink = EXCLUDED.gozio_deeplink,
        wayfinding_url = EXCLUDED.wayfinding_url,
        metadata = EXCLUDED.metadata,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active,
        updated_at = NOW();

    SELECT id INTO euh_id
    FROM portal_hospital_locations
    WHERE portal_id = emory_portal_id AND slug = 'emory-university-hospital'
    LIMIT 1;

    SELECT id INTO midtown_id
    FROM portal_hospital_locations
    WHERE portal_id = emory_portal_id AND slug = 'emory-university-hospital-midtown'
    LIMIT 1;

    SELECT id INTO stj_id
    FROM portal_hospital_locations
    WHERE portal_id = emory_portal_id AND slug = 'emory-saint-josephs-hospital'
    LIMIT 1;

    SELECT id INTO johns_creek_id
    FROM portal_hospital_locations
    WHERE portal_id = emory_portal_id AND slug = 'emory-johns-creek-hospital'
    LIMIT 1;

    -- Core service blocks for each hospital guide
    INSERT INTO portal_hospital_services (
        hospital_location_id,
        category,
        name,
        description,
        open_hours,
        location_hint,
        cta_label,
        cta_url,
        display_order,
        is_active
    ) VALUES
    (euh_id, 'food', 'Cafeteria & Coffee', 'On-campus food options for families, caregivers, and night shifts.', 'Hours vary by location', 'Main hospital concourse', 'View hours', 'https://www.emoryhealthcare.org/patients-and-visitors/visitor-information', 1, true),
    (euh_id, 'pharmacy', 'Outpatient Pharmacy', 'Prescription pickup and common over-the-counter items.', 'Daily, check location', 'Main floor near patient discharge', 'Pharmacy info', 'https://www.emoryhealthcare.org/patients-and-visitors/visitor-information', 2, true),
    (euh_id, 'parking', 'Visitor Parking', 'Deck and accessible parking for patients and guests.', '24/7 access', 'Visitor deck entrance on Clifton Rd', 'Parking details', 'https://www.emoryhealthcare.org/patients-and-visitors/visitor-information', 3, true),
    (euh_id, 'support', 'Chapel & Quiet Space', 'Space for reflection and family support.', 'Open daily', 'Near main lobby', 'Visitor services', 'https://www.emoryhealthcare.org/patients-and-visitors/visitor-information', 4, true),

    (midtown_id, 'food', 'Cafeteria & Grab-and-Go', 'Meals and quick snacks close to inpatient units.', 'Hours vary by service', 'Ground floor dining area', 'View hours', 'https://www.emoryhealthcare.org/patients-and-visitors/visitor-information', 1, true),
    (midtown_id, 'parking', 'Visitor Parking Deck', 'Convenient visitor parking near the main entrance.', '24/7 access', 'Peachtree St side entrance', 'Parking details', 'https://www.emoryhealthcare.org/patients-and-visitors/visitor-information', 2, true),
    (midtown_id, 'amenity', 'Guest Services Desk', 'Directions, transport help, and visitor support.', 'Daily', 'Main lobby', 'Visitor info', 'https://www.emoryhealthcare.org/patients-and-visitors/visitor-information', 3, true),

    (stj_id, 'food', 'Dining & Coffee', 'Food options for patients, visitors, and staff.', 'Hours vary by location', 'Main atrium level', 'View hours', 'https://www.emoryhealthcare.org/patients-and-visitors/visitor-information', 1, true),
    (stj_id, 'parking', 'Visitor Parking', 'On-site parking close to key entries.', '24/7 access', 'Main visitor lots and deck', 'Parking details', 'https://www.emoryhealthcare.org/patients-and-visitors/visitor-information', 2, true),
    (stj_id, 'support', 'Patient & Family Support', 'Social work and care support resources.', 'Business hours', 'Patient support office', 'Support resources', 'https://www.emoryhealthcare.org/patients-and-visitors/visitor-information', 3, true),

    (johns_creek_id, 'food', 'Cafeteria', 'Hot meals and grab-and-go items on campus.', 'Hours vary', 'Main floor dining area', 'View hours', 'https://www.emoryhealthcare.org/patients-and-visitors/visitor-information', 1, true),
    (johns_creek_id, 'parking', 'Visitor Parking', 'Close-in parking with accessible spaces.', '24/7 access', 'Primary visitor entrance', 'Parking details', 'https://www.emoryhealthcare.org/patients-and-visitors/visitor-information', 2, true),
    (johns_creek_id, 'amenity', 'Wayfinding Help Desk', 'On-site staff support for navigation and check-in.', 'Daily', 'Main lobby', 'Visitor info', 'https://www.emoryhealthcare.org/patients-and-visitors/visitor-information', 3, true)
    ON CONFLICT (hospital_location_id, category, name) DO UPDATE
    SET
        description = EXCLUDED.description,
        open_hours = EXCLUDED.open_hours,
        location_hint = EXCLUDED.location_hint,
        cta_label = EXCLUDED.cta_label,
        cta_url = EXCLUDED.cta_url,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active,
        updated_at = NOW();
END $$;

COMMIT;
