-- ============================================
-- MIGRATION 123: Add portal_id to organizations
-- ============================================
-- Adds portal_id to organizations and backfills based on events.

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS portal_id UUID REFERENCES portals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_portal_id
ON organizations(portal_id);

-- Backfill portal_id from events (choose the most frequent portal per org)
WITH org_portal_counts AS (
    SELECT
        organization_id,
        portal_id,
        COUNT(*) AS event_count,
        ROW_NUMBER() OVER (
            PARTITION BY organization_id
            ORDER BY COUNT(*) DESC, portal_id
        ) AS rn
    FROM events
    WHERE portal_id IS NOT NULL
    GROUP BY organization_id, portal_id
),
chosen_portal AS (
    SELECT organization_id, portal_id
    FROM org_portal_counts
    WHERE rn = 1
)
UPDATE organizations o
SET portal_id = c.portal_id
FROM chosen_portal c
WHERE o.id = c.organization_id
  AND o.portal_id IS NULL;
