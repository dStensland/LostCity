-- Migration 118: Trust tiers and entity claims
-- Adds manual trust tiers, audit log, and claim request/claim tables

-- ============================================================================
-- 1. TRUST TIERS ON PROFILES
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS trust_tier TEXT DEFAULT 'standard';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_trust_tier_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_trust_tier_check
      CHECK (trust_tier IN ('standard', 'trusted_submitter', 'community_manager'));
  END IF;
END $$;

COMMENT ON COLUMN profiles.trust_tier IS 'Manual trust tier for auto-publishing and moderation privileges';

-- ============================================================================
-- 2. TRUST ACTIONS AUDIT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS trust_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (
    action IN (
      'promoted_to_trusted',
      'demoted_to_standard',
      'promoted_to_community_manager',
      'demoted_to_standard_from_cm'
    )
  ),
  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trust_actions_user_id ON trust_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_trust_actions_created_at ON trust_actions(created_at DESC);

ALTER TABLE trust_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trust actions"
  ON trust_actions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage trust actions"
  ON trust_actions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
    )
  );

-- ============================================================================
-- 3. ENTITY CLAIM REQUESTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS entity_claim_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  venue_id INT REFERENCES venues(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_info')),
  verification_method TEXT,
  verification_domain TEXT,
  verification_token TEXT,
  notes TEXT,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT entity_claim_requests_one_target CHECK (
    (venue_id IS NOT NULL)::int + (organization_id IS NOT NULL)::int = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_claim_requests_requested_by ON entity_claim_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_claim_requests_status ON entity_claim_requests(status);
CREATE INDEX IF NOT EXISTS idx_claim_requests_venue_id ON entity_claim_requests(venue_id) WHERE venue_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_claim_requests_org_id ON entity_claim_requests(organization_id) WHERE organization_id IS NOT NULL;

DROP TRIGGER IF EXISTS entity_claim_requests_updated_at ON entity_claim_requests;
CREATE TRIGGER entity_claim_requests_updated_at
  BEFORE UPDATE ON entity_claim_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE entity_claim_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own claim requests"
  ON entity_claim_requests FOR SELECT
  USING (auth.uid() = requested_by);

CREATE POLICY "Users can create claim requests"
  ON entity_claim_requests FOR INSERT
  WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "Users can update own pending claim requests"
  ON entity_claim_requests FOR UPDATE
  USING (
    auth.uid() = requested_by
    AND status IN ('pending', 'needs_info')
  )
  WITH CHECK (
    auth.uid() = requested_by
    AND status IN ('pending', 'needs_info')
  );

CREATE POLICY "Admins can manage claim requests"
  ON entity_claim_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
    )
  );

-- ============================================================================
-- 4. ENTITY CLAIMS (APPROVED)
-- ============================================================================

CREATE TABLE IF NOT EXISTS entity_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  venue_id INT REFERENCES venues(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'manager' CHECK (role IN ('manager', 'editor')),
  created_from_request UUID REFERENCES entity_claim_requests(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT entity_claims_one_target CHECK (
    (venue_id IS NOT NULL)::int + (organization_id IS NOT NULL)::int = 1
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_claims_user_venue
  ON entity_claims(user_id, venue_id) WHERE venue_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_claims_user_org
  ON entity_claims(user_id, organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entity_claims_user_id ON entity_claims(user_id);

ALTER TABLE entity_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own claims"
  ON entity_claims FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage claims"
  ON entity_claims FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
    )
  );

-- ============================================================================
-- 5. TRUST ELIGIBILITY HELPERS
-- ============================================================================

CREATE OR REPLACE FUNCTION is_trust_eligible(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  approved INT;
  trust_score DECIMAL;
BEGIN
  SELECT approved_count INTO approved FROM profiles WHERE id = user_id;
  trust_score := get_user_trust_score(user_id);
  RETURN approved >= 5 AND trust_score >= 0.9;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_trusted_submitter(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  tier TEXT;
  admin_flag BOOLEAN;
BEGIN
  SELECT trust_tier, is_admin INTO tier, admin_flag FROM profiles WHERE id = user_id;
  RETURN admin_flag = TRUE OR tier = 'trusted_submitter';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. SUBMISSION COUNT HANDLING FOR AUTO-APPROVALS
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_submission_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET submission_count = submission_count + 1
  WHERE id = NEW.submitted_by;

  IF NEW.status = 'approved' THEN
    UPDATE profiles
    SET approved_count = approved_count + 1
    WHERE id = NEW.submitted_by;
  ELSIF NEW.status = 'rejected' THEN
    UPDATE profiles
    SET rejected_count = rejected_count + 1
    WHERE id = NEW.submitted_by;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
