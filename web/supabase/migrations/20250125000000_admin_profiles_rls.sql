-- Allow admins to read all profiles for user management
-- This enables the admin users page to list and view all users

-- First, check if the policy already exists and drop it if so
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;

-- Create policy for admins to SELECT all profiles
CREATE POLICY "Admins can read all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  -- User is an admin (check their own profile's is_admin flag)
  EXISTS (
    SELECT 1 FROM profiles AS admin_profile
    WHERE admin_profile.id = auth.uid()
    AND admin_profile.is_admin = true
  )
);

-- Allow admins to update any profile
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

CREATE POLICY "Admins can update all profiles"
ON profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles AS admin_profile
    WHERE admin_profile.id = auth.uid()
    AND admin_profile.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles AS admin_profile
    WHERE admin_profile.id = auth.uid()
    AND admin_profile.is_admin = true
  )
);
