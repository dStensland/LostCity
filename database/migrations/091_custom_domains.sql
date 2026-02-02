-- Migration: Add custom domain support for B2B portals
-- This enables portals to use custom domains like events.marriott.com

-- Add custom_domain column to portals
ALTER TABLE portals ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255) UNIQUE;

-- Add domain verification fields
ALTER TABLE portals ADD COLUMN IF NOT EXISTS custom_domain_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE portals ADD COLUMN IF NOT EXISTS custom_domain_verification_token VARCHAR(64);

-- Create index for fast domain lookups (only on active portals with custom domains)
CREATE INDEX IF NOT EXISTS idx_portals_custom_domain
  ON portals(custom_domain)
  WHERE status = 'active' AND custom_domain IS NOT NULL;

-- Add plan column to portals for quick access to tier features
-- This avoids joining to organizations for every request
ALTER TABLE portals ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'starter';

-- Add constraint to ensure valid plan values
-- Note: Using DO block for conditional constraint creation to be idempotent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'portals_plan_check'
  ) THEN
    ALTER TABLE portals ADD CONSTRAINT portals_plan_check
      CHECK (plan IN ('starter', 'professional', 'enterprise'));
  END IF;
END $$;

-- Add parent_portal_id for B2B portal relationships
-- This links business portals to their parent city portal for federation
ALTER TABLE portals ADD COLUMN IF NOT EXISTS parent_portal_id UUID REFERENCES portals(id) ON DELETE SET NULL;

-- Create index for parent portal lookups
CREATE INDEX IF NOT EXISTS idx_portals_parent_portal_id ON portals(parent_portal_id) WHERE parent_portal_id IS NOT NULL;

-- Add comment explaining the columns
COMMENT ON COLUMN portals.custom_domain IS 'Custom domain for white-label portals (e.g., events.marriott.com)';
COMMENT ON COLUMN portals.custom_domain_verified IS 'Whether the custom domain has been verified via DNS TXT record';
COMMENT ON COLUMN portals.custom_domain_verification_token IS 'Token for DNS TXT record verification (_lostcity-verify.domain.com)';
COMMENT ON COLUMN portals.plan IS 'Subscription tier: starter (free), professional ($299/mo), enterprise ($999/mo)';
COMMENT ON COLUMN portals.parent_portal_id IS 'Parent city portal for B2B portals (enables content federation)';
