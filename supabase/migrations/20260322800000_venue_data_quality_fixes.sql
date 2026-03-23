-- Phase 0: Venue data quality fixes before enrichment sprint
-- Topgolf fragmentation, type corrections

-- 0.1: Topgolf dedup
-- The canonical record is "topgolf-atlanta-midtown" created by the destination-first crawler.
-- Merge any duplicate Topgolf records that may exist under alternate names/slugs.
-- This uses dynamic lookups rather than hardcoded IDs since venue IDs differ per environment.

DO $$
DECLARE
    canonical_id INT;
    dupe_id INT;
    dupe_record RECORD;
BEGIN
    -- Find the canonical Topgolf venue (from the destination-first crawler)
    SELECT id INTO canonical_id FROM venues
    WHERE slug = 'topgolf-atlanta-midtown' AND active = true
    LIMIT 1;

    IF canonical_id IS NULL THEN
        RAISE NOTICE 'No canonical topgolf-atlanta-midtown venue found, skipping merge';
        RETURN;
    END IF;

    -- Find and merge any duplicates (different slugs, same location)
    FOR dupe_record IN
        SELECT id, slug, name FROM venues
        WHERE id != canonical_id
        AND active = true
        AND (
            slug LIKE 'topgolf%'
            OR name ILIKE '%topgolf%atlanta%'
            OR name ILIKE '%top golf%atlanta%'
        )
    LOOP
        dupe_id := dupe_record.id;
        RAISE NOTICE 'Merging Topgolf duplicate: id=%, slug=%, name=% → canonical id=%',
            dupe_id, dupe_record.slug, dupe_record.name, canonical_id;

        -- Repoint events
        UPDATE events SET venue_id = canonical_id WHERE venue_id = dupe_id;
        -- Repoint exhibitions
        UPDATE exhibitions SET venue_id = canonical_id WHERE venue_id = dupe_id;
        -- Repoint venue_features (delete if conflict on slug)
        DELETE FROM venue_features WHERE venue_id = dupe_id
            AND slug IN (SELECT slug FROM venue_features WHERE venue_id = canonical_id);
        UPDATE venue_features SET venue_id = canonical_id WHERE venue_id = dupe_id;
        -- Repoint venue_specials
        DELETE FROM venue_specials WHERE venue_id = dupe_id
            AND slug IN (SELECT slug FROM venue_specials WHERE venue_id = canonical_id);
        UPDATE venue_specials SET venue_id = canonical_id WHERE venue_id = dupe_id;
        -- Repoint venue_destination_details
        DELETE FROM venue_destination_details WHERE venue_id = dupe_id;
        -- Repoint editorial_mentions
        UPDATE editorial_mentions SET venue_id = canonical_id WHERE venue_id = dupe_id
            AND article_url NOT IN (SELECT article_url FROM editorial_mentions WHERE venue_id = canonical_id);
        DELETE FROM editorial_mentions WHERE venue_id = dupe_id;
        -- Repoint venue_occasions
        DELETE FROM venue_occasions WHERE venue_id = dupe_id
            AND occasion IN (SELECT occasion FROM venue_occasions WHERE venue_id = canonical_id);
        UPDATE venue_occasions SET venue_id = canonical_id WHERE venue_id = dupe_id;
        -- Repoint sources
        UPDATE sources SET venue_id = canonical_id WHERE venue_id = dupe_id;
        -- Repoint programs
        UPDATE programs SET venue_id = canonical_id WHERE venue_id = dupe_id;

        -- Add slug as alias on canonical record
        UPDATE venues SET aliases = COALESCE(aliases, '[]'::jsonb) || to_jsonb(dupe_record.slug::text)
        WHERE id = canonical_id;

        -- Deactivate duplicate
        UPDATE venues SET active = false WHERE id = dupe_id;
    END LOOP;
END $$;

-- 0.4: Bowlero venue_type fix — should be entertainment, not bowling_alley or whatever it was set as
UPDATE venues
SET venue_type = 'entertainment', spot_type = 'entertainment'
WHERE (slug = 'bowlero' OR slug LIKE 'bowlero-%')
  AND venue_type != 'entertainment';
