-- Migration 189: Rename Emory portal slug for demo + seed explicit assumptions register
-- Purpose:
--   1) Move Emory demo URL to /emory-demo
--   2) Keep backward compatibility via app redirect while preserving same portal id
--   3) Model assumptions that require Emory validation for the elite concierge experience

BEGIN;

CREATE TABLE IF NOT EXISTS portal_demo_assumptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    hospital_location_id UUID REFERENCES portal_hospital_locations(id) ON DELETE CASCADE,
    scope TEXT NOT NULL CHECK (scope IN ('network', 'hospital')),
    assumption_key TEXT NOT NULL,
    assumption_statement TEXT NOT NULL,
    customer_input_needed TEXT NOT NULL,
    demo_default TEXT,
    impact_level TEXT NOT NULL DEFAULT 'medium' CHECK (impact_level IN ('low', 'medium', 'high')),
    validation_status TEXT NOT NULL DEFAULT 'assumed' CHECK (validation_status IN ('assumed', 'needs_validation', 'validated', 'blocked')),
    owner TEXT,
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (portal_id, hospital_location_id, assumption_key)
);

CREATE INDEX IF NOT EXISTS idx_portal_demo_assumptions_portal
ON portal_demo_assumptions(portal_id, scope, validation_status, impact_level);

DO $$
DECLARE
    emory_portal_id UUID;
    has_emory_demo BOOLEAN;

    euh_id UUID;
    midtown_id UUID;
    stj_id UUID;
    johns_creek_id UUID;
