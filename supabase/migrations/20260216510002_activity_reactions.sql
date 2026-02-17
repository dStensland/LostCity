-- Activity Reactions: Quick emoji reactions on friend activity items
CREATE TABLE activity_reactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('rsvp', 'follow', 'save')),
  target_id bigint NOT NULL,
  emoji text NOT NULL CHECK (length(emoji) <= 10),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);

CREATE INDEX idx_activity_reactions_target ON activity_reactions(target_type, target_id);

ALTER TABLE activity_reactions ENABLE ROW LEVEL SECURITY;

-- Anyone can read reactions
CREATE POLICY "activity_reactions_select" ON activity_reactions
  FOR SELECT USING (true);

-- Users can only insert/delete their own reactions
CREATE POLICY "activity_reactions_insert" ON activity_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "activity_reactions_update" ON activity_reactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "activity_reactions_delete" ON activity_reactions
  FOR DELETE USING (auth.uid() = user_id);
