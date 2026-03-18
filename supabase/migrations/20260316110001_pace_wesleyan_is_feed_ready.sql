-- Migration 525: Set is_feed_ready=true for Pace Academy and Wesleyan events.
--
-- Problem: 86 Pace Academy (source 1404) and 43 Wesleyan (source 1403)
-- events have is_feed_ready=false despite having valid titles and
-- descriptions. These are summer camp / school program listings that
-- are fully usable by families even without the feed-quality bar.
--
-- Root cause: The compute_is_feed_ready trigger applies a description-
-- length threshold that these sources don't always meet. These are
-- school-run programs where a 130-character description is standard
-- and sufficient.
--
-- Fix: Targeted backfill for active events from these two sources.
-- Does NOT change the trigger — this is source-specific relief only.
-- Idempotent: re-running has no effect (WHERE is_feed_ready = false).

-- ============================================================
-- UP
-- ============================================================

DO $$
DECLARE
  promoted_count INTEGER;
BEGIN
  UPDATE events
  SET is_feed_ready = true
  WHERE is_feed_ready = false
    AND is_active = true
    AND source_id IN (
      SELECT id FROM sources
      WHERE slug IN ('pace-summer-programs', 'wesleyan-summer-camps')
        AND is_active = true
    );

  GET DIAGNOSTICS promoted_count = ROW_COUNT;
  RAISE NOTICE 'pace_wesleyan_is_feed_ready: promoted % events', promoted_count;
END $$;

-- ============================================================
-- DOWN
-- Revert: re-run the trigger evaluation on these rows.
-- UPDATE events SET title = title
-- WHERE source_id IN (SELECT id FROM sources WHERE slug IN ('pace-summer-programs', 'wesleyan-summer-camps'));
-- ============================================================