BEGIN
    SELECT EXISTS(
        SELECT 1
        FROM portals
        WHERE slug = 'emory-demo'
    ) INTO has_emory_demo;

    IF NOT has_emory_demo THEN
        SELECT id INTO emory_portal_id
        FROM portals
        WHERE slug = 'emory'
        LIMIT 1;

        IF emory_portal_id IS NOT NULL THEN
            UPDATE portals
            SET slug = 'emory-demo'
            WHERE id = emory_portal_id
              AND NOT EXISTS (
                SELECT 1
                FROM portals p2
                WHERE p2.slug = 'emory-demo'
              );
        END IF;
    END IF;

    SELECT id INTO emory_portal_id
    FROM portals
    WHERE slug = 'emory-demo'
    LIMIT 1;

    IF emory_portal_id IS NULL THEN
        RAISE EXCEPTION 'Portal slug emory-demo must exist after migration 189';
    END IF;

    -- Keep metadata explicit for demo context
    UPDATE portals
    SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
        'demo_mode', true,
        'hospital_directory_enabled', true,
        'wayfinding_partner', 'gozio'
    )
    WHERE id = emory_portal_id;

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

    -- Network-level assumptions
    INSERT INTO portal_demo_assumptions (
        portal_id,
        hospital_location_id,
        scope,
        assumption_key,
        assumption_statement,
        customer_input_needed,
        demo_default,
        impact_level,
        validation_status,
        owner
    ) VALUES
    (
        emory_portal_id,
        NULL,
        'network',
        'network.service-line-priority',
        'Hero/entry ranking should prioritize oncology, transplant, cardiac, and maternity service lines for users in care journeys.',
        'Priority ranking of service lines and preferred language per audience cohort.',
        'Balanced ordering: urgent support first, then care pathways, then community health.',
        'high',
        'needs_validation',
        'Emory Marketing + Patient Experience'
    ),
    (
        emory_portal_id,
        NULL,
        'network',
        'network.public-health-calendar-policy',
        'Public health events can be surfaced broadly if source attribution is strict and events are non-commercial.',
        'Approval policy for source inclusion/exclusion and review cadence.',
        'Include nonprofit/public-health feeds only, exclude competitor health systems.',
        'high',
        'assumed',
        'LostCity Strategy'
    ),
    (
        emory_portal_id,
        NULL,
        'network',
        'network.legal-content-disclaimer',
        'Hospital and nearby recommendations require legal-safe disclaimer language and non-diagnostic positioning.',
        'Approved disclaimer copy and placement requirements.',
        'Use informational-only disclaimer in footer and near care CTAs.',
        'high',
        'needs_validation',
        'Emory Legal/Compliance'
    ),
    (
        emory_portal_id,
        NULL,
        'network',
        'network.gozio-deeplink-contract',
        'Wayfinding launches via Gozio deep links for each campus and key destinations.',
        'Final deeplink schema, supported params, and fallback behavior.',
        'Use gozio://search?query=<hospital name> as demo fallback.',
        'high',
        'assumed',
        'LostCity Engineering + Gozio'
    ),
    (
        emory_portal_id,
        NULL,
        'network',
        'network.analytics-roi-model',
        'ROI model should track wayfinding opens, service CTA usage, and support content engagement by cohort.',
        'Final KPI definitions, benchmark baselines, and reporting owners.',
        'Track section and action-level analytics with strict source attribution.',
        'medium',
        'needs_validation',
        'Emory Digital + LostCity Analytics'
    )
    ON CONFLICT (portal_id, hospital_location_id, assumption_key) DO UPDATE
    SET
        assumption_statement = EXCLUDED.assumption_statement,
        customer_input_needed = EXCLUDED.customer_input_needed,
        demo_default = EXCLUDED.demo_default,
        impact_level = EXCLUDED.impact_level,
        validation_status = EXCLUDED.validation_status,
        owner = EXCLUDED.owner,
        updated_at = NOW();

    -- Hospital-level assumptions (only insert when hospital locations exist)
    IF euh_id IS NOT NULL THEN
        INSERT INTO portal_demo_assumptions (
            portal_id,
            hospital_location_id,
            scope,
            assumption_key,
            assumption_statement,
            customer_input_needed,
            demo_default,
            impact_level,
            validation_status,
            owner
        ) VALUES
        (
            emory_portal_id,
            euh_id,
            'hospital',
            'hospital.euh.after-hours-services',
            'After-hours service coverage and desk availability are visible in the guide for caregivers and visitors.',
            'Confirmed after-hours staffing schedule for pharmacy, support desk, and transport.',
            'Mark as "hours vary" with phone-first escalation.',
            'high',
            'needs_validation',
            'EUH Operations'
        ),
        (
            emory_portal_id,
            euh_id,
            'hospital',
            'hospital.euh.parking-entry-points',
            'Parking and entry recommendations should match real patient/visitor flow by time of day.',
            'Validated parking map and preferred entrances by visit type.',
            'Use visitor deck + main entrance as default.',
            'medium',
            'assumed',
            'EUH Facilities'
        )
        ON CONFLICT (portal_id, hospital_location_id, assumption_key) DO UPDATE
        SET
            assumption_statement = EXCLUDED.assumption_statement,
            customer_input_needed = EXCLUDED.customer_input_needed,
            demo_default = EXCLUDED.demo_default,
            impact_level = EXCLUDED.impact_level,
            validation_status = EXCLUDED.validation_status,
            owner = EXCLUDED.owner,
            updated_at = NOW();
    END IF;

    IF midtown_id IS NOT NULL THEN
        INSERT INTO portal_demo_assumptions (
            portal_id,
            hospital_location_id,
            scope,
            assumption_key,
            assumption_statement,
            customer_input_needed,
            demo_default,
            impact_level,
            validation_status,
            owner
        ) VALUES
        (
            emory_portal_id,
            midtown_id,
            'hospital',
            'hospital.midtown.visitor-transit',
            'Transit and ride-share pickup guidance should be prominent for Midtown patients/visitors.',
            'Official drop-off/pickup zones and best transit guidance by entrance.',
            'Default to main entrance + nearby transit hints.',
            'medium',
            'needs_validation',
            'Midtown Campus Ops'
        )
        ON CONFLICT (portal_id, hospital_location_id, assumption_key) DO UPDATE
        SET
            assumption_statement = EXCLUDED.assumption_statement,
            customer_input_needed = EXCLUDED.customer_input_needed,
            demo_default = EXCLUDED.demo_default,
            impact_level = EXCLUDED.impact_level,
            validation_status = EXCLUDED.validation_status,
            owner = EXCLUDED.owner,
            updated_at = NOW();
    END IF;

    IF stj_id IS NOT NULL THEN
        INSERT INTO portal_demo_assumptions (
            portal_id,
            hospital_location_id,
            scope,
            assumption_key,
            assumption_statement,
            customer_input_needed,
            demo_default,
            impact_level,
            validation_status,
            owner
        ) VALUES
        (
            emory_portal_id,
            stj_id,
            'hospital',
            'hospital.stj.specialty-journeys',
            'Specialty journey content (heart/vascular) should surface first for St. Joseph''s audience.',
            'Validated care journey priorities and service-line messaging sequence.',
            'Use balanced urgent support + visitor logistics ordering.',
            'medium',
            'needs_validation',
            'St. Joseph''s Service Line Leads'
        )
        ON CONFLICT (portal_id, hospital_location_id, assumption_key) DO UPDATE
        SET
            assumption_statement = EXCLUDED.assumption_statement,
            customer_input_needed = EXCLUDED.customer_input_needed,
            demo_default = EXCLUDED.demo_default,
            impact_level = EXCLUDED.impact_level,
            validation_status = EXCLUDED.validation_status,
            owner = EXCLUDED.owner,
            updated_at = NOW();
    END IF;

    IF johns_creek_id IS NOT NULL THEN
        INSERT INTO portal_demo_assumptions (
            portal_id,
            hospital_location_id,
            scope,
            assumption_key,
            assumption_statement,
            customer_input_needed,
            demo_default,
            impact_level,
            validation_status,
            owner
        ) VALUES
        (
            emory_portal_id,
            johns_creek_id,
            'hospital',
            'hospital.jc.out-of-town-lodging',
            'Out-of-town lodging recommendations should include medical-rate partners and distance-to-entry context.',
            'Preferred lodging partner list and rate/booking policy language.',
            'Surface nearest lodging venues ranked by distance and late-night availability.',
            'medium',
            'needs_validation',
            'Johns Creek Ops + Patient Services'
        )
        ON CONFLICT (portal_id, hospital_location_id, assumption_key) DO UPDATE
        SET
            assumption_statement = EXCLUDED.assumption_statement,
            customer_input_needed = EXCLUDED.customer_input_needed,
            demo_default = EXCLUDED.demo_default,
            impact_level = EXCLUDED.impact_level,
            validation_status = EXCLUDED.validation_status,
            owner = EXCLUDED.owner,
            updated_at = NOW();
    END IF;
END $$;

COMMIT;
