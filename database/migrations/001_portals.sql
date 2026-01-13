-- ============================================
-- MIGRATION 001: Portal Architecture
-- ============================================

-- Organizations (B2B customers)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(63) UNIQUE,
    contact_email VARCHAR(255),
    contact_name VARCHAR(255),
    plan VARCHAR(20) DEFAULT 'free',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Portals (core abstraction)
CREATE TABLE portals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity
    slug VARCHAR(63) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    tagline VARCHAR(255),

    -- Type & Ownership
    portal_type VARCHAR(20) NOT NULL CHECK (portal_type IN ('city', 'event', 'business', 'personal')),
    owner_type VARCHAR(20) CHECK (owner_type IN ('org', 'user', NULL)),
    owner_id UUID,

    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'private')),

    -- Configuration (JSONB for flexibility)
    filters JSONB DEFAULT '{}',
    branding JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast subdomain lookups
CREATE INDEX idx_portals_slug_active ON portals(slug) WHERE status = 'active';

-- Portal custom content (custom events, featured items, announcements)
CREATE TABLE portal_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,

    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('custom_event', 'featured', 'announcement')),

    -- Reference to existing entity OR inline content
    entity_type VARCHAR(20) CHECK (entity_type IN ('event', 'restaurant', 'venue', NULL)),
    entity_id INTEGER, -- matches events.id type

    -- Inline content (JSONB)
    content JSONB,

    -- Display
    display_order INT DEFAULT 0,
    is_pinned BOOLEAN DEFAULT FALSE,
    visibility VARCHAR(20) DEFAULT 'portal_only' CHECK (visibility IN ('portal_only', 'public')),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_portal_content_portal ON portal_content(portal_id);

-- Portal sections (for organizing content)
CREATE TABLE portal_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,

    slug VARCHAR(63) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,

    section_type VARCHAR(20) NOT NULL CHECK (section_type IN ('auto', 'curated', 'mixed')),
    auto_filter JSONB,

    display_order INT DEFAULT 0,
    is_visible BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(portal_id, slug)
);

-- Items within curated sections
CREATE TABLE portal_section_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES portal_sections(id) ON DELETE CASCADE,

    entity_type VARCHAR(20) NOT NULL,
    entity_id INTEGER NOT NULL,

    display_order INT DEFAULT 0,
    note VARCHAR(255),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Portal team members (for access control)
CREATE TABLE portal_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,

    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(portal_id, user_id)
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE portals ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_section_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Public read access to active public portals
CREATE POLICY "Public portals are viewable by everyone"
ON portals FOR SELECT
USING (status = 'active' AND visibility = 'public');

-- Public read access to portal content for public portals
CREATE POLICY "Portal content viewable for public portals"
ON portal_content FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM portals
        WHERE portals.id = portal_content.portal_id
        AND portals.status = 'active'
        AND portals.visibility = 'public'
    )
);

-- Similar policies for sections
CREATE POLICY "Portal sections viewable for public portals"
ON portal_sections FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM portals
        WHERE portals.id = portal_sections.portal_id
        AND portals.status = 'active'
        AND portals.visibility = 'public'
    )
);

CREATE POLICY "Portal section items viewable for public portals"
ON portal_section_items FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM portal_sections
        JOIN portals ON portals.id = portal_sections.portal_id
        WHERE portal_sections.id = portal_section_items.section_id
        AND portals.status = 'active'
        AND portals.visibility = 'public'
    )
);

-- ============================================
-- SEED DATA: Atlanta city portal
-- ============================================

INSERT INTO portals (slug, name, tagline, portal_type, status, visibility, filters, branding, settings)
VALUES (
    'atlanta',
    'Atlanta',
    'Discover events in Atlanta',
    'city',
    'active',
    'public',
    '{"city": "Atlanta"}',
    '{
        "primary_color": "#FF6B35",
        "secondary_color": "#1a1a2e",
        "hero_image_url": null
    }',
    '{
        "show_map": false,
        "default_view": "list",
        "show_categories": true
    }'
);
