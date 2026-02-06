-- ============================================
-- MIGRATION 125: Organization portal memberships + auto-backfill
-- ============================================
-- Adds organization_portals join table and ensures organizations.portal_id
-- is populated from events (and kept in sync for multi-portal orgs).

-- Join table for multi-portal organizations
CREATE TABLE IF NOT EXISTS organization_portals (
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (organization_id, portal_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_portals_org
ON organization_portals(organization_id);

CREATE INDEX IF NOT EXISTS idx_organization_portals_portal
ON organization_portals(portal_id);

-- RLS: public read, writes via service role only
ALTER TABLE organization_portals ENABLE ROW LEVEL SECURITY;

-- Backfill join table from events (multi-portal safe)
INSERT INTO organization_portals (organization_id, portal_id)
SELECT DISTINCT e.organization_id, e.portal_id
FROM events e
WHERE e.organization_id IS NOT NULL
  AND e.portal_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Backfill join table from organizations.portal_id
INSERT INTO organization_portals (organization_id, portal_id)
SELECT o.id, o.portal_id
FROM organizations o
WHERE o.portal_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Trigger: when events are inserted/updated, set org portal_id if missing
-- and ensure organization_portals has the membership.
CREATE OR REPLACE FUNCTION ensure_org_portal_from_event()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.organization_id IS NULL OR NEW.portal_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- If org portal_id is missing, set it from the event portal
    UPDATE organizations
    SET portal_id = NEW.portal_id
    WHERE id = NEW.organization_id
      AND portal_id IS NULL;

    -- Always record the membership (multi-portal safe)
    INSERT INTO organization_portals (organization_id, portal_id)
    VALUES (NEW.organization_id, NEW.portal_id)
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_event_ensure_org_portal ON events;

CREATE TRIGGER trg_event_ensure_org_portal
    AFTER INSERT OR UPDATE OF portal_id, organization_id ON events
    FOR EACH ROW
    EXECUTE FUNCTION ensure_org_portal_from_event();

-- Trigger: when organizations.portal_id is set/updated, ensure membership
CREATE OR REPLACE FUNCTION ensure_org_portal_membership()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.portal_id IS NULL THEN
        RETURN NEW;
    END IF;

    INSERT INTO organization_portals (organization_id, portal_id)
    VALUES (NEW.id, NEW.portal_id)
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_org_ensure_portal_membership ON organizations;

CREATE TRIGGER trg_org_ensure_portal_membership
    AFTER INSERT OR UPDATE OF portal_id ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION ensure_org_portal_membership();
