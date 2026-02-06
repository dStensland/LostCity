-- ============================================
-- MIGRATION 126: Organization portals policy fix
-- ============================================
-- Adds public read policy for organization_portals (idempotent).

ALTER TABLE organization_portals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'organization_portals'
          AND policyname = 'Anyone can view organization portals'
    ) THEN
        EXECUTE 'CREATE POLICY "Anyone can view organization portals" ON organization_portals FOR SELECT USING (true)';
    END IF;
END $$;
