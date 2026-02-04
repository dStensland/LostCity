-- Newsletter Subscribers Table
-- Stores email addresses for newsletter signups

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  email TEXT PRIMARY KEY,
  portal_id UUID REFERENCES portals(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'website',
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for filtering active subscribers
CREATE INDEX IF NOT EXISTS newsletter_subscribers_subscribed_idx
  ON newsletter_subscribers(subscribed_at)
  WHERE unsubscribed_at IS NULL;

-- Index for portal-specific newsletters
CREATE INDEX IF NOT EXISTS newsletter_subscribers_portal_idx
  ON newsletter_subscribers(portal_id);

-- RLS: Only service role can insert/update (API route uses service client)
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Service role has full access (this is default behavior)
-- No public policies needed - all access through API routes

COMMENT ON TABLE newsletter_subscribers IS 'Email addresses for newsletter subscriptions';
COMMENT ON COLUMN newsletter_subscribers.email IS 'Subscriber email address (primary key)';
COMMENT ON COLUMN newsletter_subscribers.portal_id IS 'Optional portal association (e.g., atlanta-specific newsletter)';
COMMENT ON COLUMN newsletter_subscribers.source IS 'Where the subscription came from (website, landing-page, etc.)';
COMMENT ON COLUMN newsletter_subscribers.subscribed_at IS 'When the user subscribed';
COMMENT ON COLUMN newsletter_subscribers.unsubscribed_at IS 'When the user unsubscribed (NULL if still subscribed)';
COMMENT ON COLUMN newsletter_subscribers.metadata IS 'Additional metadata (referrer, campaign, etc.)';
