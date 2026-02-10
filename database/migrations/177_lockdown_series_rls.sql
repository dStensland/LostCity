-- Lock down series write access.
-- The previous migration granted INSERT/UPDATE/DELETE to anon/authenticated
-- with permissive RLS policies, allowing public tampering.

-- Keep series publicly readable.
ALTER TABLE series ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE series FROM PUBLIC;
REVOKE ALL ON TABLE series FROM anon;
REVOKE ALL ON TABLE series FROM authenticated;

GRANT SELECT ON TABLE series TO anon;
GRANT SELECT ON TABLE series TO authenticated;
GRANT ALL ON TABLE series TO service_role;

DROP POLICY IF EXISTS "series_insert_all" ON series;
DROP POLICY IF EXISTS "series_update_all" ON series;
DROP POLICY IF EXISTS "series_delete_all" ON series;
DROP POLICY IF EXISTS "series_admin_modify" ON series;

-- Recreate read policy explicitly.
DROP POLICY IF EXISTS "series_select_all" ON series;
CREATE POLICY "series_select_all"
  ON series
  FOR SELECT
  USING (true);

-- Allow only authenticated admins to mutate series records.
CREATE POLICY "series_admin_modify"
  ON series
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );
