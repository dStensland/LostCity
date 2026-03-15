-- Calendar preferences per user
CREATE TABLE IF NOT EXISTS calendar_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_view TEXT NOT NULL DEFAULT 'agenda' CHECK (default_view IN ('agenda', 'month', 'week')),
  week_start TEXT NOT NULL DEFAULT 'sunday' CHECK (week_start IN ('sunday', 'monday')),
  show_friend_events BOOLEAN NOT NULL DEFAULT true,
  show_past_events BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE calendar_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own calendar preferences"
  ON calendar_preferences
  FOR ALL
  USING (auth.uid() = user_id);
