-- RSVP Companions: Tag friends you're going with
CREATE TABLE rsvp_companions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  rsvp_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id int NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(rsvp_user_id, event_id, companion_id)
);

CREATE INDEX idx_rsvp_companions_event ON rsvp_companions(event_id);
CREATE INDEX idx_rsvp_companions_user ON rsvp_companions(rsvp_user_id);

ALTER TABLE rsvp_companions ENABLE ROW LEVEL SECURITY;

-- RLS: Users can see companions for events they can see
CREATE POLICY "rsvp_companions_select" ON rsvp_companions
  FOR SELECT USING (true);

-- RLS: Users can only insert/update/delete their own companions
CREATE POLICY "rsvp_companions_insert" ON rsvp_companions
  FOR INSERT WITH CHECK (auth.uid() = rsvp_user_id);

CREATE POLICY "rsvp_companions_delete" ON rsvp_companions
  FOR DELETE USING (auth.uid() = rsvp_user_id);
