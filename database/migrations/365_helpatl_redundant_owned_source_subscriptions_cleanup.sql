-- ============================================
-- MIGRATION 365: HelpATL Redundant Owned Source Subscriptions Cleanup
-- ============================================
-- Remove redundant HelpATL self-subscriptions for sources already owned by
-- HelpATL. These sources remain accessible through portal_source_access via
-- ownership, so the subscriptions are drift, not dependencies.

UPDATE source_subscriptions
SET is_active = false
WHERE subscriber_portal_id = (SELECT id FROM portals WHERE slug = 'helpatl')
  AND source_id IN (
    SELECT id
    FROM sources
    WHERE slug IN (
      'atlanta-boards-commissions',
      'atlanta-victim-assistance',
      'avlf',
      'cobb-county-elections',
      'dekalb-county-elections',
      'dekalb-medical-reserve-corps',
      'fulton-county-elections',
      'gwinnett-county-elections',
      'new-american-pathways',
      'our-house',
      'pad-atlanta',
      'partnership-against-domestic-violence',
      'red-cross-georgia'
    )
  )
  AND is_active = true;
