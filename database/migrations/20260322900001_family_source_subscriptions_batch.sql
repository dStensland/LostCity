-- Subscribe 17 missing sources to the atlanta-families portal.
-- Uses ON CONFLICT to be idempotent on re-run.

INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
SELECT p.id, s.id, 'all', true
FROM portals p
CROSS JOIN (
    SELECT id FROM sources WHERE slug IN (
        'atlanta-family-programs', 'dekalb-family-programs', 'club-scikidz-atlanta',
        'gwinnett-family-programs', 'woodward-summer-camps', 'mjcca-day-camps',
        'walker-summer-programs', 'pace-summer-programs', 'lovett-summer-programs',
        'gwinnett-ehc', 'girl-scouts-greater-atlanta-camps', 'cobb-family-programs',
        'wesleyan-summer-camps', 'marist-school', 'callanwolde-fine-arts-center',
        'trinity-summer-camps', 'gwinnett-adult-swim-lessons'
    )
) s
WHERE p.slug = 'atlanta-families'
ON CONFLICT (subscriber_portal_id, source_id) DO NOTHING;
