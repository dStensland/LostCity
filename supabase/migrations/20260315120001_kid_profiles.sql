-- Kid profiles for family portal (Lost City: Family)
-- Parents create profiles for each child to enable age-matched recommendations
-- across events, programs, and destinations.

-- UP

CREATE TABLE IF NOT EXISTS kid_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,           -- display name ("Bug", "Rocket")
  age INTEGER NOT NULL CHECK (age >= 0 AND age <= 18),
  color TEXT NOT NULL DEFAULT '#4A7DB5',  -- kid's personal color hex
  emoji TEXT,                       -- avatar emoji
  school_system TEXT CHECK (school_system IN ('aps', 'dekalb', 'cobb', 'gwinnett')),
  interests TEXT[] DEFAULT '{}',    -- activity interests
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique nickname per user (no two kids with same name under same account)
CREATE UNIQUE INDEX IF NOT EXISTS idx_kid_profiles_user_nickname
  ON kid_profiles(user_id, nickname);

CREATE INDEX IF NOT EXISTS idx_kid_profiles_user
  ON kid_profiles(user_id);

-- RLS: users can only read/write their own kids
ALTER TABLE kid_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own kid profiles"
  ON kid_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at on every write
CREATE TRIGGER kid_profiles_updated_at
  BEFORE UPDATE ON kid_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- DOWN
-- DROP TABLE IF EXISTS kid_profiles;
