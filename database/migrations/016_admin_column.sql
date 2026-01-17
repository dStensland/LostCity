-- 016_admin_column.sql
-- Add is_admin column to profiles for admin access control

-- Add is_admin column with default false
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create index for admin queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = true;

-- Note: To grant admin access to a user, run:
-- UPDATE profiles SET is_admin = true WHERE username = 'your_username';
