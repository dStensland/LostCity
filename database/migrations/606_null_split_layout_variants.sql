-- Null out any `split` layout_variant values in portal_feed_headers.
--
-- The `split` layout was deleted along with the 4-variant rotation in favor
-- of a single canonical bottom-left hero. Any rows still holding `'split'`
-- would fail the narrowed `LayoutVariant` TS union on load and blank out the
-- admin form's layout select.
--
-- Downstream: CityBriefing ignores layout_variant entirely now (always renders
-- the canonical layout). Setting these to NULL is the safe cleanup.

UPDATE portal_feed_headers
SET layout_variant = NULL
WHERE layout_variant = 'split';
