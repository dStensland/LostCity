ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_settings JSONB NOT NULL DEFAULT '{}';
