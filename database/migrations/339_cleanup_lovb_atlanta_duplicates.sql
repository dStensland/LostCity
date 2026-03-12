-- ============================================
-- MIGRATION 339: Backfill LOVB Atlanta official ownership
-- ============================================
-- Transfer any remaining future LOVB Atlanta rows from weaker sources onto the
-- official LOVB Atlanta source. This is intentionally narrow because the
-- venue placeholder path does not always hand off ownership automatically.

UPDATE events e
SET source_id = official_source.id,
    portal_id = official_source.owner_portal_id
FROM sources official_source,
     sources weaker_source
WHERE official_source.slug = 'lovb-atlanta'
  AND weaker_source.id = e.source_id
  AND weaker_source.slug IN ('gateway-center-arena', 'ticketmaster')
  AND e.is_active = true
  AND e.start_date >= current_date
  AND lower(e.title) LIKE 'lovb atlanta%';
