-- ============================================
-- MIGRATION 086: Rename event_producers → organizations
-- ============================================
-- Clean up the data model by consolidating naming:
-- - event_producers → organizations (the entities that produce events)
-- - Create accounts table for B2B portal customers (previously called organizations)
-- ============================================

-- ============================================
-- 1. DROP THE EXISTING (EMPTY) ORGANIZATIONS TABLE
-- ============================================
-- This table was for B2B customers but is being replaced with 'accounts'
DROP TABLE IF EXISTS organizations CASCADE;

-- ============================================
-- 2. RENAME EVENT_PRODUCERS TO ORGANIZATIONS
-- ============================================
ALTER TABLE event_producers RENAME TO organizations;

-- ============================================
-- 3. RENAME RELATED INDEXES
-- ============================================
ALTER INDEX IF EXISTS idx_producers_type RENAME TO idx_organizations_type;
ALTER INDEX IF EXISTS idx_producers_categories RENAME TO idx_organizations_categories;
ALTER INDEX IF EXISTS idx_producers_search_vector RENAME TO idx_organizations_search_vector;
ALTER INDEX IF EXISTS idx_producers_name_trgm RENAME TO idx_organizations_name_trgm;

-- ============================================
-- 4. UPDATE FOREIGN KEY COLUMN NAMES IN REFERENCING TABLES
-- ============================================

-- Events table
ALTER TABLE events RENAME COLUMN producer_id TO organization_id;

-- Festivals table
ALTER TABLE festivals RENAME COLUMN producer_id TO organization_id;

-- Sources table
ALTER TABLE sources RENAME COLUMN producer_id TO organization_id;

-- Venues table
ALTER TABLE venues RENAME COLUMN producer_id TO organization_id;

-- Follows table
ALTER TABLE follows RENAME COLUMN followed_producer_id TO followed_organization_id;

-- Recommendations table (if producer_id exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'recommendations' AND column_name = 'producer_id') THEN
    ALTER TABLE recommendations RENAME COLUMN producer_id TO organization_id;
  END IF;
END $$;

-- Activities table (if producer_id exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'activities' AND column_name = 'producer_id') THEN
    ALTER TABLE activities RENAME COLUMN producer_id TO organization_id;
  END IF;
END $$;

-- Submissions table
ALTER TABLE submissions RENAME COLUMN approved_producer_id TO approved_organization_id;

-- Lists table (if producer_id exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'lists' AND column_name = 'producer_id') THEN
    ALTER TABLE lists RENAME COLUMN producer_id TO organization_id;
  END IF;
END $$;

-- Org tags table - rename org_id to organization_id for consistency
-- Note: org_tags.org_id is already named correctly for this purpose

-- List items table (if producer_id exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'list_items' AND column_name = 'producer_id') THEN
    ALTER TABLE list_items RENAME COLUMN producer_id TO organization_id;
  END IF;
END $$;

-- Series table (if producer_id exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'series' AND column_name = 'producer_id') THEN
    ALTER TABLE series RENAME COLUMN producer_id TO organization_id;
  END IF;
END $$;

-- ============================================
-- 5. RENAME INDEXES ON FOREIGN KEY COLUMNS
-- ============================================
ALTER INDEX IF EXISTS idx_events_producer RENAME TO idx_events_organization;
ALTER INDEX IF EXISTS idx_venues_producer RENAME TO idx_venues_organization;
ALTER INDEX IF EXISTS idx_follows_producer RENAME TO idx_follows_organization;

-- ============================================
-- 6. CREATE NEW ACCOUNTS TABLE FOR B2B PORTAL CUSTOMERS
-- ============================================
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  contact_email TEXT,
  contact_name TEXT,
  plan VARCHAR(20) DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on accounts
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. UPDATE PORTALS TO REFERENCE ACCOUNTS
-- ============================================
-- The portals.owner_id was previously referencing organizations for B2B
-- Now it will reference accounts

-- Add account_id column if it doesn't exist
ALTER TABLE portals ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id);

-- Comment
COMMENT ON TABLE organizations IS 'Event producers, arts organizations, community groups - entities that create and host events';
COMMENT ON TABLE accounts IS 'B2B portal customers - businesses or individuals who own and manage portals';
