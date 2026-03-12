-- ============================================
-- MIGRATION 284: Interest Channels (Phase 1)
-- ============================================
-- Portal-agnostic semantic subscription primitives.

CREATE TABLE IF NOT EXISTS interest_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID REFERENCES portals(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  channel_type TEXT NOT NULL CHECK (channel_type IN (
    'jurisdiction',
    'institution',
    'topic',
    'community',
    'intent'
  )),
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Global channels (portal_id NULL) must have globally unique slugs.
CREATE UNIQUE INDEX IF NOT EXISTS idx_interest_channels_global_slug
  ON interest_channels(slug)
  WHERE portal_id IS NULL;

-- Portal-scoped channels must be unique per portal.
CREATE UNIQUE INDEX IF NOT EXISTS idx_interest_channels_portal_slug
  ON interest_channels(portal_id, slug)
  WHERE portal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_interest_channels_portal_active
  ON interest_channels(portal_id, is_active, sort_order);

CREATE TABLE IF NOT EXISTS interest_channel_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES interest_channels(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN (
    'source',
    'organization',
    'venue',
    'category',
    'tag',
    'geo',
    'expression'
  )),
  rule_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  priority INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interest_channel_rules_channel_active_priority
  ON interest_channel_rules(channel_id, is_active, priority);

CREATE TABLE IF NOT EXISTS user_channel_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES interest_channels(id) ON DELETE CASCADE,
  portal_id UUID REFERENCES portals(id) ON DELETE SET NULL,
  delivery_mode TEXT NOT NULL DEFAULT 'feed_only' CHECK (delivery_mode IN ('feed_only', 'instant', 'digest')),
  digest_frequency TEXT CHECK (digest_frequency IN ('daily', 'weekly')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, channel_id),
  CHECK (delivery_mode <> 'digest' OR digest_frequency IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_user_channel_subscriptions_user_portal
  ON user_channel_subscriptions(user_id, portal_id);

CREATE INDEX IF NOT EXISTS idx_user_channel_subscriptions_channel
  ON user_channel_subscriptions(channel_id);

ALTER TABLE interest_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE interest_channel_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_channel_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'interest_channels'
      AND policyname = 'interest_channels_select_active'
  ) THEN
    CREATE POLICY interest_channels_select_active ON interest_channels
      FOR SELECT TO anon, authenticated
      USING (is_active = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_channel_subscriptions'
      AND policyname = 'user_channel_subscriptions_select_own'
  ) THEN
    CREATE POLICY user_channel_subscriptions_select_own ON user_channel_subscriptions
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_channel_subscriptions'
      AND policyname = 'user_channel_subscriptions_insert_own'
  ) THEN
    CREATE POLICY user_channel_subscriptions_insert_own ON user_channel_subscriptions
      FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_channel_subscriptions'
      AND policyname = 'user_channel_subscriptions_update_own'
  ) THEN
    CREATE POLICY user_channel_subscriptions_update_own ON user_channel_subscriptions
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_channel_subscriptions'
      AND policyname = 'user_channel_subscriptions_delete_own'
  ) THEN
    CREATE POLICY user_channel_subscriptions_delete_own ON user_channel_subscriptions
      FOR DELETE TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

COMMENT ON TABLE interest_channels IS 'Portal-scoped semantic channels users can subscribe to.';
COMMENT ON TABLE interest_channel_rules IS 'Rule graph for matching events/entities into channels.';
COMMENT ON TABLE user_channel_subscriptions IS 'User subscriptions to interest channels with delivery preferences.';
