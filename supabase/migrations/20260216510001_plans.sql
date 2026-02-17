-- Plans: Lightweight plan coordination for groups of friends
CREATE TABLE plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  plan_date date NOT NULL,
  plan_time time,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  portal_id uuid REFERENCES portals(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE plan_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  title text NOT NULL,
  event_id int REFERENCES events(id) ON DELETE SET NULL,
  venue_id int REFERENCES venues(id) ON DELETE SET NULL,
  note text,
  start_time time,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE plan_participants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined', 'maybe')),
  responded_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(plan_id, user_id)
);

CREATE TABLE plan_suggestions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  suggestion_type text NOT NULL CHECK (suggestion_type IN ('add_item', 'remove_item', 'change_time', 'note')),
  content jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_plans_creator ON plans(creator_id);
CREATE INDEX idx_plans_date ON plans(plan_date);
CREATE INDEX idx_plan_items_plan ON plan_items(plan_id);
CREATE INDEX idx_plan_participants_plan ON plan_participants(plan_id);
CREATE INDEX idx_plan_participants_user ON plan_participants(user_id);

-- RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_suggestions ENABLE ROW LEVEL SECURITY;

-- Plans: visible to creator and participants
CREATE POLICY "plans_select" ON plans FOR SELECT USING (
  auth.uid() = creator_id OR
  EXISTS (SELECT 1 FROM plan_participants WHERE plan_id = plans.id AND user_id = auth.uid())
);
CREATE POLICY "plans_insert" ON plans FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "plans_update" ON plans FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "plans_delete" ON plans FOR DELETE USING (auth.uid() = creator_id);

-- Plan items: visible to plan members, editable by creator
CREATE POLICY "plan_items_select" ON plan_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM plans WHERE id = plan_items.plan_id AND (
    creator_id = auth.uid() OR
    EXISTS (SELECT 1 FROM plan_participants WHERE plan_id = plans.id AND user_id = auth.uid())
  ))
);
CREATE POLICY "plan_items_insert" ON plan_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM plans WHERE id = plan_items.plan_id AND creator_id = auth.uid())
);
CREATE POLICY "plan_items_delete" ON plan_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM plans WHERE id = plan_items.plan_id AND creator_id = auth.uid())
);

-- Participants: visible to plan members
CREATE POLICY "plan_participants_select" ON plan_participants FOR SELECT USING (
  EXISTS (SELECT 1 FROM plans WHERE id = plan_participants.plan_id AND (
    creator_id = auth.uid() OR
    EXISTS (SELECT 1 FROM plan_participants pp WHERE pp.plan_id = plans.id AND pp.user_id = auth.uid())
  ))
);
CREATE POLICY "plan_participants_insert" ON plan_participants FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM plans WHERE id = plan_participants.plan_id AND creator_id = auth.uid())
);
CREATE POLICY "plan_participants_update" ON plan_participants FOR UPDATE USING (
  auth.uid() = user_id
);

-- Suggestions: visible to plan members
CREATE POLICY "plan_suggestions_select" ON plan_suggestions FOR SELECT USING (
  EXISTS (SELECT 1 FROM plans WHERE id = plan_suggestions.plan_id AND (
    creator_id = auth.uid() OR
    EXISTS (SELECT 1 FROM plan_participants WHERE plan_id = plans.id AND user_id = auth.uid())
  ))
);
CREATE POLICY "plan_suggestions_insert" ON plan_suggestions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM plan_participants WHERE plan_id = plan_suggestions.plan_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM plans WHERE id = plan_suggestions.plan_id AND creator_id = auth.uid())
);
CREATE POLICY "plan_suggestions_update" ON plan_suggestions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM plans WHERE id = plan_suggestions.plan_id AND creator_id = auth.uid())
);
