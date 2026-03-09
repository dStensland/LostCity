-- Migration 297: FORTH Venue Specials — Fill Gaps
--
-- Migration 169 seeded initial FORTH specials for Bar Premio, Elektra, and Moonlight.
-- This migration adds the missing specials needed by computePropertyMoments:
--   - Il Premio: Sommelier Pairing Menu, Weekend Brunch (wholly missing)
--   - Bar Premio: Late Night Bites (missing from 169)
--   - Elektra: Poolside Lunch Prix Fixe, Sunset Cocktails (missing from 169)
--   - Moonlight: Live Jazz, Starlight Happy Hour (missing from 169)
--
-- All inserted with confidence=1.0 (manual entry, confirmed by FORTH).
-- is_active defaults to true per venue_specials schema.

DO $$
DECLARE
    v_bar_premio    INTEGER;
    v_il_premio     INTEGER;
    v_elektra       INTEGER;
    v_moonlight     INTEGER;
BEGIN
    SELECT id INTO v_bar_premio FROM venues WHERE slug = 'bar-premio';
    SELECT id INTO v_il_premio  FROM venues WHERE slug = 'il-premio';
    SELECT id INTO v_elektra    FROM venues WHERE slug = 'elektra-forth';
    SELECT id INTO v_moonlight  FROM venues WHERE slug = 'moonlight-forth';

    -- -------------------------------------------------------------------------
    -- Il Premio (steakhouse) — no specials exist yet from migration 169
    -- -------------------------------------------------------------------------

    IF v_il_premio IS NOT NULL THEN
        -- Sommelier Pairing Menu: Tue–Sat, 6pm–10pm
        INSERT INTO venue_specials
            (venue_id, title, type, description, days_of_week, time_start, time_end,
             price_note, confidence, source_url, is_active)
        VALUES (
            v_il_premio,
            'Sommelier Pairing Menu',
            'prix_fixe',
            'Four-course dinner with curated wine pairings selected by the sommelier.',
            '{2,3,4,5,6}', '18:00', '22:00',
            '3-course $65',
            '1.0',
            'https://www.forthatlanta.com/dine-drink/il-premio',
            true
        );

        -- Weekend Brunch: Sat–Sun, 10am–2pm
        INSERT INTO venue_specials
            (venue_id, title, type, description, days_of_week, time_start, time_end,
             confidence, source_url, is_active)
        VALUES (
            v_il_premio,
            'Weekend Brunch',
            'brunch',
            'Weekend brunch service at Il Premio with steakhouse-style brunch menu.',
            '{6,7}', '10:00', '14:00',
            '1.0',
            'https://www.forthatlanta.com/dine-drink/il-premio',
            true
        );
    END IF;

    -- -------------------------------------------------------------------------
    -- Bar Premio — Late Night Bites missing from migration 169
    -- -------------------------------------------------------------------------

    IF v_bar_premio IS NOT NULL THEN
        -- Late Night Bites: Fri–Sat, 10pm–midnight
        INSERT INTO venue_specials
            (venue_id, title, type, description, days_of_week, time_start, time_end,
             confidence, source_url, is_active)
        VALUES (
            v_bar_premio,
            'Late Night Bites',
            'late_night',
            'Late-night small plates and bar snacks available Friday and Saturday.',
            '{5,6}', '22:00', '00:00',
            '1.0',
            'https://www.forthatlanta.com/dine-drink/bar-premio',
            true
        );
    END IF;

    -- -------------------------------------------------------------------------
    -- Elektra (pool restaurant) — Lunch prix fixe and Sunset Cocktails missing
    -- -------------------------------------------------------------------------

    IF v_elektra IS NOT NULL THEN
        -- Poolside Lunch Prix Fixe: Mon–Fri, 11am–3pm
        INSERT INTO venue_specials
            (venue_id, title, type, description, days_of_week, time_start, time_end,
             confidence, source_url, is_active)
        VALUES (
            v_elektra,
            'Poolside Lunch Prix Fixe',
            'prix_fixe',
            'Weekday poolside prix fixe lunch — Mediterranean dishes at the pool deck.',
            '{1,2,3,4,5}', '11:00', '15:00',
            '1.0',
            'https://www.forthatlanta.com/dine-drink/elektra',
            true
        );

        -- Sunset Cocktails: daily, 5pm–8pm
        INSERT INTO venue_specials
            (venue_id, title, type, description, days_of_week, time_start, time_end,
             price_note, confidence, source_url, is_active)
        VALUES (
            v_elektra,
            'Sunset Cocktails',
            'happy_hour',
            'Sunset cocktail service at the pool deck with Mediterranean-inspired drinks.',
            '{1,2,3,4,5,6,7}', '17:00', '20:00',
            '$12 cocktails',
            '1.0',
            'https://www.forthatlanta.com/dine-drink/elektra',
            true
        );
    END IF;

    -- -------------------------------------------------------------------------
    -- Moonlight at FORTH (rooftop bar) — Live Jazz and Starlight Happy Hour missing
    -- -------------------------------------------------------------------------

    IF v_moonlight IS NOT NULL THEN
        -- Live Jazz: Thu–Sat, 8pm–11pm
        INSERT INTO venue_specials
            (venue_id, title, type, description, days_of_week, time_start, time_end,
             confidence, source_url, is_active)
        VALUES (
            v_moonlight,
            'Live Jazz',
            'live_entertainment',
            'Live jazz on the rooftop Thursday through Saturday evenings.',
            '{4,5,6}', '20:00', '23:00',
            '1.0',
            'https://www.forthatlanta.com/dine-drink/moonlight',
            true
        );

        -- Starlight Happy Hour: daily, 5pm–8pm
        INSERT INTO venue_specials
            (venue_id, title, type, description, days_of_week, time_start, time_end,
             confidence, source_url, is_active)
        VALUES (
            v_moonlight,
            'Starlight Happy Hour',
            'happy_hour',
            'Daily rooftop happy hour with featured cocktails and skyline views.',
            '{1,2,3,4,5,6,7}', '17:00', '20:00',
            '1.0',
            'https://www.forthatlanta.com/dine-drink/moonlight',
            true
        );
    END IF;

END $$;

-- ============================================================================
-- DOWN
-- ============================================================================
-- DELETE FROM venue_specials
-- WHERE venue_id IN (
--     SELECT id FROM venues WHERE slug IN ('il-premio', 'bar-premio', 'elektra-forth', 'moonlight-forth')
-- )
-- AND title IN (
--     'Sommelier Pairing Menu', 'Weekend Brunch',
--     'Late Night Bites',
--     'Poolside Lunch Prix Fixe', 'Sunset Cocktails',
--     'Live Jazz', 'Starlight Happy Hour'
-- );
