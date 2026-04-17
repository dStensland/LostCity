-- Personal pipeline for open calls — save, track applications, set reminders.

CREATE TABLE IF NOT EXISTS user_open_call_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  open_call_id UUID NOT NULL REFERENCES open_calls(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('saved', 'applied', 'dismissed')) DEFAULT 'saved',
  remind_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, open_call_id)
);

-- RLS: users can only see/modify their own tracking
ALTER TABLE user_open_call_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_open_call_tracking_own ON user_open_call_tracking
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_user_open_call_tracking_user ON user_open_call_tracking(user_id, status);
CREATE INDEX idx_user_open_call_tracking_call ON user_open_call_tracking(open_call_id);
