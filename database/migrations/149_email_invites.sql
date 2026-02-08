-- Email Invites: Track email invitations sent to non-users
-- Migration 149

CREATE TABLE IF NOT EXISTS email_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'joined', 'bounced')),
  event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(inviter_id, email)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_invites_inviter ON email_invites(inviter_id);
CREATE INDEX IF NOT EXISTS idx_email_invites_email ON email_invites(email);
CREATE INDEX IF NOT EXISTS idx_email_invites_status ON email_invites(status);

-- RLS
ALTER TABLE email_invites ENABLE ROW LEVEL SECURITY;

-- Users can view their own sent invites
CREATE POLICY "Users can view own email invites"
  ON email_invites FOR SELECT
  USING (auth.uid() = inviter_id);

-- Users can create invites (only as themselves)
CREATE POLICY "Users can create email invites"
  ON email_invites FOR INSERT
  WITH CHECK (auth.uid() = inviter_id);

COMMENT ON TABLE email_invites IS 'Tracks email invitations sent to non-users for friend discovery';
