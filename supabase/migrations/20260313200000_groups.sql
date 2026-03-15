-- Groups: private friend groups for coordinating hangs and shared venue lists
-- PRD-036: Groups ("Crews")
-- Mirror of database/migrations/492_groups.sql

BEGIN;

CREATE TABLE groups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 60),
  description   TEXT CHECK (char_length(description) <= 280),
  emoji         TEXT,
  avatar_url    TEXT,
  creator_id    UUID NOT NULL REFERENCES profiles(id),
  invite_code   TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
  visibility    TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'unlisted')),
  max_members   INT NOT NULL DEFAULT 50 CHECK (max_members BETWEEN 2 AND 100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_groups_creator ON groups (creator_id);
CREATE INDEX idx_groups_invite_code ON groups (invite_code);

CREATE TABLE group_members (
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id),
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invited_by  UUID REFERENCES profiles(id),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX idx_group_members_user ON group_members (user_id);

CREATE TABLE group_spots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  venue_id    INT NOT NULL REFERENCES venues(id),
  added_by    UUID NOT NULL REFERENCES profiles(id),
  note        TEXT CHECK (char_length(note) <= 140),
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, venue_id)
);

CREATE INDEX idx_group_spots_group ON group_spots (group_id);
CREATE INDEX idx_group_spots_venue ON group_spots (venue_id);

ALTER TABLE hangs ADD COLUMN group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

CREATE INDEX idx_hangs_group_active ON hangs (group_id, status, started_at DESC)
  WHERE group_id IS NOT NULL AND status IN ('active', 'planned');

CREATE OR REPLACE FUNCTION check_max_groups_per_user()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM group_members WHERE user_id = NEW.user_id) >= 20 THEN
    RAISE EXCEPTION 'User cannot join more than 20 groups';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_max_groups_per_user
  BEFORE INSERT ON group_members
  FOR EACH ROW
  EXECUTE FUNCTION check_max_groups_per_user();

CREATE OR REPLACE FUNCTION check_max_group_members()
RETURNS TRIGGER AS $$
DECLARE
  max_m INT;
  current_count INT;
BEGIN
  SELECT max_members INTO max_m FROM groups WHERE id = NEW.group_id;
  SELECT COUNT(*) INTO current_count FROM group_members WHERE group_id = NEW.group_id;
  IF current_count >= max_m THEN
    RAISE EXCEPTION 'Group has reached its maximum member limit';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_max_group_members
  BEFORE INSERT ON group_members
  FOR EACH ROW
  EXECUTE FUNCTION check_max_group_members();

CREATE OR REPLACE FUNCTION auto_promote_group_admin()
RETURNS TRIGGER AS $$
DECLARE
  admin_count INT;
  oldest_member_id UUID;
BEGIN
  IF OLD.role != 'admin' THEN
    RETURN OLD;
  END IF;
  SELECT COUNT(*) INTO admin_count
  FROM group_members
  WHERE group_id = OLD.group_id AND role = 'admin' AND user_id != OLD.user_id;
  IF admin_count = 0 THEN
    SELECT user_id INTO oldest_member_id
    FROM group_members
    WHERE group_id = OLD.group_id AND user_id != OLD.user_id
    ORDER BY joined_at ASC
    LIMIT 1;
    IF oldest_member_id IS NOT NULL THEN
      UPDATE group_members
      SET role = 'admin'
      WHERE group_id = OLD.group_id AND user_id = oldest_member_id;
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_promote_on_admin_leave
  BEFORE DELETE ON group_members
  FOR EACH ROW
  EXECUTE FUNCTION auto_promote_group_admin();

CREATE TRIGGER groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_spots ENABLE ROW LEVEL SECURITY;

CREATE POLICY groups_select_member ON groups FOR SELECT TO authenticated
  USING (id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()));
CREATE POLICY groups_insert_creator ON groups FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());
CREATE POLICY groups_update_admin ON groups FOR UPDATE TO authenticated
  USING (id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY groups_delete_creator ON groups FOR DELETE TO authenticated
  USING (creator_id = auth.uid());
CREATE POLICY groups_service ON groups FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY group_members_select ON group_members FOR SELECT TO authenticated
  USING (group_id IN (SELECT gm.group_id FROM group_members gm WHERE gm.user_id = auth.uid()));
CREATE POLICY group_members_insert ON group_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR group_id IN (SELECT gm.group_id FROM group_members gm WHERE gm.user_id = auth.uid() AND gm.role = 'admin'));
CREATE POLICY group_members_delete ON group_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR group_id IN (SELECT gm.group_id FROM group_members gm WHERE gm.user_id = auth.uid() AND gm.role = 'admin'));
CREATE POLICY group_members_update ON group_members FOR UPDATE TO authenticated
  USING (group_id IN (SELECT gm.group_id FROM group_members gm WHERE gm.user_id = auth.uid() AND gm.role = 'admin'));
CREATE POLICY group_members_service ON group_members FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY group_spots_select ON group_spots FOR SELECT TO authenticated
  USING (group_id IN (SELECT gm.group_id FROM group_members gm WHERE gm.user_id = auth.uid()));
CREATE POLICY group_spots_insert ON group_spots FOR INSERT TO authenticated
  WITH CHECK (group_id IN (SELECT gm.group_id FROM group_members gm WHERE gm.user_id = auth.uid()));
CREATE POLICY group_spots_delete ON group_spots FOR DELETE TO authenticated
  USING (group_id IN (SELECT gm.group_id FROM group_members gm WHERE gm.user_id = auth.uid()));
CREATE POLICY group_spots_service ON group_spots FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY hangs_select_group ON hangs FOR SELECT TO authenticated
  USING (
    group_id IS NOT NULL AND
    group_id IN (SELECT gm.group_id FROM group_members gm WHERE gm.user_id = auth.uid()) AND
    NOT is_blocked(auth.uid(), user_id)
  );

COMMIT;
