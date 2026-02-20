-- Migration 233: Remove Stone Mountain seasonal programming from festivals
--
-- These are multi-week/month seasonal park activations, not standalone
-- festivals. Dino Fest runs 49 days, Christmas runs 56 days — they're
-- attraction overlays, not events people attend as a festival.
--
-- Keeping: stone-mountain-highland-games (legit independent festival
-- run by SMHG.org with its own ticketing and org).
--
-- Individual events within these programs are still surfaced by the
-- Stone Mountain Park crawler.

BEGIN;

-- Unlink any series tied to these festival records
UPDATE series SET festival_id = NULL
WHERE festival_id IN (
    'stone-mountain-lunar-new-year',
    'stone-mountain-latino-fest',
    'stone-mountain-christmas',
    'stone-mountain-dino-fest',
    'stone-mountain-fantastic-fourth'
);

-- Remove from festivals table
DELETE FROM festivals WHERE slug IN (
    'stone-mountain-lunar-new-year',
    'stone-mountain-latino-fest',
    'stone-mountain-christmas',
    'stone-mountain-dino-fest',
    'stone-mountain-fantastic-fourth'
);

COMMIT;
